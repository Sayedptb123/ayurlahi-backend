const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Try to load dotenv if available, otherwise use process.env directly
try {
  require('dotenv').config({ path: '.env' });
} catch (e) {
  // dotenv not installed, will use process.env directly
  console.log('Note: dotenv not found, using process.env directly');
}

// On macOS with Homebrew, default user is the macOS username, not 'postgres'
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USERNAME || process.env.USER || 'postgres', // Use current user if available
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'medilink',
};

async function runMigrations() {
  const client = new Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to database:', DB_CONFIG.database);
    console.log('');
    
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Get migration files
    const migrationsDir = path.join(__dirname, '../migrations/medilink');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️  Migrations directory does not exist:', migrationsDir);
      console.log('Creating directory...');
      fs.mkdirSync(migrationsDir, { recursive: true });
      console.log('✅ Directory created. Add migration files and run again.');
      return;
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    if (files.length === 0) {
      console.log('⚠️  No migration files found in:', migrationsDir);
      console.log('Add .sql files to run migrations.');
      return;
    }
    
    console.log(`Found ${files.length} migration file(s)`);
    console.log('');
    
    let executedCount = 0;
    let skippedCount = 0;
    
    // Run each migration
    for (const file of files) {
      const migrationName = file.replace('.sql', '');
      
      // Check if already executed
      const result = await client.query(
        'SELECT * FROM migrations WHERE name = $1',
        [migrationName]
      );
      
      if (result.rows.length > 0) {
        console.log(`⏭️  Skipping ${migrationName} (already executed)`);
        skippedCount++;
        continue;
      }
      
      console.log(`🔄 Running ${migrationName}...`);
      
      const sql = fs.readFileSync(
        path.join(migrationsDir, file),
        'utf8'
      );
      
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migrationName]
        );
        await client.query('COMMIT');
        console.log(`✅ Completed ${migrationName}`);
        executedCount++;
        console.log('');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Error in ${migrationName}:`, error.message);
        throw error;
      }
    }
    
    console.log('========================================');
    console.log(`✅ Migration Summary:`);
    console.log(`   Executed: ${executedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Total: ${files.length}`);
    console.log('========================================');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();

