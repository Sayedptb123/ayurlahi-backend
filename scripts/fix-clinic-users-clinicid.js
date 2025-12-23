#!/usr/bin/env node

/**
 * Fix Clinic Users - Assign Clinic ID
 * Updates existing clinic users to have a clinicId
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
      const config = {};
      envContent.split('\n').forEach((line) => {
        const [key, ...values] = line.split('=');
        if (key && values.length > 0) {
          config[key.trim()] = values.join('=').trim();
        }
      });
      return {
        user: config.DB_USERNAME || 'postgres',
        database: config.DB_NAME || 'ayurlahi',
        host: config.DB_HOST || 'localhost',
        port: config.DB_PORT || '5432',
        password: config.DB_PASSWORD || '',
      };
    }
  } catch (error) {
    // Ignore
  }
  return {
    user: 'postgres',
    database: 'ayurlahi',
    host: 'localhost',
    port: '5432',
    password: '',
  };
}

async function getClinicId(config) {
  try {
    const env = { ...process.env };
    if (config.password) {
      env.PGPASSWORD = config.password;
    }

    const result = execSync(
      `psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -t -c "SELECT id FROM clinics LIMIT 1;"`,
      { env, encoding: 'utf8' }
    );

    return result.trim() || null;
  } catch (error) {
    return null;
  }
}

async function updateClinicUsers(clinicId, config) {
  try {
    const sql = `
      UPDATE users 
      SET "clinicId" = '${clinicId}'
      WHERE role = 'clinic' 
        AND "clinicId" IS NULL
        AND email LIKE '%@test.ayurlahi.com';
      
      SELECT email, "firstName", "lastName", "clinicId" 
      FROM users 
      WHERE role = 'clinic' 
        AND email LIKE '%@test.ayurlahi.com';
    `;

    const sqlFile = path.join(__dirname, '..', 'temp_fix_clinic.sql');
    fs.writeFileSync(sqlFile, sql);

    const env = { ...process.env };
    if (config.password) {
      env.PGPASSWORD = config.password;
    }

    const result = execSync(
      `psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -f "${sqlFile}" -t`,
      { env, encoding: 'utf8' }
    );

    // Clean up
    try {
      fs.unlinkSync(sqlFile);
    } catch (e) {
      // Ignore
    }

    return result.trim();
  } catch (error) {
    return null;
  }
}

async function main() {
  log('========================================', 'blue');
  log('Fix Clinic Users - Assign Clinic ID', 'blue');
  log('========================================', 'blue');
  console.log('');

  const dbConfig = getDbConfig();
  
  // Get clinic ID
  const clinicId = await getClinicId(dbConfig);
  if (!clinicId) {
    log('✗ No clinic found. Please create a clinic first.', 'red');
    process.exit(1);
  }

  log(`✓ Found clinic ID: ${clinicId}`, 'green');
  console.log('');

  // Update clinic users
  log('Updating clinic users...', 'cyan');
  const result = await updateClinicUsers(clinicId, dbConfig);
  
  if (result) {
    log('✓ Clinic users updated successfully!', 'green');
    console.log('');
    log('Updated users:', 'cyan');
    const lines = result.trim().split('\n').filter(l => l.trim());
    lines.forEach((line) => {
      const parts = line.split('|');
      if (parts.length >= 4) {
        log(`  - ${parts[0].trim()} (${parts[1].trim()} ${parts[2].trim()})`, 'yellow');
      }
    });
  } else {
    log('⚠ Could not update clinic users', 'yellow');
  }

  console.log('');
  log('Next: Test again with:', 'cyan');
  log('  npm run test:hms:users', 'yellow');
  console.log('');
}

main().catch((error) => {
  log(`Error: ${error.message}`, 'red');
  process.exit(1);
});

