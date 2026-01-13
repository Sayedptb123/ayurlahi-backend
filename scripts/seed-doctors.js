const { Client } = require('pg');

async function seedDoctors() {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        user: process.env.DB_USERNAME || process.env.USER || 'sayedsuhailk',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'ayurlahi',
    });

    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        // Get the first organisation
        const orgResult = await client.query('SELECT id FROM organisations LIMIT 1');

        if (orgResult.rows.length === 0) {
            console.log('❌ No organisations found. Please create an organisation first.');
            return;
        }

        const organisationId = orgResult.rows[0].id;
        console.log(`📋 Using organisation ID: ${organisationId}\n`);

        // Sample doctors data
        const doctors = [
            {
                firstName: 'Dr. Rajesh',
                lastName: 'Kumar',
                email: 'rajesh.kumar@clinic.com',
                phone: '+91 98765 43210',
                specialization: 'General Physician',
            },
            {
                firstName: 'Dr. Priya',
                lastName: 'Sharma',
                email: 'priya.sharma@clinic.com',
                phone: '+91 98765 43211',
                specialization: 'Ayurvedic Specialist',
            },
            {
                firstName: 'Dr. Amit',
                lastName: 'Patel',
                email: 'amit.patel@clinic.com',
                phone: '+91 98765 43212',
                specialization: 'Panchakarma Expert',
            },
        ];

        console.log('👨‍⚕️ Adding 3 doctors to staff table...\n');

        for (const doctor of doctors) {
            const result = await client.query(
                `INSERT INTO staff (
          organisation_id,
          first_name,
          last_name,
          email,
          phone,
          position,
          specialization,
          is_active,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, first_name, last_name, email, specialization`,
                [
                    organisationId,
                    doctor.firstName,
                    doctor.lastName,
                    doctor.email,
                    doctor.phone,
                    'doctor',
                    doctor.specialization,
                    true,
                ]
            );

            console.log(`✅ Added: ${result.rows[0].first_name} ${result.rows[0].last_name} (${result.rows[0].specialization})`);
        }

        console.log('\n🎉 Successfully added 3 doctors to staff table!');

        // Verify
        const verifyResult = await client.query(
            "SELECT COUNT(*) as count FROM staff WHERE position = 'doctor'"
        );
        console.log(`\n📊 Total doctors in staff table: ${verifyResult.rows[0].count}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

seedDoctors();
