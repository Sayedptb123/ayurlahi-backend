const { Client } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ayurlahi',
};

async function fixPasswords() {
    const client = new Client(config);

    try {
        await client.connect();
        console.log('Connected to database');

        const password = 'abc123123';
        console.log(`hashing password: ${password}`);

        // Generate valid bcrypt hash
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        console.log('Generated Hash:', hash);
        console.log('Hash Length:', hash.length);

        // Update all test users
        const testEmails = [
            'admin@test.com',
            'support@test.com',
            'clinic1@test.com',
            'clinic2@test.com',
            'manufacturer1@test.com',
            'manufacturer2@test.com'
        ];

        for (const email of testEmails) {
            console.log(`Updating password for ${email}...`);
            await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, email]);
        }

        console.log('All passwords updated successfully.');

        // Verify for admin
        const res = await client.query("SELECT password_hash FROM users WHERE email = 'admin@test.com'");
        const savedHash = res.rows[0].password_hash;
        console.log('Saved Hash:', savedHash);

        const match = await bcrypt.compare(password, savedHash);
        console.log('Verification check:', match ? 'PASSED' : 'FAILED');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

fixPasswords();
