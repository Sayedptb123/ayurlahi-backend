#!/usr/bin/env node

/**
 * Diagnostic script to check if test user exists and verify database schema
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ayurlahi',
};

function executeSQL(sql) {
  try {
    const env = { ...process.env };
    if (config.password) {
      env.PGPASSWORD = config.password;
    }

    const result = execSync(
      `psql -q -t -A -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -c "${sql.replace(/"/g, '\\"')}"`,
      { env, encoding: 'utf8' }
    );
    
    return result.trim();
  } catch (error) {
    throw new Error(`SQL execution failed: ${error.message}`);
  }
}

function log(message, color = '') {
  const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('========================================', 'cyan');
  log('Test User Diagnostic Check', 'cyan');
  log('========================================', 'cyan');
  console.log('');

  try {
    // Check if user exists
    log('1. Checking if test user exists...', 'cyan');
    const userCheck = executeSQL(`
      SELECT 
        id, 
        email, 
        role, 
        is_active, 
        is_email_verified,
        clinic_id,
        CASE WHEN password_hash IS NULL THEN 'NULL' 
             WHEN password_hash = '' THEN 'EMPTY'
             ELSE 'HAS_VALUE' END as password_status,
        LENGTH(password_hash) as password_length
      FROM users 
      WHERE email = 'clinic1@test.com'
    `);

    if (!userCheck || userCheck.trim() === '') {
      log('✗ Test user NOT FOUND', 'red');
      log('\nRun: npm run seed:test-users', 'yellow');
      return;
    }

    const parts = userCheck.split('|');
    log('✓ Test user found:', 'green');
    console.log(`   ID: ${parts[0]}`);
    console.log(`   Email: ${parts[1]}`);
    console.log(`   Role: ${parts[2]}`);
    console.log(`   Is Active: ${parts[3]}`);
    console.log(`   Email Verified: ${parts[4]}`);
    console.log(`   Clinic ID: ${parts[5] || 'NULL'}`);
    console.log(`   Password Status: ${parts[6]}`);
    console.log(`   Password Length: ${parts[7] || '0'}`);
    console.log('');

    // Check database columns
    log('2. Checking database schema...', 'cyan');
    const columns = executeSQL(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('password_hash', 'first_name', 'last_name', 'email', 'role')
      ORDER BY column_name
    `);

    if (columns) {
      log('✓ Required columns found:', 'green');
      const lines = columns.split('\n').filter(l => l.trim());
      lines.forEach(line => {
        const [name, type, nullable] = line.split('|');
        console.log(`   ${name}: ${type} (nullable: ${nullable})`);
      });
    } else {
      log('✗ Some required columns missing', 'red');
    }
    console.log('');

    // Check clinic
    if (parts[5] && parts[5] !== 'NULL') {
      log('3. Checking associated clinic...', 'cyan');
      const clinicCheck = executeSQL(`
        SELECT id, name, is_active
        FROM clinics
        WHERE id = '${parts[5]}'
      `);

      if (clinicCheck && clinicCheck.trim()) {
        const clinicParts = clinicCheck.split('|');
        log('✓ Clinic found:', 'green');
        console.log(`   ID: ${clinicParts[0]}`);
        console.log(`   Name: ${clinicParts[1]}`);
        console.log(`   Is Active: ${clinicParts[2]}`);
      } else {
        log('✗ Clinic NOT FOUND (user has clinic_id but clinic missing)', 'red');
      }
      console.log('');
    }

    log('========================================', 'cyan');
    log('Diagnostic Complete', 'cyan');
    log('========================================', 'cyan');
    console.log('');
    log('If user exists but login fails:', 'yellow');
    log('  1. Check server logs for detailed error', 'yellow');
    log('  2. Verify password was hashed correctly', 'yellow');
    log('  3. Try re-seeding: npm run seed:test-users', 'yellow');

  } catch (error) {
    log('✗ Error running diagnostic:', 'red');
    console.error(error.message);
    console.log('');
    log('Troubleshooting:', 'yellow');
    log('  1. Check database connection settings in .env', 'yellow');
    log('  2. Ensure PostgreSQL is running', 'yellow');
    log('  3. Verify database credentials', 'yellow');
  }
}

main();

