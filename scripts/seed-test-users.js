#!/usr/bin/env node

/**
 * Seed Test Users Script
 * Creates test accounts for all roles with password "abc123123"
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

// Get database config from environment or .env file
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

function executeSQL(config, sql) {
  try {
    const env = { ...process.env };
    if (config.password) {
      env.PGPASSWORD = config.password;
    }

    // Use -q flag to suppress command echo and result messages
    // Use -t -A for tab-separated output without headers
    const result = execSync(
      `psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -q -t -A -c "${sql.replace(/"/g, '\\"')}"`,
      { env, encoding: 'utf8' }
    );
    
    // Extract only the first line (the actual result, not the command message)
    const lines = result.trim().split('\n').filter(line => line.trim() && !line.match(/^(INSERT|UPDATE|DELETE|SELECT)\s+\d+/));
    return lines[0] || result.trim();
  } catch (error) {
    throw new Error(`SQL execution failed: ${error.message}`);
  }
}

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

function hashPasswordSync(password) {
  // Use bcrypt to hash password synchronously
  try {
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    return bcrypt.hashSync(password, saltRounds);
  } catch (error) {
    log('  ⚠ bcrypt error, using simple hash (not secure for production)', 'yellow');
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(password).digest('hex');
  }
}

async function main() {
  log('========================================', 'blue');
  log('Seed Test Users Script', 'blue');
  log('========================================', 'blue');
  console.log('');

  const config = getDbConfig();
  const password = 'abc123123';

  console.log(`Database: ${config.database}`);
  console.log(`User: ${config.user}`);
  console.log(`Host: ${config.host}`);
  console.log(`Port: ${config.port}`);
  console.log('');

  // Get password if not in env
  if (!config.password) {
    config.password = await question('Enter PostgreSQL password: ');
    console.log('');
  }

  // Hash password
  log('Hashing password...', 'cyan');
  const hashedPassword = hashPasswordSync(password);
  log('✓ Password hashed', 'green');
  console.log('');

  // Test users to create
  const testUsers = [
    {
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      phone: '1234567890',
      clinicId: null,
      manufacturerId: null,
    },
    {
      email: 'support@test.com',
      firstName: 'Support',
      lastName: 'User',
      role: 'support',
      phone: '1234567891',
      clinicId: null,
      manufacturerId: null,
    },
    {
      email: 'clinic1@test.com',
      firstName: 'Clinic',
      lastName: 'One',
      role: 'clinic',
      phone: '1234567892',
      clinicId: null, // Will be set after creating clinic
      manufacturerId: null,
    },
    {
      email: 'clinic2@test.com',
      firstName: 'Clinic',
      lastName: 'Two',
      role: 'clinic',
      phone: '1234567893',
      clinicId: null, // Will be set after creating clinic
      manufacturerId: null,
    },
    {
      email: 'manufacturer1@test.com',
      firstName: 'Manufacturer',
      lastName: 'One',
      role: 'manufacturer',
      phone: '1234567894',
      clinicId: null,
      manufacturerId: null, // Will be set after creating manufacturer
    },
    {
      email: 'manufacturer2@test.com',
      firstName: 'Manufacturer',
      lastName: 'Two',
      role: 'manufacturer',
      phone: '1234567895',
      clinicId: null,
      manufacturerId: null, // Will be set after creating manufacturer
    },
  ];

  log('Creating test users...', 'cyan');
  console.log('');

  // Create all test users first
  log('Step 1: Creating test users...', 'yellow');
  const createdUsers = [];

  for (let i = 0; i < testUsers.length; i++) {
    const user = testUsers[i];

    try {
      // Check if user already exists
      const checkSQL = `SELECT id FROM users WHERE email = '${user.email}';`;
      const existing = executeSQL(config, checkSQL);

      if (existing) {
        log(`  ⚠ User ${user.email} already exists, using existing ID...`, 'yellow');
        user.id = existing;
        createdUsers.push({ ...user });
        continue;
      }

      // Create user with snake_case column names (no clinic_id or manufacturer_id yet)
      const userSQL = `
        INSERT INTO users (
          email, password_hash, first_name, last_name, role, phone, 
          clinic_id, manufacturer_id, is_active, is_email_verified, 
          created_at, updated_at
        )
        VALUES (
          '${user.email}',
          '${hashedPassword}',
          '${user.firstName}',
          '${user.lastName}',
          '${user.role}',
          '${user.phone}',
          NULL,
          NULL,
          true,
          true,
          NOW(),
          NOW()
        )
        RETURNING id;
      `;

      const userId = executeSQL(config, userSQL);
      user.id = userId;
      createdUsers.push({ ...user });
      log(`  ✓ Created ${user.role} user: ${user.email} (ID: ${userId})`, 'green');
    } catch (error) {
      log(`  ✗ Failed to create user ${user.email}: ${error.message}`, 'red');
    }
  }

  console.log('');

  // Create clinics for clinic users
  log('Step 2: Creating test clinics...', 'yellow');
  const clinicUsers = createdUsers.filter(u => u.role === 'clinic');

  for (let i = 0; i < clinicUsers.length; i++) {
    const user = clinicUsers[i];
    
    try {
      // Check if clinic already exists for this user
      const checkClinicSQL = `SELECT id FROM clinics WHERE "userId" = '${user.id}';`;
      const existingClinic = executeSQL(config, checkClinicSQL);

      if (existingClinic) {
        log(`  ⚠ Clinic already exists for ${user.email}, using existing...`, 'yellow');
        user.clinicId = existingClinic;
        // Update user with clinic_id
        executeSQL(config, `UPDATE users SET clinic_id = '${existingClinic}' WHERE id = '${user.id}';`);
        continue;
      }

      // Create clinic with user's ID
      const clinicSQL = `
        INSERT INTO clinics (
          "userId", "clinicName", "licenseNumber", address, city, state, pincode, country, 
          phone, "approvalStatus", "isVerified", "createdAt", "updatedAt"
        )
        VALUES (
          '${user.id}',
          'Test Clinic ${i + 1}',
          'CLINIC-LIC-${i + 1}',
          '123 Test Street',
          'Mumbai',
          'Maharashtra',
          '400001',
          'India',
          '${user.phone}',
          'approved',
          true,
          NOW(),
          NOW()
        )
        RETURNING id;
      `;

      const clinicId = executeSQL(config, clinicSQL);
      user.clinicId = clinicId;
      
      // Update user with clinic_id
      executeSQL(config, `UPDATE users SET clinic_id = '${clinicId}' WHERE id = '${user.id}';`);
      
      log(`  ✓ Created clinic for ${user.email} (Clinic ID: ${clinicId})`, 'green');
    } catch (error) {
      log(`  ✗ Failed to create clinic for ${user.email}: ${error.message}`, 'red');
    }
  }

  console.log('');

  // Create manufacturers for manufacturer users
  log('Step 3: Creating test manufacturers...', 'yellow');
  const manufacturerUsers = createdUsers.filter(u => u.role === 'manufacturer');

  for (let i = 0; i < manufacturerUsers.length; i++) {
    const user = manufacturerUsers[i];
    
    try {
      // Check if manufacturer already exists for this user
      const checkMfgSQL = `SELECT id FROM manufacturers WHERE "userId" = '${user.id}';`;
      const existingMfg = executeSQL(config, checkMfgSQL);

      if (existingMfg) {
        log(`  ⚠ Manufacturer already exists for ${user.email}, using existing...`, 'yellow');
        user.manufacturerId = existingMfg;
        // Update user with manufacturer_id
        executeSQL(config, `UPDATE users SET manufacturer_id = '${existingMfg}' WHERE id = '${user.id}';`);
        continue;
      }

      // Create manufacturer with user's ID
      const manufacturerSQL = `
        INSERT INTO manufacturers (
          "userId", "companyName", gstin, "licenseNumber", address, city, state, pincode, country,
          phone, "approvalStatus", "isVerified", "commissionRate", "createdAt", "updatedAt"
        )
        VALUES (
          '${user.id}',
          'Test Manufacturer ${i + 1}',
          'GSTIN${i + 1}123456789',
          'MFG-LIC-${i + 1}',
          '456 Test Avenue',
          'Delhi',
          'Delhi',
          '110001',
          'India',
          '${user.phone}',
          'approved',
          true,
          5.0,
          NOW(),
          NOW()
        )
        RETURNING id;
      `;

      const manufacturerId = executeSQL(config, manufacturerSQL);
      user.manufacturerId = manufacturerId;
      
      // Update user with manufacturer_id
      executeSQL(config, `UPDATE users SET manufacturer_id = '${manufacturerId}' WHERE id = '${user.id}';`);
      
      log(`  ✓ Created manufacturer for ${user.email} (Manufacturer ID: ${manufacturerId})`, 'green');
    } catch (error) {
      log(`  ✗ Failed to create manufacturer for ${user.email}: ${error.message}`, 'red');
    }
  }

  console.log('');
  log('========================================', 'blue');
  log('Summary', 'blue');
  log('========================================', 'blue');
  console.log('');

  const clinicCount = createdUsers.filter(u => u.clinicId).length;
  const mfgCount = createdUsers.filter(u => u.manufacturerId).length;
  
  log(`✓ Created ${createdUsers.length} test users`, 'green');
  log(`✓ Created ${clinicCount} test clinics`, 'green');
  log(`✓ Created ${mfgCount} test manufacturers`, 'green');
  console.log('');

  log('Test Accounts Created:', 'cyan');
  console.log('');
  createdUsers.forEach((user) => {
    log(`  Email: ${user.email}`, 'yellow');
    log(`    Role: ${user.role}`, 'yellow');
    log(`    Password: ${password}`, 'yellow');
    if (user.clinicId) {
      log(`    Clinic ID: ${user.clinicId}`, 'yellow');
    }
    if (user.manufacturerId) {
      log(`    Manufacturer ID: ${user.manufacturerId}`, 'yellow');
    }
    console.log('');
  });

  log('All users have the same password: abc123123', 'green');
  console.log('');

  log('Next Steps:', 'cyan');
  log('1. Test login with any of these accounts', 'yellow');
  log('2. Use clinic accounts to test HMS features', 'yellow');
  log('3. Use manufacturer accounts to test marketplace features', 'yellow');
  console.log('');

  rl.close();
}

main().catch((error) => {
  log(`Error: ${error.message}`, 'red');
  rl.close();
  process.exit(1);
});
