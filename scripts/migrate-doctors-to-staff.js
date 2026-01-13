// Register ts-node to support TypeScript migrations
require('ts-node/register');
const { DataSource } = require('typeorm');
const path = require('path');

// TypeORM configuration
const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || process.env.USER || 'sayedsuhailk',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'ayurlahi',
    entities: [path.join(__dirname, '../src/**/*.entity{.ts,.js}')],
    migrations: [path.join(__dirname, '../src/migrations/*-MigrateDoctorsToStaff{.ts,.js}')],
    synchronize: false,
    logging: true,
});

async function runMigration() {
    console.log('🚀 Starting Doctor to Staff Migration...\n');

    try {
        // Initialize data source
        await AppDataSource.initialize();
        console.log('✅ Database connection established\n');

        // Get pending migrations
        const pendingMigrations = await AppDataSource.showMigrations();
        console.log(`📋 Pending migrations: ${pendingMigrations ? 'Yes' : 'No'}\n`);

        // Run migrations
        console.log('⏳ Running migration...\n');
        const migrations = await AppDataSource.runMigrations({
            transaction: 'all', // Run all migrations in a single transaction
        });

        if (migrations.length === 0) {
            console.log('ℹ️  No migrations were run (already up to date)\n');
        } else {
            console.log(`✅ Successfully ran ${migrations.length} migration(s):\n`);
            migrations.forEach((migration) => {
                console.log(`   - ${migration.name}`);
            });
            console.log('');
        }

        // Verify migration
        console.log('🔍 Verifying migration...\n');

        const doctorCount = await AppDataSource.query(
            'SELECT COUNT(*) as count FROM doctors'
        );
        const staffDoctorCount = await AppDataSource.query(
            "SELECT COUNT(*) as count FROM staff WHERE position = 'doctor'"
        );
        const appointmentsWithStaffId = await AppDataSource.query(
            'SELECT COUNT(*) as count FROM appointments WHERE "staffId" IS NOT NULL'
        );

        console.log('📊 Migration Statistics:');
        console.log(`   - Doctors in doctors table: ${doctorCount[0].count}`);
        console.log(`   - Doctors in staff table: ${staffDoctorCount[0].count}`);
        console.log(`   - Appointments with staffId: ${appointmentsWithStaffId[0].count}`);
        console.log('');

        if (parseInt(doctorCount[0].count) === parseInt(staffDoctorCount[0].count)) {
            console.log('✅ Migration verification PASSED\n');
        } else {
            console.log('⚠️  Warning: Doctor counts do not match. Please verify manually.\n');
        }

        console.log('🎉 Migration completed successfully!\n');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    } finally {
        await AppDataSource.destroy();
    }
}

async function rollbackMigration() {
    console.log('🔄 Rolling back Doctor to Staff Migration...\n');

    try {
        await AppDataSource.initialize();
        console.log('✅ Database connection established\n');

        console.log('⏳ Rolling back last migration...\n');
        await AppDataSource.undoLastMigration({
            transaction: 'all',
        });

        console.log('✅ Rollback completed successfully!\n');

    } catch (error) {
        console.error('❌ Rollback failed:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    } finally {
        await AppDataSource.destroy();
    }
}

// Check command line arguments
const command = process.argv[2];

if (command === 'rollback') {
    rollbackMigration();
} else {
    runMigration();
}
