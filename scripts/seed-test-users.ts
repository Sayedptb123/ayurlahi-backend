import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userRepository = app.get<Repository<User>>(getRepositoryToken(User));

  const password = 'abc123123';
  const hashedPassword = await bcrypt.hash(password, 10);

  const testUsers = [
    {
      email: 'admin@test.com',
      passwordHash: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin' as const,
      phone: '1234567890',
      isActive: true,
      isEmailVerified: true,
    },
    {
      email: 'support@test.com',
      passwordHash: hashedPassword,
      firstName: 'Support',
      lastName: 'User',
      role: 'support' as const,
      phone: '1234567891',
      isActive: true,
      isEmailVerified: true,
    },
    {
      email: 'clinic@test.com',
      passwordHash: hashedPassword,
      firstName: 'Clinic',
      lastName: 'User',
      role: 'clinic' as const,
      phone: '1234567892',
      isActive: true,
      isEmailVerified: true,
    },
    {
      email: 'manufacturer@test.com',
      passwordHash: hashedPassword,
      firstName: 'Manufacturer',
      lastName: 'User',
      role: 'manufacturer' as const,
      phone: '1234567893',
      isActive: true,
      isEmailVerified: true,
    },
  ];

  console.log('Creating test users...');
  console.log('');

  for (const userData of testUsers) {
    try {
      // Check if user already exists
      const existingUser = await userRepository.findOne({
        where: { email: userData.email },
      });

      if (existingUser) {
        console.log(`⚠ User ${userData.email} already exists. Skipping...`);
        continue;
      }

      // Create user - new structure (no role, clinicId, manufacturerId - those are in organisation_users)
      const user = userRepository.create({
        email: userData.email,
        passwordHash: userData.passwordHash, // Maps to password_hash column
        firstName: userData.firstName, // Maps to first_name column
        lastName: userData.lastName, // Maps to last_name column
        phone: userData.phone,
        isActive: userData.isActive, // Maps to is_active column
        isEmailVerified: userData.isEmailVerified, // Maps to is_email_verified column
      });

      const savedUser = await userRepository.save(user);

      console.log(`✅ Created user: ${userData.email} (ID: ${savedUser.id})`);
    } catch (error) {
      console.error(`✗ Failed to create user ${userData.email}:`, error.message);
    }
  }

  console.log('');
  console.log('========================================');
  console.log('Test Users Created Successfully!');
  console.log('========================================');
  console.log('');
  console.log('All users have password: abc123123');
  console.log('');
  console.log('Test Accounts:');
  console.log('  - admin@test.com (Admin)');
  console.log('  - support@test.com (Support)');
  console.log('  - clinic@test.com (Clinic)');
  console.log('  - manufacturer@test.com (Manufacturer)');
  console.log('');

  await app.close();
}

bootstrap().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

