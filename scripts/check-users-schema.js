#!/usr/bin/env node

/**
 * Check Users Table Schema
 * Shows the actual column names in the database
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getDbConfig() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach((line) => {
        const [key, ...values] = line.split('=');
        if (key && values.length > 0) {
          process.env[key.trim()] = values.join('=').trim();
        }
      });
    }
  } catch (error) {
    // Ignore
  }

  return {
    user: process.env.DB_USERNAME || 'postgres',
    database: process.env.DB_NAME || 'ayurlahi',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '5432',
    password: process.env.DB_PASSWORD || '',
  };
}

function executeSQL(config, sql) {
  try {
    const env = { ...process.env };
    if (config.password) {
      env.PGPASSWORD = config.password;
    }

    const result = execSync(
      `psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -t -A -c "${sql.replace(/"/g, '\\"')}"`,
      { env, encoding: 'utf8' }
    );
    return result.trim().split('\n').filter(line => line.trim());
  } catch (error) {
    throw new Error(`SQL execution failed: ${error.message}`);
  }
}

function main() {
  const config = getDbConfig();
  
  console.log('Checking users table schema...\n');
  console.log(`Database: ${config.database}`);
  console.log(`Host: ${config.host}:${config.port}\n`);

  if (!config.password) {
    console.log('Note: DB_PASSWORD not set in .env, you may need to enter it\n');
  }

  try {
    const columns = executeSQL(config, `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);

    console.log('Current users table columns:');
    console.log('='.repeat(80));
    console.log('Column Name'.padEnd(30) + 'Type'.padEnd(20) + 'Nullable'.padEnd(10) + 'Default');
    console.log('-'.repeat(80));
    
    columns.forEach(col => {
      const [name, type, nullable, defaultVal] = col.split('|');
      console.log(
        (name || '').padEnd(30) + 
        (type || '').padEnd(20) + 
        (nullable || '').padEnd(10) + 
        (defaultVal || '')
      );
    });

    console.log('\n' + '='.repeat(80));
    console.log(`Total columns: ${columns.length}\n`);

    // Check for specific columns
    const columnNames = columns.map(col => col.split('|')[0].toLowerCase());
    
    console.log('Column Name Checks:');
    console.log(`  password_hash: ${columnNames.includes('password_hash') ? '✓ EXISTS' : '✗ MISSING'}`);
    console.log(`  password: ${columnNames.includes('password') ? '⚠ EXISTS (needs rename)' : '✓ OK'}`);
    console.log(`  first_name: ${columnNames.includes('first_name') ? '✓ EXISTS' : '✗ MISSING'}`);
    console.log(`  firstName: ${columnNames.includes('firstname') ? '⚠ EXISTS (needs rename)' : '✓ OK'}`);
    console.log(`  last_name: ${columnNames.includes('last_name') ? '✓ EXISTS' : '✗ MISSING'}`);
    console.log(`  lastName: ${columnNames.includes('lastname') ? '⚠ EXISTS (needs rename)' : '✓ OK'}`);
    console.log(`  is_active: ${columnNames.includes('is_active') ? '✓ EXISTS' : '✗ MISSING'}`);
    console.log(`  isActive: ${columnNames.includes('isactive') ? '⚠ EXISTS (needs rename)' : '✓ OK'}`);
    console.log(`  created_at: ${columnNames.includes('created_at') ? '✓ EXISTS' : '✗ MISSING'}`);
    console.log(`  createdAt: ${columnNames.includes('createdat') ? '⚠ EXISTS (needs rename)' : '✓ OK'}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();

