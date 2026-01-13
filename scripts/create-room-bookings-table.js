const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ayurlahi',
});

async function createRoomBookingsTable() {
    const client = await pool.connect();
    try {
        console.log('Creating room_bookings table...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS room_bookings (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                "clinicId" UUID NOT NULL,
                "patientId" UUID NOT NULL,
                "roomId" UUID NOT NULL,
                "packageId" UUID,
                "checkInDate" DATE NOT NULL,
                "checkOutDate" DATE NOT NULL,
                "totalPrice" DECIMAL(10, 2) NOT NULL,
                "advancePaid" DECIMAL(10, 2) DEFAULT 0,
                status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED')),
                notes TEXT,
                "bookingDate" TIMESTAMP,
                "admissionId" UUID,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_booking_clinic FOREIGN KEY ("clinicId") REFERENCES clinics(id) ON DELETE CASCADE,
                CONSTRAINT fk_booking_patient FOREIGN KEY ("patientId") REFERENCES patients(id) ON DELETE CASCADE,
                CONSTRAINT fk_booking_room FOREIGN KEY ("roomId") REFERENCES rooms(id) ON DELETE CASCADE,
                CONSTRAINT fk_booking_package FOREIGN KEY ("packageId") REFERENCES treatment_packages(id) ON DELETE SET NULL
            );
        `);

        console.log('✅ room_bookings table created successfully!');
    } catch (error) {
        if (error.code === '42P07') {
            console.log('ℹ️  Table already exists');
        } else {
            console.error('❌ Error creating table:', error.message);
            throw error;
        }
    } finally {
        client.release();
        await pool.end();
    }
}

createRoomBookingsTable()
    .then(() => {
        console.log('Migration completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
