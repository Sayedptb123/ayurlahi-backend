import { DataSource } from 'typeorm';
import { config } from 'dotenv';
config();

async function updateSchema() {
    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'medilink',
        synchronize: false,
    });

    await dataSource.initialize();
    console.log('Database connected.');

    // 1. Add whatsapp_number to users
    console.log('Adding whatsapp_number to users table...');
    try {
        await dataSource.query(`
            ALTER TABLE "users" 
            ADD COLUMN IF NOT EXISTS "whatsapp_number" varchar(20);
        `);
        console.log('- Success or already exists.');
    } catch (error) {
        console.error('- Failed:', error.message);
    }

    // 2. Add is_active to organisation_users
    console.log('Adding is_active to organisation_users table...');
    try {
        await dataSource.query(`
            ALTER TABLE "organisation_users" 
            ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
        `);
        console.log('- Success or already exists.');
    } catch (error) {
        console.error('- Failed:', error.message);
    }

    console.log('\nSchema update complete!');
    await dataSource.destroy();
}

updateSchema().catch((error) => {
    console.error('Error updating schema:', error);
    process.exit(1);
});
