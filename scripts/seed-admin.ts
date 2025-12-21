import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/common/enums/role.enum';

// Load environment variables from .env file
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match && !match[1].startsWith('#')) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

async function seedAdmin() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'ayurlahi',
    entities: [__dirname + '/../dist/**/*.entity{.ts,.js}', __dirname + '/../src/**/*.entity{.ts,.js}'],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    const usersRepository = dataSource.getRepository(User);

    // Check if admin already exists
    const existingAdmin = await usersRepository.findOne({
      where: { email: 'admin@ayurlahi.com' },
    });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      console.log('   Email: admin@ayurlahi.com');
      console.log('   ID:', existingAdmin.id);
      await dataSource.destroy();
      return;
    }

    // Generate password hash
    const defaultPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    const passwordHash = await bcrypt.hash(
      defaultPassword,
      parseInt(process.env.BCRYPT_ROUNDS || '10'),
    );

    // Create admin user
    const adminUser = new User();
    adminUser.email = 'admin@ayurlahi.com';
    adminUser.password = passwordHash;
    adminUser.firstName = 'System';
    adminUser.lastName = 'Administrator';
    adminUser.role = UserRole.ADMIN;
    adminUser.isActive = true;
    adminUser.isEmailVerified = true;
    // phone and whatsappNumber are nullable, so we can omit them or set to undefined
    // They will be stored as NULL in the database

    const savedUser = await usersRepository.save(adminUser);

    console.log('✅ Admin user created successfully!');
    console.log('   Email: admin@ayurlahi.com');
    console.log('   Password:', defaultPassword);
    console.log('   ID:', savedUser.id);
    console.log('   Role:', savedUser.role);

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

seedAdmin();

