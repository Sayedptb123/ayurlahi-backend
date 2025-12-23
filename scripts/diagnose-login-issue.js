#!/usr/bin/env node

/**
 * Diagnostic script to check login issues
 * Checks database connection, user existence, and schema
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  database: process.env.DB_NAME || 'ayurlahi',
  password: process.env.DB_PASSWORD || '',
};

function executeSQL(sql) {
  try {
    const env = { ...process.env };
    if (config.password) {
      env.PGPASSWORD = config.password;
    }

    const result = execSync(
      `psql -q -t -A -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -c "${sql.replace(/"/g, '\\"')}"`,
      { env, encoding: 'utf8', stdio: 'pipe' }
    );
    return result.trim();
  } catch (error) {
    throw new Error(`SQL execution failed: ${error.message}`);
  }
}

function log(message, color = 'reset') {
  const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('========================================', 'blue');
  log('Login Issue Diagnostic Tool', 'blue');
  log('========================================', 'blue');
  console.log('');

  // Check 1: Database connection
  log('1. Checking database connection...', 'cyan');
  try {
    const result = executeSQL('SELECT version();');
    log('   ✓ Database connection successful', 'green');
    log(`   PostgreSQL version: ${result.substring(0, 50)}...`, 'yellow');
  } catch (error) {
    log('   ✗ Database connection failed', 'red');
    log(`   Error: ${error.message}`, 'red');
    log('\nTroubleshooting:', 'yellow');
    log('   - Check if PostgreSQL is running', 'yellow');
    log('   - Verify DB_HOST, DB_PORT, DB_USER, DB_NAME in .env', 'yellow');
    log('   - Check DB_PASSWORD if required', 'yellow');
    process.exit(1);
  }
  console.log('');

  // Check 2: Users table exists
  log('2. Checking users table...', 'cyan');
  try {
    const tableExists = executeSQL(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    if (tableExists === 't') {
      log('   ✓ Users table exists', 'green');
    } else {
      log('   ✗ Users table does not exist', 'red');
      log('   Run migrations first: npm run migrate:hms', 'yellow');
      process.exit(1);
    }
  } catch (error) {
    log('   ✗ Error checking users table', 'red');
    log(`   Error: ${error.message}`, 'red');
    process.exit(1);
  }
  console.log('');

  // Check 3: Check users table columns
  log('3. Checking users table schema...', 'cyan');
  try {
    const columns = executeSQL(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    const columnList = columns.split('\n').filter(c => c);
    log(`   ✓ Found ${columnList.length} columns`, 'green');
    
    const requiredColumns = [
      'id', 'email', 'password_hash', 'first_name', 'last_name', 
      'role', 'is_active', 'is_email_verified'
    ];
    
    const foundColumns = columnList.map(c => c.split('|')[0]);
    const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));
    
    if (missingColumns.length > 0) {
      log('   ✗ Missing required columns:', 'red');
      missingColumns.forEach(col => log(`     - ${col}`, 'red'));
      log('\n   Run migration to fix schema:', 'yellow');
      log('   psql -U postgres -d ayurlahi -f migrations/fix-users-table-schema.sql', 'yellow');
    } else {
      log('   ✓ All required columns present', 'green');
    }
  } catch (error) {
    log('   ✗ Error checking schema', 'red');
    log(`   Error: ${error.message}`, 'red');
  }
  console.log('');

  // Check 4: Check if test user exists
  log('4. Checking test user (clinic1@test.com)...', 'cyan');
  try {
    const userExists = executeSQL(`
      SELECT id, email, first_name, last_name, role, is_active, 
             CASE WHEN password_hash IS NULL THEN 'NULL' 
                  WHEN password_hash = '' THEN 'EMPTY'
                  ELSE 'SET' END as password_status
      FROM users 
      WHERE email = 'clinic1@test.com';
    `);
    
    if (userExists) {
      const parts = userExists.split('|');
      log('   ✓ Test user found', 'green');
      log(`     ID: ${parts[0]}`, 'yellow');
      log(`     Email: ${parts[1]}`, 'yellow');
      log(`     Name: ${parts[2]} ${parts[3]}`, 'yellow');
      log(`     Role: ${parts[4]}`, 'yellow');
      log(`     Active: ${parts[5]}`, 'yellow');
      log(`     Password: ${parts[6]}`, 'yellow');
      
      if (parts[6] === 'NULL' || parts[6] === 'EMPTY') {
        log('\n   ⚠ Password hash is missing or empty!', 'red');
        log('   Run seed script: npm run seed:test-users', 'yellow');
      }
    } else {
      log('   ✗ Test user not found', 'red');
      log('\n   Run seed script to create test users:', 'yellow');
      log('   npm run seed:test-users', 'yellow');
    }
  } catch (error) {
    log('   ✗ Error checking user', 'red');
    log(`   Error: ${error.message}`, 'red');
  }
  console.log('');

  // Check 5: Test password hash format
  log('5. Checking password hash format...', 'cyan');
  try {
    const hashInfo = executeSQL(`
      SELECT 
        LENGTH(password_hash) as hash_length,
        SUBSTRING(password_hash, 1, 4) as hash_prefix
      FROM users 
      WHERE email = 'clinic1@test.com' 
        AND password_hash IS NOT NULL 
        AND password_hash != '';
    `);
    
    if (hashInfo) {
      const parts = hashInfo.split('|');
      log('   ✓ Password hash found', 'green');
      log(`     Length: ${parts[0]}`, 'yellow');
      log(`     Prefix: ${parts[1]}`, 'yellow');
      
      if (parts[1] && parts[1].startsWith('$2')) {
        log('     Format: bcrypt (correct)', 'green');
      } else {
        log('     Format: Unknown (should start with $2 for bcrypt)', 'red');
      }
    } else {
      log('   ✗ No password hash found', 'red');
    }
  } catch (error) {
    log('   ⚠ Could not check password hash', 'yellow');
    log(`   Error: ${error.message}`, 'yellow');
  }
  console.log('');

  log('========================================', 'blue');
  log('Diagnostic Complete', 'blue');
  log('========================================', 'blue');
  console.log('');
  log('Next steps:', 'cyan');
  log('  1. If user is missing: npm run seed:test-users', 'yellow');
  log('  2. If schema is wrong: Run migrations', 'yellow');
  log('  3. Check server logs for detailed error messages', 'yellow');
  log('  4. Try login again: npm run test:hms:full', 'yellow');
}

main().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  process.exit(1);
});

