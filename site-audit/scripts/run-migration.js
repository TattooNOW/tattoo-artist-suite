#!/usr/bin/env node
/**
 * run-migration.js — Execute migrate-v3.sql against Supabase Postgres directly
 * Usage: node run-migration.js
 *
 * Requires SUPABASE_DB_URL env var (Postgres connection string) OR
 * falls back to constructing it from SUPABASE_URL + SUPABASE_DB_PASSWORD.
 *
 * For Supabase projects, the connection string format is:
 *   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  // Supabase project ref extracted from URL
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dwoqhaaugczqsymfirqu.supabase.co';
  const ref = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

  // Direct connection string — user must provide DB password
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('ERROR: Set SUPABASE_DB_URL or DATABASE_URL env var');
    console.error('');
    console.error('Format: postgresql://postgres.[ref]:[DB_PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres');
    console.error(`Your ref: ${ref}`);
    console.error('');
    console.error('Find it in: Supabase Dashboard → Project Settings → Database → Connection string → URI');
    console.error('');
    console.error('Or paste the migration SQL directly into the Supabase SQL Editor at:');
    console.error(`  https://supabase.com/dashboard/project/${ref}/sql`);
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrate-v3.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log(`Connecting to Supabase Postgres (ref: ${ref})...`);
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('Connected. Running migrate-v3.sql...\n');

    await client.query(sql);

    console.log('✅ Migration completed successfully!\n');

    // Verify
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('rank_maps', 'competitors', 'link_checklist')
      ORDER BY table_name;
    `);
    console.log('New tables created:');
    tables.rows.forEach(r => console.log(`  • ${r.table_name}`));

    const cols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'sites' AND column_name = 'target_city';
    `);
    console.log(`\nSites.target_city column: ${cols.rows.length > 0 ? '✅ exists' : '❌ missing'}`);

    const rm = await client.query(`SELECT count(*) as cnt FROM rank_maps;`);
    console.log(`Rank map rows: ${rm.rows[0].cnt}`);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
