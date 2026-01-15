import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { Organisation } from '../src/organisations/entities/organisation.entity';
import { OrganisationUser } from '../src/organisation-users/entities/organisation-user.entity';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

interface TestOrganisation {
    name: string;
    type: 'CLINIC' | 'MANUFACTURER';
    clinicName?: string;
    companyName?: string;
    licenseNumber?: string;
    gstin?: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    whatsappNumber?: string;
    commissionRate?: number;
}

interface TestUser {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    role: 'SUPER_ADMIN' | 'SUPPORT' | 'OWNER' | 'MANAGER' | 'STAFF';
    organisationName?: string; // Name of the organisation to link to
}

async function bootstrap() {
    console.log('🚀 Starting Enhanced Test Data Seeding...\n');

    const app = await NestFactory.createApplicationContext(AppModule);

    const userRepository = app.get<Repository<User>>(getRepositoryToken(User));
    const organisationRepository = app.get<Repository<Organisation>>(getRepositoryToken(Organisation));
    const organisationUserRepository = app.get<Repository<OrganisationUser>>(getRepositoryToken(OrganisationUser));

    const password = 'abc123123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Define test organisations
    const testOrganisations: TestOrganisation[] = [
        {
            name: 'Ayurveda Wellness Clinic',
            type: 'CLINIC',
            clinicName: 'Ayurveda Wellness Clinic',
            licenseNumber: 'AYU-CLINIC-001',
            gstin: '29ABCDE1234F1Z5',
            address: '123 Wellness Street, MG Road',
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: '560001',
            phone: '+919876543210',
            whatsappNumber: '+919876543210',
        },
        {
            name: 'Holistic Ayurveda Center',
            type: 'CLINIC',
            clinicName: 'Holistic Ayurveda Center',
            licenseNumber: 'AYU-CLINIC-002',
            gstin: '27FGHIJ5678K1Z9',
            address: '456 Health Avenue, Koramangala',
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: '560034',
            phone: '+919876543211',
            whatsappNumber: '+919876543211',
        },
        {
            name: 'Ayurvedic Herbs Ltd',
            type: 'MANUFACTURER',
            companyName: 'Ayurvedic Herbs Ltd',
            gstin: '29KLMNO9012P1Z3',
            address: '789 Industrial Area, Peenya',
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: '560058',
            phone: '+919876543212',
            whatsappNumber: '+919876543212',
            commissionRate: 15.00,
        },
        {
            name: 'Natural Remedies Pharma',
            type: 'MANUFACTURER',
            companyName: 'Natural Remedies Pharma',
            gstin: '29QRSTU3456V1Z7',
            address: '321 Pharma Park, Whitefield',
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: '560066',
            phone: '+919876543213',
            whatsappNumber: '+919876543213',
            commissionRate: 12.50,
        },
    ];

    // Define test users
    const testUsers: TestUser[] = [
        // Super Admins (Ayurlahi Team)
        {
            email: 'superadmin1@ayurlahi.com',
            firstName: 'Super',
            lastName: 'Admin One',
            phone: '+919900000001',
            role: 'SUPER_ADMIN',
            organisationName: 'Team Ayurlahi',
        },
        {
            email: 'superadmin2@ayurlahi.com',
            firstName: 'Super',
            lastName: 'Admin Two',
            phone: '+919900000002',
            role: 'SUPER_ADMIN',
            organisationName: 'Team Ayurlahi',
        },
        // Support Users (Ayurlahi Team)
        {
            email: 'support1@ayurlahi.com',
            firstName: 'Support',
            lastName: 'User One',
            phone: '+919900000003',
            role: 'SUPPORT',
            organisationName: 'Team Ayurlahi',
        },
        {
            email: 'support2@ayurlahi.com',
            firstName: 'Support',
            lastName: 'User Two',
            phone: '+919900000004',
            role: 'SUPPORT',
            organisationName: 'Team Ayurlahi',
        },
        // Clinic 1 Users
        {
            email: 'clinic1.owner@test.com',
            firstName: 'Rajesh',
            lastName: 'Kumar',
            phone: '+919900001001',
            role: 'OWNER',
            organisationName: 'Ayurveda Wellness Clinic',
        },
        {
            email: 'clinic1.doctor@test.com',
            firstName: 'Dr. Priya',
            lastName: 'Sharma',
            phone: '+919900001002',
            role: 'STAFF',
            organisationName: 'Ayurveda Wellness Clinic',
        },
        // Clinic 2 Users
        {
            email: 'clinic2.owner@test.com',
            firstName: 'Amit',
            lastName: 'Patel',
            phone: '+919900002001',
            role: 'OWNER',
            organisationName: 'Holistic Ayurveda Center',
        },
        {
            email: 'clinic2.doctor@test.com',
            firstName: 'Dr. Anjali',
            lastName: 'Reddy',
            phone: '+919900002002',
            role: 'STAFF',
            organisationName: 'Holistic Ayurveda Center',
        },
        // Manufacturer 1 Users
        {
            email: 'mfg1.owner@test.com',
            firstName: 'Suresh',
            lastName: 'Gupta',
            phone: '+919900003001',
            role: 'OWNER',
            organisationName: 'Ayurvedic Herbs Ltd',
        },
        {
            email: 'mfg1.manager@test.com',
            firstName: 'Deepak',
            lastName: 'Singh',
            phone: '+919900003002',
            role: 'MANAGER',
            organisationName: 'Ayurvedic Herbs Ltd',
        },
        // Manufacturer 2 Users
        {
            email: 'mfg2.owner@test.com',
            firstName: 'Ramesh',
            lastName: 'Iyer',
            phone: '+919900004001',
            role: 'OWNER',
            organisationName: 'Natural Remedies Pharma',
        },
        {
            email: 'mfg2.manager@test.com',
            firstName: 'Vikram',
            lastName: 'Nair',
            phone: '+919900004002',
            role: 'MANAGER',
            organisationName: 'Natural Remedies Pharma',
        },
    ];

    const createdOrganisations = new Map<string, Organisation>();
    const createdUsers = new Map<string, User>();
    const credentialsData: any[] = [];

    // Step 1: Create Organisations
    console.log('📋 Step 1: Creating Test Organisations...\n');

    // First, get the Ayurlahi Team organisation
    const ayurlahiTeam = await organisationRepository.findOne({
        where: { id: '00000000-0000-0000-0000-000000000001' },
    });

    if (ayurlahiTeam) {
        createdOrganisations.set('Team Ayurlahi', ayurlahiTeam);
        console.log(`✅ Found existing: Team Ayurlahi (ID: ${ayurlahiTeam.id})`);
    } else {
        console.log('⚠️  Warning: Team Ayurlahi organisation not found');
    }

    for (const orgData of testOrganisations) {
        try {
            const existingOrg = await organisationRepository.findOne({
                where: { name: orgData.name },
            });

            if (existingOrg) {
                console.log(`⚠️  Organisation "${orgData.name}" already exists. Skipping...`);
                createdOrganisations.set(orgData.name, existingOrg);
                continue;
            }

            const organisation = organisationRepository.create({
                name: orgData.name,
                type: orgData.type,
                clinicName: orgData.clinicName || null,
                companyName: orgData.companyName || null,
                licenseNumber: orgData.licenseNumber || null,
                gstin: orgData.gstin || null,
                address: orgData.address,
                city: orgData.city,
                state: orgData.state,
                pincode: orgData.pincode,
                phone: orgData.phone,
                whatsappNumber: orgData.whatsappNumber || null,
                country: 'India',
                status: 'active',
                approvalStatus: 'approved',
                isVerified: true,
                approvedAt: new Date(),
                commissionRate: orgData.commissionRate || 0,
            });

            const savedOrg = await organisationRepository.save(organisation);
            createdOrganisations.set(orgData.name, savedOrg);

            console.log(`✅ Created: ${orgData.name} (${orgData.type}) - ID: ${savedOrg.id}`);
        } catch (error) {
            console.error(`✗ Failed to create organisation "${orgData.name}":`, error.message);
        }
    }

    console.log(`\n✅ Organisations created: ${createdOrganisations.size}\n`);

    // Step 2: Create Users
    console.log('👥 Step 2: Creating Test Users...\n');

    for (const userData of testUsers) {
        try {
            const existingUser = await userRepository.findOne({
                where: { email: userData.email },
            });

            if (existingUser) {
                console.log(`⚠️  User "${userData.email}" already exists. Skipping...`);
                createdUsers.set(userData.email, existingUser);
                continue;
            }

            const user = userRepository.create({
                email: userData.email,
                passwordHash: hashedPassword,
                firstName: userData.firstName,
                lastName: userData.lastName,
                phone: userData.phone,
                isActive: true,
                isEmailVerified: true,
            });

            const savedUser = await userRepository.save(user);
            createdUsers.set(userData.email, savedUser);

            console.log(`✅ Created user: ${userData.email} (${userData.firstName} ${userData.lastName})`);

            credentialsData.push({
                email: userData.email,
                password: password,
                name: `${userData.firstName} ${userData.lastName}`,
                role: userData.role,
                organisation: userData.organisationName,
            });
        } catch (error) {
            console.error(`✗ Failed to create user "${userData.email}":`, error.message);
        }
    }

    console.log(`\n✅ Users created: ${createdUsers.size}\n`);

    // Step 3: Create Organisation-User Relationships
    console.log('🔗 Step 3: Creating Organisation-User Relationships...\n');

    let relationshipsCreated = 0;

    for (const userData of testUsers) {
        try {
            const user = createdUsers.get(userData.email);
            const organisation = createdOrganisations.get(userData.organisationName || '');

            if (!user) {
                console.log(`⚠️  User not found: ${userData.email}`);
                continue;
            }

            if (!organisation) {
                console.log(`⚠️  Organisation not found: ${userData.organisationName}`);
                continue;
            }

            // Check if relationship already exists
            const existingRelation = await organisationUserRepository.findOne({
                where: {
                    userId: user.id,
                    organisationId: organisation.id,
                },
            });

            if (existingRelation) {
                console.log(`⚠️  Relationship already exists for ${userData.email} <-> ${userData.organisationName}`);
                continue;
            }

            const organisationUser = organisationUserRepository.create({
                userId: user.id,
                organisationId: organisation.id,
                role: userData.role,
                isPrimary: userData.role === 'OWNER',
                createdBy: user.id,
                permissions: null,
            });

            await organisationUserRepository.save(organisationUser);
            relationshipsCreated++;

            console.log(`✅ Linked: ${userData.email} -> ${userData.organisationName} (${userData.role})`);
        } catch (error) {
            console.error(`✗ Failed to create relationship for "${userData.email}":`, error.message);
        }
    }

    console.log(`\n✅ Relationships created: ${relationshipsCreated}\n`);

    // Step 4: Generate Credentials File
    console.log('📄 Step 4: Generating Credentials File...\n');

    const credentialsContent = `# Test Account Credentials

**⚠️ FOR DEVELOPMENT/TESTING ONLY - DO NOT USE IN PRODUCTION**

## Common Password
All test accounts use the password: \`${password}\`

---

## Test Accounts by Organization

### Ayurlahi Team (Super Admins & Support)

| Email | Name | Role |
|-------|------|------|
${credentialsData
            .filter(c => c.organisation === 'Team Ayurlahi')
            .map(c => `| ${c.email} | ${c.name} | ${c.role} |`)
            .join('\n')}

### Clinic: Ayurveda Wellness Clinic

| Email | Name | Role |
|-------|------|------|
${credentialsData
            .filter(c => c.organisation === 'Ayurveda Wellness Clinic')
            .map(c => `| ${c.email} | ${c.name} | ${c.role} |`)
            .join('\n')}

### Clinic: Holistic Ayurveda Center

| Email | Name | Role |
|-------|------|------|
${credentialsData
            .filter(c => c.organisation === 'Holistic Ayurveda Center')
            .map(c => `| ${c.email} | ${c.name} | ${c.role} |`)
            .join('\n')}

### Manufacturer: Ayurvedic Herbs Ltd

| Email | Name | Role |
|-------|------|------|
${credentialsData
            .filter(c => c.organisation === 'Ayurvedic Herbs Ltd')
            .map(c => `| ${c.email} | ${c.name} | ${c.role} |`)
            .join('\n')}

### Manufacturer: Natural Remedies Pharma

| Email | Name | Role |
|-------|------|------|
${credentialsData
            .filter(c => c.organisation === 'Natural Remedies Pharma')
            .map(c => `| ${c.email} | ${c.name} | ${c.role} |`)
            .join('\n')}

---

## Quick Login

1. Navigate to: http://localhost:5173
2. Use any of the email addresses above
3. Password: \`${password}\`

## API Testing

You can use these credentials to test API endpoints:

\`\`\`bash
# Login example
curl -X POST http://localhost:3000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "superadmin1@ayurlahi.com", "password": "${password}"}'
\`\`\`

---

*Generated on: ${new Date().toLocaleString()}*
*Script: seed-enhanced-test-data.ts*
`;

    const credentialsPath = path.join(__dirname, '..', 'TEST_ACCOUNTS.md');
    fs.writeFileSync(credentialsPath, credentialsContent);

    console.log(`✅ Credentials file created: TEST_ACCOUNTS.md\n`);

    // Summary
    console.log('========================================');
    console.log('✅ Enhanced Test Data Seeding Complete!');
    console.log('========================================\n');
    console.log(`📊 Summary:`);
    console.log(`   - Organisations: ${createdOrganisations.size}`);
    console.log(`   - Users: ${createdUsers.size}`);
    console.log(`   - Relationships: ${relationshipsCreated}`);
    console.log(`   - Password: ${password}\n`);
    console.log(`📄 See TEST_ACCOUNTS.md for complete credentials list\n`);

    await app.close();
}

bootstrap().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});
