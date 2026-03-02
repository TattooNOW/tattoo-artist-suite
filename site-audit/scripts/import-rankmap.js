#!/usr/bin/env node

/**
 * import-rankmap.js — Import Local Falcon (or similar) CSV into rank_maps table
 *
 * Usage:
 *   node import-rankmap.js --file scan.csv --location 56Jnv0OGTMdU1XSZyJIR --keyword "tattoo shop East Haven"
 *
 * Expected CSV format (Local Falcon default):
 *   lat,lng,rank
 *   41.276,-72.868,1
 *   41.277,-72.867,5
 *   ...
 *
 * Also supports DataForSEO / LeadSnap CSVs (auto-detected by header row).
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const { supabaseService } = require('./lib/supabase');

const argv = yargs(hideBin(process.argv))
  .option('file', { type: 'string', demandOption: true, describe: 'Path to CSV file' })
  .option('location', { type: 'string', demandOption: true, describe: 'GHL location ID' })
  .option('keyword', { type: 'string', demandOption: true, describe: 'Keyword that was tracked' })
  .option('date', { type: 'string', describe: 'Scan date (YYYY-MM-DD). Defaults to today.' })
  .option('source', { type: 'string', default: 'local_falcon', describe: 'Source: local_falcon, dataforseo, leadsnap, manual' })
  .option('grid-size', { type: 'string', default: '7x7', describe: 'Grid size (e.g. 7x7, 5x5)' })
  .option('radius', { type: 'number', describe: 'Grid radius in miles' })
  .help()
  .argv;

/**
 * Parse CSV text into array of rows
 */
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    if (vals.length < headers.length) continue; // skip malformed rows

    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx]; });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Detect CSV format and normalize to { lat, lng, rank } objects
 */
function normalizeRows(headers, rows) {
  // Local Falcon: lat, lng, rank
  if (headers.includes('lat') && headers.includes('lng') && headers.includes('rank')) {
    return rows.map(r => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lng),
      rank: parseInt(r.rank, 10) || 21 // 21 = not ranked
    }));
  }

  // DataForSEO: latitude, longitude, rank_absolute
  if (headers.includes('latitude') && headers.includes('longitude')) {
    const rankCol = headers.includes('rank_absolute') ? 'rank_absolute' : 'rank';
    return rows.map(r => ({
      lat: parseFloat(r.latitude),
      lng: parseFloat(r.longitude),
      rank: parseInt(r[rankCol], 10) || 21
    }));
  }

  // LeadSnap: Lat, Lon, Rank
  if (headers.some(h => h === 'lon' || h === 'long')) {
    const lngCol = headers.includes('lon') ? 'lon' : 'long';
    return rows.map(r => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r[lngCol]),
      rank: parseInt(r.rank, 10) || 21
    }));
  }

  throw new Error(`Unrecognized CSV format. Headers: ${headers.join(', ')}. Expected: lat,lng,rank`);
}

/**
 * Calculate grid metrics from normalized points
 */
function calculateMetrics(points) {
  const top3 = points.filter(p => p.rank >= 1 && p.rank <= 3);
  const ranked = points.filter(p => p.rank >= 1 && p.rank <= 20);

  const avgRank = ranked.length > 0
    ? ranked.reduce((sum, p) => sum + p.rank, 0) / ranked.length
    : null;

  // Grid center = average of all lat/lng
  const centerLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const centerLng = points.reduce((s, p) => s + p.lng, 0) / points.length;

  return {
    top3Count: top3.length,
    totalPoints: points.length,
    top3Pct: points.length > 0 ? Math.round((top3.length / points.length) * 100 * 10) / 10 : 0,
    avgRank: avgRank ? Math.round(avgRank * 10) / 10 : null,
    centerLat: Math.round(centerLat * 1000000) / 1000000,
    centerLng: Math.round(centerLng * 1000000) / 1000000,
    gridData: points.map(p => ({
      lat: p.lat,
      lng: p.lng,
      rank: p.rank,
      in_top3: p.rank >= 1 && p.rank <= 3
    }))
  };
}

async function main() {
  console.log('═══ Import Rank Map ═══');

  // Read CSV file
  const csvPath = path.resolve(argv.file);
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  const csvText = fs.readFileSync(csvPath, 'utf-8');
  const { headers, rows } = parseCSV(csvText);
  console.log(`  Parsed ${rows.length} rows (headers: ${headers.join(', ')})`);

  // Normalize
  const points = normalizeRows(headers, rows);
  console.log(`  Normalized ${points.length} grid points`);

  // Calculate metrics
  const metrics = calculateMetrics(points);
  console.log(`  Top 3: ${metrics.top3Count}/${metrics.totalPoints} = ${metrics.top3Pct}%`);
  console.log(`  Avg rank: ${metrics.avgRank || 'N/A'}`);
  console.log(`  Grid center: ${metrics.centerLat}, ${metrics.centerLng}`);

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

  // Build record
  const scanDate = argv.date || new Date().toISOString().slice(0, 10);
  const record = {
    site_id: site.id,
    keyword: argv.keyword,
    scan_date: scanDate,
    grid_size: argv['grid-size'],
    grid_center_lat: metrics.centerLat,
    grid_center_lng: metrics.centerLng,
    grid_radius_mi: argv.radius || null,
    grid_data: metrics.gridData,
    top_3_pct: metrics.top3Pct,
    top_3_count: metrics.top3Count,
    total_points: metrics.totalPoints,
    avg_rank: metrics.avgRank,
    source: argv.source,
    raw_response: { headers, rowCount: rows.length },
    screenshot_url: null
  };

  // Upsert (unique on site_id + keyword + scan_date)
  const { data, error } = await supabaseService
    .from('rank_maps')
    .upsert(record, { onConflict: 'site_id,keyword,scan_date' })
    .select();

  if (error) {
    console.error('Insert error:', error.message);
    process.exit(1);
  }

  console.log(`  ✓ Rank map saved: ${data[0].id}`);
  console.log(`  ★ HERO METRIC: ${metrics.top3Pct}% top-3 coverage`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
