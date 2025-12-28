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

async function diagnose() {
    const client = new Client(config);

    try {
        await client.connect();
        console.log('Connected to database');

        const res = await client.query("SELECT email, password_hash, role, is_active FROM users WHERE email = 'admin@test.com'");

        if (res.rows.length === 0) {
            console.log('User admin@test.com NOT FOUND');
            return;
        }

        const user = res.rows[0];
        console.log('User found:', user.email);
        console.log('Role:', user.role);
        console.log('Is Active:', user.is_active);
        console.log('Password Hash:', user.password_hash);
        console.log('Hash Length:', user.password_hash.length);

        const isBcrypt = user.password_hash.startsWith('$2');
        console.log('Is Bcrypt format?', isBcrypt);

        if (isBcrypt) {
            console.log('Attempting to compare password "abc123123"...');
            const match = await bcrypt.compare('abc123123', user.password_hash);
            console.log('Password valid:', match);
        } else {
            console.log('WARNING: Hash does not look like bcrypt. It might be SHA256 or plain text.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

diagnose();
