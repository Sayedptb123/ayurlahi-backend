const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'sayedsuhailk',
    password: '',
    database: 'medilink',
  });

  try {
    await client.connect();
    console.log('Connected to database');
    await client.query('ALTER TABLE promotions ALTER COLUMN title DROP NOT NULL, ALTER COLUMN body DROP NOT NULL;');
    console.log('Successfully altered columns to drop NOT NULL constraint');
  } catch (err) {
    console.error('Error running migration:', err);
  } finally {
    await client.end();
  }
}

run();
