#!/usr/bin/env node

/**
 * Seed Test Users Script for MediLink
 * Creates test accounts for all roles with password "Test@123"
 * Updated for MediLink organization structure
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Database configuration
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
    user: process.env.DB_USERNAME || process.env.USER || 'postgres',
    database: process.env.DB_NAME || 'ayurlahi',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    password: process.env.DB_PASSWORD || '',
  };
}

// Common password for all test users
const COMMON_PASSWORD = 'Test@123';
const SALT_ROUNDS = 10;

// Test users configuration
const testUsers = [
  {
    email: 'admin@medilink.com',
    password: COMMON_PASSWORD,
    role: 'admin',
    firstName: 'Admin',
    lastName: 'User',
    organization: {
      name: 'MediLink Admin',
      type: 'admin',
      description: 'System Administration Organization'
    }
  },
  {
    email: 'clinic@medilink.com',
    password: COMMON_PASSWORD,
    role: 'clinic',
    firstName: 'Clinic',
    lastName: 'Manager',
    organization: {
      name: 'Test Ayurvedic Clinic',
      type: 'clinic',
      description: 'Test healthcare clinic for development'
    }
  },
  {
    email: 'manufacturer@medilink.com',
    password: COMMON_PASSWORD,
    role: 'manufacturer',
    firstName: 'Manufacturer',
    lastName: 'Manager',
    organization: {
      name: 'Test Ayurvedic Manufacturer',
      type: 'manufacturer',
      description: 'Test manufacturer for development'
    }
  },
  {
    email: 'support@medilink.com',
    password: COMMON_PASSWORD,
    role: 'support',
    firstName: 'Support',
    lastName: 'Staff',
    organization: {
      name: 'MediLink Support',
      type: 'support',
      description: 'Customer support organization'
    }
  }
];

async function seedTestUsers() {
  const config = getDbConfig();
  const client = new Client(config);

  try {
    console.log('\n🔌 Connecting to database...');
    console.log(`   Database: ${config.database}`);
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   User: ${config.user}\n`);

    await client.connect();
    console.log('✅ Connected to database\n');

    // Hash the common password once
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(COMMON_PASSWORD, SALT_ROUNDS);
    console.log('✅ Password hashed\n');

    const createdAccounts = [];

    for (const userData of testUsers) {
      console.log(`\n📝 Creating account for: ${userData.email}`);

      try {
        // Check if user already exists
        const existingUser = await client.query(
          'SELECT id, email FROM users WHERE email = $1',
          [userData.email]
        );

        if (existingUser.rows.length > 0) {
          console.log(`⚠️  User ${userData.email} already exists, skipping...`);
          continue;
        }

        // Create organization
        console.log(`  📁 Creating organization: ${userData.organization.name}`);
        const orgResult = await client.query(
          `INSERT INTO organisations (name, type, description, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, true, NOW(), NOW())
           RETURNING id, name`,
          [userData.organization.name, userData.organization.type, userData.organization.description]
        );
        const organizationId = orgResult.rows[0].id;
        console.log(`  ✅ Organization created: ${orgResult.rows[0].name}`);

        // Create user
        console.log(`  👤 Creating user: ${userData.email}`);
        const userResult = await client.query(
          `INSERT INTO users (
            email, password, first_name, last_name, role,
            is_active, is_email_verified, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, true, true, NOW(), NOW())
          RETURNING id, email, first_name, last_name, role`,
          [userData.email, hashedPassword, userData.firstName, userData.lastName, userData.role]
        );
        const userId = userResult.rows[0].id;
        console.log(`  ✅ User created: ${userResult.rows[0].email}`);

        // Link user to organization
        console.log(`  🔗 Linking user to organization...`);
        await client.query(
          `INSERT INTO organisation_users (
            organisation_id, user_id, role, is_active, created_at, updated_at
          )
          VALUES ($1, $2, $3, true, NOW(), NOW())`,
          [organizationId, userId, 'owner']
        );
        console.log(`  ✅ User linked to organization`);

        createdAccounts.push({
          email: userData.email,
          password: COMMON_PASSWORD,
          role: userData.role,
          name: `${userData.firstName} ${userData.lastName}`,
          organization: userData.organization.name,
          organizationId: organizationId,
          userId: userId
        });

        console.log(`✅ Successfully created account: ${userData.email}`);
      } catch (error) {
        console.error(`❌ Error creating ${userData.email}:`, error.message);
      }
    }

    // Display summary
    console.log('\n\n' + '='.repeat(70));
    console.log('🎉 TEST ACCOUNTS CREATED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log('\n📋 Login Credentials:\n');

    createdAccounts.forEach((account, index) => {
      console.log(`${index + 1}. ${account.role.toUpperCase()} ACCOUNT`);
      console.log(`   Email:        ${account.email}`);
      console.log(`   Password:     ${account.password}`);
      console.log(`   Name:         ${account.name}`);
      console.log(`   Organization: ${account.organization}`);
      console.log(`   User ID:      ${account.userId}`);
      console.log(`   Org ID:       ${account.organizationId}`);
      console.log('');
    });

    console.log('='.repeat(70));
    console.log('🌐 Frontend URL: http://localhost:5173');
    console.log('🔧 Backend URL:  http://localhost:3000');
    console.log('='.repeat(70));

    // Save credentials to file
    const credentialsContent = `# Test User Credentials

**⚠️ FOR DEVELOPMENT/TESTING ONLY - DO NOT USE IN PRODUCTION**

## Common Password
All test accounts use the password: \`${COMMON_PASSWORD}\`

## Test Accounts

${createdAccounts.map((account, index) => `
### ${index + 1}. ${account.role.toUpperCase()} Account
- **Email**: \`${account.email}\`
- **Password**: \`${account.password}\`
- **Name**: ${account.name}
- **Organization**: ${account.organization}
- **Role**: ${account.role}
- **User ID**: ${account.userId}
- **Organization ID**: ${account.organizationId}
`).join('\n')}

## Quick Login

1. Navigate to: http://localhost:5173
2. Use any of the email addresses above
3. Password: \`${COMMON_PASSWORD}\`

## API Testing

You can use these credentials to test API endpoints:

\`\`\`bash
# Login example
curl -X POST http://localhost:3000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "admin@medilink.com", "password": "${COMMON_PASSWORD}"}'
\`\`\`

## Account Details

| Email | Role | Organization | Password |
|-------|------|--------------|----------|
${createdAccounts.map(acc => `| ${acc.email} | ${acc.role} | ${acc.organization} | \`${acc.password}\` |`).join('\n')}

---
*Generated on: ${new Date().toLocaleString()}*
*Script: seed-test-users.js*
`;

    const credPath = path.join(__dirname, '..', 'TEST_CREDENTIALS.md');
    fs.writeFileSync(credPath, credentialsContent);
    console.log(`\n📄 Credentials saved to: TEST_CREDENTIALS.md\n`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed\n');
  }
}

// Run the seeding script
seedTestUsers()
  .then(() => {
    console.log('✅ Seeding completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
