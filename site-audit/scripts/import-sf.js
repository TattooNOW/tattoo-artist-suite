#!/usr/bin/env node

/**
 * import-sf.js — Import SpyFu competitor CSV into competitors table
 *
 * Usage:
 *   node import-sf.js --file spyfu-export.csv --location 56Jnv0OGTMdU1XSZyJIR
 *
 * Expected CSV format (SpyFu Competitor Export):
 *   Domain,Monthly SEO Clicks,Monthly SEO Value,Organic Keywords,Paid Keywords,...
 *
 * Also accepts a simplified format:
 *   domain,indexed_pages,review_count,review_rating,notes
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const { supabaseService } = require('./lib/supabase');

const argv = yargs(hideBin(process.argv))
  .option('file', { type: 'string', demandOption: true, describe: 'Path to CSV file' })
  .option('location', { type: 'string', demandOption: true, describe: 'GHL location ID' })
  .option('replace', { type: 'boolean', default: false, describe: 'Replace existing competitors (delete first)' })
  .help()
  .argv;

/**
 * Parse CSV text — handles quoted fields
 */
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length < 2) continue; // skip empty/malformed

    const row = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] || '').trim(); });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Parse a single CSV line (handles quoted fields with commas)
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Normalize SpyFu or simplified CSV rows into competitor records
 */
function normalizeRows(headers, rows) {
  // SpyFu format: "domain", "monthly seo clicks", "organic keywords", etc.
  const isSpyFu = headers.some(h => h.includes('seo clicks') || h.includes('organic keywords'));

  if (isSpyFu) {
    return rows.map(r => {
      const domain = (r.domain || r.url || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
      const organicKw = parseInt(r['organic keywords'] || r['organickeywords'] || '0', 10);
      const seoClicks = parseInt((r['monthly seo clicks'] || r['monthlseoclicks'] || '0').replace(/,/g, ''), 10);

      return {
        competitor_name: domain,  // Will be updated from GBP if available
        domain,
        indexed_pages: null,       // SpyFu doesn't provide this directly
        notes: `SpyFu: ${organicKw} organic kw, ${seoClicks} monthly SEO clicks`
      };
    }).filter(r => r.domain);
  }

  // Simplified format: domain, indexed_pages, review_count, review_rating, notes
  return rows.map(r => {
    const domain = (r.domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    return {
      competitor_name: r.name || r.competitor_name || domain,
      domain,
      indexed_pages: r.indexed_pages ? parseInt(r.indexed_pages, 10) : null,
      review_count: r.review_count ? parseInt(r.review_count, 10) : null,
      review_rating: r.review_rating ? parseFloat(r.review_rating) : null,
      gbp_city: r.city || r.gbp_city || null,
      categories_count: r.categories_count ? parseInt(r.categories_count, 10) : null,
      services_count: r.services_count ? parseInt(r.services_count, 10) : null,
      notes: r.notes || null
    };
  }).filter(r => r.domain);
}

async function main() {
  console.log('═══ Import SpyFu / Competitor CSV ═══');

  // Read CSV
  const csvPath = path.resolve(argv.file);
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  const csvText = fs.readFileSync(csvPath, 'utf-8');
  const { headers, rows } = parseCSV(csvText);
  console.log(`  Parsed ${rows.length} rows (headers: ${headers.join(', ')})`);

  // Normalize
  const competitors = normalizeRows(headers, rows);
  console.log(`  Normalized ${competitors.length} competitors`);

  // Lookup site
  const { data: site, error: siteErr } = await supabaseService
    .from('sites')
    .select('id, domain, business_name')
    .eq('ghl_location_id', argv.location)
    .single();

  if (siteErr || !site) {
    console.error(`Site not found for location: ${argv.location}`);
    process.exit(1);
  }
  console.log(`  Site: ${site.business_name} (${site.domain})`);

  // Exclude self
  const filtered = competitors.filter(c =>
    !c.domain.includes(site.domain.replace(/^www\./, ''))
  );
  console.log(`  After excluding self: ${filtered.length} competitors`);

  // Optionally delete existing
  if (argv.replace) {
    const { error: delErr } = await supabaseService
      .from('competitors')
      .delete()
      .eq('site_id', site.id);
    if (delErr) console.warn(`  ⚠ Delete error: ${delErr.message}`);
    else console.log('  Deleted existing competitors');
  }

  // Insert
  const today = new Date().toISOString().slice(0, 10);
  const records = filtered.map(c => ({
    site_id: site.id,
    competitor_name: c.competitor_name,
    domain: c.domain,
    gbp_city: c.gbp_city || null,
    indexed_pages: c.indexed_pages || null,
    review_count: c.review_count || null,
    review_rating: c.review_rating || null,
    categories_count: c.categories_count || null,
    services_count: c.services_count || null,
    notes: c.notes || null,
    last_checked: today
  }));

  const { data, error } = await supabaseService
    .from('competitors')
    .insert(records)
    .select();

  if (error) {
    console.error('Insert error:', error.message);
    process.exit(1);
  }

  console.log(`  ✓ Imported ${data.length} competitors`);
  for (const c of data) {
    console.log(`    → ${c.competitor_name} (${c.domain}) — ${c.review_count || '?'} reviews`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
