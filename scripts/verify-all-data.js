#!/usr/bin/env node

require('dotenv').config();
const { execSync } = require('child_process');

const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ayurlahi',
};

function executeSQL(sql) {
    try {
        const env = { ...process.env };
        if (config.password) {
            env.PGPASSWORD = config.password;
        }
        const result = execSync(
            `psql -q -t -A -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -c "${sql}"`,
            { env, encoding: 'utf8' }
        );
        return result.trim();
    } catch (error) {
        // console.error(`Error executing SQL: ${sql}`);
        // console.error(error.message);
        return 'Error';
    }
}

console.log('========================================');
console.log('Data Verification Summary');
console.log('========================================\n');

const tables = ['users', 'clinics', 'manufacturers', 'products', 'orders', 'order_items'];

tables.forEach(table => {
    const count = executeSQL(`SELECT count(*) FROM ${table}`);
    console.log(`${table.padEnd(15)}: ${count}`);
});

console.log('\n----------------------------------------');
console.log('Sample User Data (Email | Role | Password)');
console.log('----------------------------------------');

const users = executeSQL(`SELECT email, role, 'abc123123' as password FROM users ORDER BY role, email`);
const userLines = users.split('\n').filter(l => l.trim());
userLines.forEach(line => {
    console.log(line.split('|').join(' | '));
});

console.log('\n----------------------------------------');
console.log('Sample Product Data (SKU | Name)');
console.log('----------------------------------------');

const products = executeSQL(`SELECT sku, name FROM products LIMIT 5`);
const productLines = products.split('\n').filter(l => l.trim());
productLines.forEach(line => {
    console.log(line.split('|').join(' | '));
});
