#!/usr/bin/env node

/**
 * Fix User Passwords Script
 * Updates password hashes for test users to ensure they're correctly hashed
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

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
    // Ignore .env read errors
  }

  return {
    user: process.env.DB_USERNAME || 'postgres',
    database: process.env.DB_NAME || 'ayurlahi',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '5432',
    password: process.env.DB_PASSWORD || '',
  };
}

function hashPasswordSync(password) {
  const bcrypt = require('bcrypt');
  const saltRounds = 10;
  return bcrypt.hashSync(password, saltRounds);
}

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function main() {
  log('========================================', 'blue');
  log('Fix User Passwords Script', 'blue');
  log('========================================', 'blue');
  console.log('');

  const config = getDbConfig();
  const password = 'password123';

  console.log(`Database: ${config.database}`);
  console.log(`User: ${config.user}`);
  console.log(`Host: ${config.host}`);
  console.log(`Port: ${config.port}`);
  console.log('');

  if (!config.password) {
    config.password = await question('Enter PostgreSQL password: ');
    console.log('');
  }

  // Hash password
  log('Hashing password...', 'cyan');
  const hashedPassword = hashPasswordSync(password);
  log(`✓ Password hashed (length: ${hashedPassword.length})`, 'green');
  console.log('');

  // Test user emails
  const testUserEmails = [
    'superadmin1@ayurlahi.com',
    'admin@test.com',
    'support@test.com',
    'clinic1.owner@test.com',
    'clinic2.owner@test.com',
    'mfg1.owner@test.com',
    'mfg2.owner@test.com',
    'rahul.final@test.com'
  ];

  log('Updating password hashes for test users...', 'cyan');
  console.log('');

  let updated = 0;
  let notFound = 0;

  for (const email of testUserEmails) {
    try {
      const env = { ...process.env };
      if (config.password) {
        env.PGPASSWORD = config.password;
      }

      // Use dollar-quoted strings to safely handle special characters in bcrypt hash ($, etc.)
      // Write SQL to temporary file to avoid shell expansion issues
      const escapedEmail = email.replace(/'/g, "''");
      const sql = `UPDATE users SET password_hash = $hash$${hashedPassword}$hash$ WHERE email = '${escapedEmail}';`;

      // Write SQL to temporary file to avoid shell expansion of $ characters
      const tempFile = path.join(os.tmpdir(), `fix-password-${Date.now()}-${Math.random().toString(36).substring(7)}.sql`);
      fs.writeFileSync(tempFile, sql, 'utf8');

      try {
        execSync(
          `psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -q -f "${tempFile}"`,
          { env, encoding: 'utf8', stdio: 'pipe' }
        );
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }

      // Check if user was updated by checking hash length (should be 60 for bcrypt)
      const checkSQL = `SELECT LENGTH(password_hash) as hash_length FROM users WHERE email = '${escapedEmail}';`;
      const result = execSync(
        `psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -q -t -A -c "${checkSQL}"`,
        { env, encoding: 'utf8' }
      );

      const hashLength = parseInt(result.trim());
      if (hashLength === 60) {
        log(`  ✓ Updated password for: ${email} (hash length: ${hashLength})`, 'green');
        updated++;
      } else if (hashLength > 0) {
        log(`  ⚠ User found but hash length is ${hashLength} (expected 60): ${email}`, 'yellow');
        notFound++;
      } else {
        log(`  ⚠ User not found: ${email}`, 'yellow');
        notFound++;
      }
    } catch (error) {
      log(`  ✗ Failed to update ${email}: ${error.message}`, 'red');
      notFound++;
    }
  }

  console.log('');
  log('========================================', 'blue');
  log(`Updated: ${updated} users`, updated > 0 ? 'green' : 'yellow');
  if (notFound > 0) {
    log(`Not found/Failed: ${notFound} users`, 'yellow');
  }
  log('========================================', 'blue');
  console.log('');

  rl.close();
}

main().catch((error) => {
  log(`Error: ${error.message}`, 'red');
  rl.close();
  process.exit(1);
});

