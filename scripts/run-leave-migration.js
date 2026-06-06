const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse .env file manually
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      process.env[key] = value.trim();
    }
  });
}

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USERNAME || process.env.USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'medilink',
};

async function run() {
  console.log('Connecting with DB Config:', {
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    database: DB_CONFIG.database,
    hasPassword: !!DB_CONFIG.password
  });
  
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    console.log('✅ Connected to database:', DB_CONFIG.database);
    
    const sqlPath = path.join(__dirname, '../src/migrations/2026-06-05-leave-management.sql');
    console.log('Reading migration SQL from:', sqlPath);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executing migration script...');
    await client.query(sql);
    console.log('✅ Migration executed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
