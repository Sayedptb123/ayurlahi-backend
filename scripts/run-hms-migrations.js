#!/usr/bin/env node

/**
 * HMS Migration Runner (Node.js version)
 * Alternative to shell script for cross-platform compatibility
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Get database config from environment or .env file
function getDbConfig() {
  // Try to load .env file
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

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function runMigration(config, migrationFile) {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const filePath = path.join(migrationsDir, migrationFile);

  if (!fs.existsSync(filePath)) {
    log(`Error: Migration file not found: ${filePath}`, 'red');
    return false;
  }

  log(`Running: ${migrationFile}`, 'yellow');

  try {
    const env = { ...process.env };
    if (config.password) {
      env.PGPASSWORD = config.password;
    }

    execSync(
      `psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -f "${filePath}"`,
      {
        env,
        stdio: 'inherit',
      }
    );
    log(`✓ Success: ${migrationFile}`, 'green');
    return true;
  } catch (error) {
    log(`✗ Failed: ${migrationFile}`, 'red');
    return false;
  }
}

async function verifyTables(config) {
  try {
    const env = { ...process.env };
    if (config.password) {
      env.PGPASSWORD = config.password;
    }

    const query = `
      SELECT COUNT(*) 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'patients', 'doctors', 'appointments', 'medical_records',
        'prescriptions', 'prescription_items', 'lab_reports', 'lab_tests',
        'patient_bills', 'bill_items'
      );
    `;

    const result = execSync(
      `psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -t -c "${query}"`,
      { env, encoding: 'utf8' }
    );

    const count = parseInt(result.trim(), 10);
    return count;
  } catch (error) {
    return 0;
  }
}

async function main() {
  log('========================================', 'green');
  log('HMS Database Migration Runner', 'green');
  log('========================================', 'green');
  console.log('');

  const config = getDbConfig();

  console.log(`Database: ${config.database}`);
  console.log(`User: ${config.user}`);
  console.log(`Host: ${config.host}`);
  console.log(`Port: ${config.port}`);
  console.log('');

  // Check if psql is available
  try {
    execSync('which psql', { stdio: 'ignore' });
  } catch (error) {
    log('Error: psql command not found', 'red');
    log('Please install PostgreSQL client tools', 'red');
    process.exit(1);
  }

  // Get password if not in env
  if (!config.password) {
    config.password = await question('Enter PostgreSQL password: ');
    console.log('');
  }

  // Confirm
  const confirm = await question('Do you want to proceed with migrations? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    log('Migration cancelled.', 'yellow');
    rl.close();
    return;
  }

  // Migration files in order
  const migrations = [
    '001-create-hms-patients-table.sql',
    '002-create-hms-doctors-table.sql',
    '003-create-hms-appointments-table.sql',
    '004-create-hms-medical-records-table.sql',
    '005-create-hms-prescriptions-tables.sql',
    '006-create-hms-lab-reports-tables.sql',
    '007-create-hms-patient-billing-tables.sql',
  ];

  console.log('');
  log('Starting migrations...', 'yellow');
  console.log('');

  // Run each migration
  for (const migration of migrations) {
    const success = await runMigration(config, migration);
    if (!success) {
      log('\nMigration failed. Please check the error above.', 'red');
      rl.close();
      process.exit(1);
    }
  }

  console.log('');
  log('========================================', 'green');
  log('All migrations completed successfully!', 'green');
  log('========================================', 'green');
  console.log('');

  // Verify tables
  log('Verifying tables...', 'yellow');
  const tableCount = await verifyTables(config);
  if (tableCount === 10) {
    log('✓ All 10 HMS tables created successfully!', 'green');
  } else {
    log(`⚠ Found ${tableCount} tables (expected 10)`, 'yellow');
  }

  console.log('');
  console.log('Next steps:');
  console.log('1. Start the server: npm run start:dev');
  console.log('2. Test API endpoints with Postman or curl');
  console.log('3. Verify data flow through the system');

  rl.close();
}

main().catch((error) => {
  log(`Error: ${error.message}`, 'red');
  rl.close();
  process.exit(1);
});



