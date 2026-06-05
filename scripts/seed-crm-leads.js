/*
 * seed-crm-leads.js
 * -----------------
 * One-time / idempotent import of the scraped Ayurvedic & postnatal centres
 * (Medilink/src/data/ayurvedic_places.json) into the crm_leads table for the
 * AYURLAHI_TEAM organisation. See scope/Medilink_CRM_Final_Brief.md (Step 2).
 *
 *   node scripts/seed-crm-leads.js
 *
 * Idempotent: dedupes by google_place_id in-memory, and the DB INSERT uses
 * ON CONFLICT (organisation_id, google_place_id) DO NOTHING, so re-running
 * only inserts centres that aren't already present.
 *
 * Reads DB_* from ayurlahi-backend/.env (no dotenv dependency).
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// --- read .env manually -----------------------------------------------------
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

// --- field helpers ----------------------------------------------------------
const clip = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);

function inferCentreType(name) {
  const n = (name || '').toLowerCase();
  const postnatal = /postnatal|postpartum|post[\s-]?delivery|maternity|sutika|sootika|prasava|confinement|janani|mother|baby|perinatal|soothika|soothika/;
  if (postnatal.test(n)) return 'postnatal';
  if (/ayurved|ayur\b|ayur /.test(n)) return 'ayurvedic_clinic';
  return null;
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const f = parseFloat(v);
  return Number.isFinite(f) ? f : null;
}

function int(v) {
  const f = num(v);
  return f === null ? null : Math.trunc(f);
}

const LEAD_SOURCE = 'google_maps_scraper';
const BATCH = 400; // 400 rows * 21 cols = 8400 params (< 65535 limit)

const COLS = [
  'organisation_id', 'name', 'centre_type', 'address', 'area', 'city', 'district',
  'state', 'latitude', 'longitude', 'phone', 'website', 'google_maps_url',
  'rating', 'user_ratings_total', 'google_place_id', 'lead_source', 'stage',
  'priority', 'is_incomplete', 'created_at',
];

function rowValues(orgId, p) {
  const phone = clip(p.phone, 30);
  const name = clip(p.name, 255) || 'Unknown centre';
  const district = clip(p.district, 150) || clip(p.city, 150);
  return [
    orgId,
    name,
    inferCentreType(p.name),
    clip(p.address, 5000),
    null,                       // area — not in scraped data
    clip(p.city, 150),
    district,
    clip(p.state, 150),
    num(p.lat),
    num(p.lng),
    phone,
    clip(p.website, 5000),
    clip(p.google_maps_url, 5000),
    (() => { const r = num(p.rating); return r === null ? null : Math.min(r, 9.9); })(),
    int(p.user_ratings_total),
    clip(p.place_id, 255),
    LEAD_SOURCE,
    'new',
    'warm',
    !phone,                     // is_incomplete when no phone (B8)
    new Date(),
  ];
}

async function main() {
  const env = loadEnv();
  const client = new Client({
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || '5432', 10),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: (env.DB_SSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  console.log(`🔌 Connected to ${env.DB_HOST}/${env.DB_NAME}`);

  // resolve the AYURLAHI_TEAM org
  const orgRes = await client.query(
    `SELECT id, name FROM organisations WHERE type = 'AYURLAHI_TEAM' AND deleted_at IS NULL ORDER BY created_at LIMIT 1`,
  );
  if (orgRes.rowCount === 0) {
    console.error('❌ No AYURLAHI_TEAM organisation found. Cannot seed CRM leads.');
    await client.end();
    process.exit(1);
  }
  const orgId = orgRes.rows[0].id;
  console.log(`🏢 AYURLAHI_TEAM org: ${orgRes.rows[0].name} (${orgId})`);

  // load + dedupe by place_id
  const jsonPath = path.resolve(__dirname, '..', '..', 'Medilink', 'src', 'data', 'ayurvedic_places.json');
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const seen = new Set();
  const places = [];
  let noPlaceId = 0;
  for (const p of raw) {
    if (!p.place_id) { noPlaceId++; places.push(p); continue; }
    if (seen.has(p.place_id)) continue;
    seen.add(p.place_id);
    places.push(p);
  }
  console.log(`📄 ${raw.length} scraped rows → ${places.length} after dedupe (${raw.length - places.length} dupes, ${noPlaceId} without place_id)`);

  const before = (await client.query('SELECT COUNT(*)::int AS c FROM crm_leads WHERE organisation_id = $1', [orgId])).rows[0].c;

  let processed = 0;
  for (let i = 0; i < places.length; i += BATCH) {
    const chunk = places.slice(i, i + BATCH);
    const params = [];
    const tuples = chunk.map((p, idx) => {
      const vals = rowValues(orgId, p);
      const base = idx * COLS.length;
      params.push(...vals);
      return '(' + COLS.map((_, c) => `$${base + c + 1}`).join(',') + ')';
    });
    const sql =
      `INSERT INTO crm_leads (${COLS.map((c) => `"${c}"`).join(',')}) VALUES ${tuples.join(',')} ` +
      `ON CONFLICT (organisation_id, google_place_id) WHERE google_place_id IS NOT NULL AND deleted_at IS NULL DO NOTHING`;
    await client.query(sql, params);
    processed += chunk.length;
    if (processed % 2000 === 0 || processed === places.length) {
      console.log(`   …processed ${processed}/${places.length}`);
    }
  }

  const after = (await client.query('SELECT COUNT(*)::int AS c FROM crm_leads WHERE organisation_id = $1', [orgId])).rows[0].c;
  const incomplete = (await client.query('SELECT COUNT(*)::int AS c FROM crm_leads WHERE organisation_id = $1 AND is_incomplete = true', [orgId])).rows[0].c;
  const byType = await client.query(
    `SELECT COALESCE(centre_type, 'unclassified') AS t, COUNT(*)::int AS c
     FROM crm_leads WHERE organisation_id = $1 GROUP BY 1 ORDER BY 2 DESC`, [orgId],
  );

  console.log(`\n✅ Done. crm_leads for this org: ${before} → ${after} (inserted ${after - before})`);
  console.log(`   incomplete (no phone): ${incomplete}`);
  console.log('   by centre_type:');
  for (const r of byType.rows) console.log(`     ${r.t}: ${r.c}`);

  await client.end();
}

main().catch((e) => {
  console.error('❌ Seed failed:', e.message);
  process.exit(1);
});
