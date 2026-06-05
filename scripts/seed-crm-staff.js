/*
 * seed-crm-staff.js
 * -----------------
 * Creates Sales CRM staff (telecallers, field staff, team lead, sales manager)
 * as members of the AYURLAHI_TEAM org so leads can be assigned and role
 * isolation tested. Idempotent: skips users that already exist (by email).
 *
 *   node scripts/seed-crm-staff.js
 *
 * Reads DB_* from ayurlahi-backend/.env. Password for all = abc123123.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

function loadEnv() {
  const out = {};
  for (const line of fs.readFileSync(path.resolve(__dirname, '..', '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

const PASSWORD = 'abc123123';
const STAFF = [
  { firstName: 'Sales',    lastName: 'Manager',    email: 'sales.manager@ayurlahi.com', phone: '9000010001', role: 'SALES_MANAGER' },
  { firstName: 'Tele',     lastName: 'Caller One',  email: 'telecaller1@ayurlahi.com',   phone: '9000010002', role: 'TELECALLER' },
  { firstName: 'Tele',     lastName: 'Caller Two',  email: 'telecaller2@ayurlahi.com',   phone: '9000010003', role: 'TELECALLER' },
  { firstName: 'Field',    lastName: 'Rep One',     email: 'field1@ayurlahi.com',        phone: '9000010004', role: 'FIELD_STAFF' },
  { firstName: 'Team',     lastName: 'Lead',        email: 'teamlead@ayurlahi.com',      phone: '9000010005', role: 'TEAM_LEAD' },
];

async function main() {
  const env = loadEnv();
  const client = new Client({
    host: env.DB_HOST, port: parseInt(env.DB_PORT || '5432', 10),
    user: env.DB_USERNAME, password: env.DB_PASSWORD, database: env.DB_NAME,
    ssl: (env.DB_SSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  console.log(`🔌 Connected to ${env.DB_HOST}/${env.DB_NAME}`);

  const org = await client.query(
    `SELECT id, name FROM organisations WHERE type='AYURLAHI_TEAM' AND deleted_at IS NULL ORDER BY created_at LIMIT 1`,
  );
  if (org.rowCount === 0) { console.error('❌ No AYURLAHI_TEAM org found.'); process.exit(1); }
  const orgId = org.rows[0].id;
  console.log(`🏢 Team org: ${org.rows[0].name} (${orgId})\n`);

  const hash = await bcrypt.hash(PASSWORD, 10);

  for (const s of STAFF) {
    // user (by email)
    let u = await client.query(`SELECT id FROM users WHERE email=$1`, [s.email]);
    let userId;
    if (u.rowCount > 0) {
      userId = u.rows[0].id;
      console.log(`= user exists: ${s.email}`);
    } else {
      const ins = await client.query(
        `INSERT INTO users (first_name,last_name,phone,email,password_hash,is_active,is_email_verified)
         VALUES ($1,$2,$3,$4,$5,true,true) RETURNING id`,
        [s.firstName, s.lastName, s.phone, s.email, hash],
      );
      userId = ins.rows[0].id;
      console.log(`+ created user: ${s.email}`);
    }

    // membership (by user+org)
    const m = await client.query(
      `SELECT id FROM organisation_users WHERE user_id=$1 AND organisation_id=$2`,
      [userId, orgId],
    );
    if (m.rowCount > 0) {
      await client.query(`UPDATE organisation_users SET role=$1, is_active=true, deleted_at=NULL WHERE id=$2`, [s.role, m.rows[0].id]);
      console.log(`  ↳ membership updated → ${s.role}`);
    } else {
      await client.query(
        `INSERT INTO organisation_users (user_id, organisation_id, role, is_active, is_primary)
         VALUES ($1,$2,$3,true,false)`,
        [userId, orgId, s.role],
      );
      console.log(`  ↳ membership created → ${s.role}`);
    }
  }

  console.log('\n✅ Done. Login with any of these (password: abc123123):');
  STAFF.forEach((s) => console.log(`   ${s.email.padEnd(34)} ${s.role}`));
  await client.end();
}

main().catch((e) => { console.error('❌ Seed failed:', e.message); process.exit(1); });
