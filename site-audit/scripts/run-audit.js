#!/usr/bin/env node

/**
 * run-audit.js — v3 full 16-step diagnostic pipeline
 *
 * Usage:
 *   node run-audit.js --location 56Jnv0OGTMdU1XSZyJIR
 *   node run-audit.js --domain darksidetattoo.com
 *   node run-audit.js --domain darksidetattoo.com --skip-crawl   # reuse last crawl
 *   node run-audit.js --domain darksidetattoo.com --skip-gbp     # skip GBP API calls
 */

const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const { supabaseService } = require('./lib/supabase');
const htmlParser = require('./lib/html-parser');
const { crawlSite } = require('./lib/crawler');
const { lookupGBP, lookupByPlaceId } = require('./lib/gbp-lookup');
const { analyzeCore30 } = require('./lib/core30-analyzer');
const { generateLinkChecklist } = require('./lib/link-checklist');
const { scanCompetitors } = require('./lib/competitor-scanner');
const scoring = require('./lib/scoring');

// ─── CLI ────────────────────────────────────────────────────

const argv = yargs(hideBin(process.argv))
  .option('location', { type: 'string', describe: 'GHL location ID' })
  .option('domain', { type: 'string', describe: 'Site domain' })
  .option('skip-crawl', { type: 'boolean', default: false, describe: 'Skip crawl (uses homepage only)' })
  .option('skip-gbp', { type: 'boolean', default: false, describe: 'Skip GBP API lookups' })
  .option('skip-competitors', { type: 'boolean', default: false, describe: 'Skip competitor scan' })
  .check(a => {
    if (!a.location && !a.domain) throw new Error('Provide --location or --domain');
    return true;
  })
  .help()
  .argv;

// ─── Helpers ────────────────────────────────────────────────

function step(n, label) {
  console.log(`\n── Step ${n}: ${label} ──`);
}

const today = new Date().toISOString().slice(0, 10);

// ─── Main Pipeline ──────────────────────────────────────────

async function main() {
  const startMs = Date.now();
  console.log('═══════════════════════════════════════');
  console.log(' TattooNOW Site Audit — v3 Pipeline');
  console.log(`  ${today}`);
  console.log('═══════════════════════════════════════');

  // ── 1. INTAKE: Lookup site ──────────────────────────────
  step(1, 'INTAKE — Lookup site');
  const { data: site, error: siteErr } = await supabaseService
    .from('sites')
    .select('*')
    .or(argv.location
      ? `ghl_location_id.eq.${argv.location}`
      : `domain.eq.${argv.domain}`)
    .limit(1)
    .single();

  if (siteErr || !site) {
    console.error('Site not found:', siteErr?.message || 'no match');
    process.exit(1);
  }
  console.log(`  ${site.business_name} — ${site.domain}`);
  console.log(`  Target: ${site.target_city || site.city || '?'}, ${site.target_state || site.state || '?'}`);

  const baseUrl = site.domain.startsWith('http') ? site.domain : `https://${site.domain}`;

  // ── 2. INDEX CHECK (lightweight) ────────────────────────
  step(2, 'INDEX CHECK');
  let indexation = { indexed_estimate: null, crawled_count: null, ratio: null, notes: 'site: estimate not run (requires Custom Search API)' };
  // TODO: If GOOGLE_CSE_KEY is set, run site:domain.com query
  console.log('  Skipped — requires Google Custom Search API key');

  // ── 3. GBP LOOKUP ──────────────────────────────────────
  step(3, 'GBP LOOKUP');
  let gbpData = null;
  if (!argv['skip-gbp']) {
    if (site.gbp_place_id) {
      gbpData = await lookupByPlaceId(site.gbp_place_id);
    } else {
      gbpData = await lookupGBP(
        site.business_name,
        site.target_city || site.city || '',
        site.target_state || site.state || ''
      );
    }

    // Auto-fill site fields from GBP if we got data
    if (gbpData) {
      const updates = {};
      if (!site.gbp_place_id && gbpData.placeId) updates.gbp_place_id = gbpData.placeId;
      if (!site.gbp_review_count && gbpData.reviewCount) updates.gbp_review_count = gbpData.reviewCount;
      if (!site.gbp_review_rating && gbpData.rating) updates.gbp_review_rating = gbpData.rating;
      if (!site.gbp_primary_category && gbpData.primaryCategory) updates.gbp_primary_category = gbpData.primaryCategory;
      if ((!site.gbp_secondary_categories || site.gbp_secondary_categories.length === 0) && gbpData.categories?.length > 1) {
        updates.gbp_secondary_categories = gbpData.categories.filter(c => c !== gbpData.primaryCategory);
      }

      if (Object.keys(updates).length > 0) {
        await supabaseService.from('sites').update(updates).eq('id', site.id);
        Object.assign(site, updates);
        console.log(`  Auto-filled ${Object.keys(updates).length} GBP fields`);
      }
    }
  } else {
    console.log('  Skipped (--skip-gbp)');
  }

  // ── 4. RETHEME DETECTION ──────────────────────────────
  step(4, 'RETHEME DETECTION');
  let homepageRes;
  try {
    homepageRes = await htmlParser.fetchPage(baseUrl);
  } catch (err) {
    console.error(`  Failed to fetch homepage: ${err.message}`);
    process.exit(1);
  }

  const rethemeMarkers = [
    { pattern: /starter-template|starter_template/i, theme: 'GHL Starter' },
    { pattern: /developer-mode|developer_mode/i, theme: 'GHL Dev Mode' },
    { pattern: /preview-container/i, theme: 'GHL Preview' },
    { pattern: /ghl-page-builder/i, theme: 'GHL Page Builder' },
  ];

  let rethemeDetected = false;
  let rethemeTarget = null;
  for (const marker of rethemeMarkers) {
    if (marker.pattern.test(homepageRes.html)) {
      rethemeDetected = true;
      rethemeTarget = marker.theme;
      break;
    }
  }

  if (rethemeDetected) {
    console.log(`  ⚠ Retheme detected: ${rethemeTarget}`);
    await supabaseService.from('sites').update({
      retheme_detected: true,
      retheme_target: rethemeTarget
    }).eq('id', site.id);
  } else {
    console.log('  No retheme markers found');
  }

  // ── 5. RANK MAP FETCH (read latest from DB) ──────────
  step(5, 'RANK MAP — latest from DB');
  const { data: rankMaps } = await supabaseService
    .from('rank_maps')
    .select('*')
    .eq('site_id', site.id)
    .order('scan_date', { ascending: false })
    .limit(1);

  const latestRankMap = rankMaps?.[0] || null;
  if (latestRankMap) {
    console.log(`  ★ Top-3: ${latestRankMap.top_3_pct}% (${latestRankMap.keyword}, ${latestRankMap.scan_date})`);
  } else {
    console.log('  No rank map data yet — run import-rankmap.js first');
  }

  // ── 6. CITY MISMATCH CHECK ──────────────────────────
  step(6, 'CITY MISMATCH');
  if (site.target_city && site.city && site.target_city !== site.city) {
    console.log(`  ⚠ Target city "${site.target_city}" ≠ GBP city "${site.city}"`);
  } else if (!site.target_city) {
    console.log('  target_city not set — using city field');
  } else {
    console.log('  OK — target_city matches city');
  }

  // ── 7. COMPETITOR SCAN ──────────────────────────────
  step(7, 'COMPETITOR SCAN');
  let competitors = [];
  if (!argv['skip-competitors']) {
    competitors = await scanCompetitors(
      site.target_city || site.city || '',
      site.target_state || site.state || '',
      site.primary_keyword || 'tattoo shop',
      3,
      site.domain
    );

    if (competitors.length > 0) {
      // Upsert competitors
      const compRecords = competitors.map(c => ({
        site_id: site.id,
        competitor_name: c.name,
        domain: c.domain,
        gbp_city: c.gbpCity,
        indexed_pages: c.indexedPages,
        review_count: c.reviewCount,
        review_rating: c.reviewRating,
        categories_count: c.categoriesCount,
        services_count: c.servicesCount,
        last_checked: today
      }));

      await supabaseService.from('competitors').upsert(compRecords, {
        onConflict: 'site_id,competitor_name',
        ignoreDuplicates: false
      });
      console.log(`  Saved ${compRecords.length} competitors`);
    }
  } else {
    console.log('  Skipped (--skip-competitors)');
  }

  // ── 8. HOMEPAGE ANALYSIS ──────────────────────────────
  step(8, 'HOMEPAGE ANALYSIS');
  const meta = htmlParser.extractMeta(homepageRes.html);
  const headings = htmlParser.extractHeadings(homepageRes.html);
  const links = htmlParser.extractLinks(homepageRes.html, baseUrl);
  const images = htmlParser.extractImages(homepageRes.html);
  const schemas = htmlParser.extractSchema(homepageRes.html);
  const wordCount = htmlParser.extractWordCount(homepageRes.html);
  const bodyWordCount = htmlParser.extractBodyWordCount(homepageRes.html);
  const hasGBPEmbed = htmlParser.detectGBPEmbed(homepageRes.html);
  const placeholders = htmlParser.detectPlaceholders(homepageRes.html);
  const ghlIssues = htmlParser.detectGHLIssues(homepageRes.html);

  const h1s = headings.filter(h => h.level === 1).map(h => h.text);

  const homepageData = {
    url: '/',
    title: meta.title,
    titleLength: meta.titleLength,
    metaDescription: meta.description || null,
    metaDescriptionLength: meta.descriptionLength,
    h1: h1s,
    h1Count: h1s.length,
    wordCount,
    bodyWordCount,
    hasSchema: schemas.length > 0,
    schemaTypes: schemas.map(s => s['@type']).filter(Boolean).flat(),
    hasGBPEmbed,
    hasCanonical: !!meta.canonical,
    hasViewport: !!meta.viewport,
    ogTags: meta.ogTags,
    images: { total: images.length, withAlt: images.filter(i => i.hasAlt).length },
    issues: [...placeholders.map(p => ({ type: 'placeholder', ...p })), ...ghlIssues.map(g => ({ type: 'ghl', ...g }))]
  };

  console.log(`  Title: "${meta.title}" (${meta.titleLength} chars)`);
  console.log(`  H1s: ${h1s.length} — "${h1s[0] || 'NONE'}"`);
  console.log(`  Body words: ${bodyWordCount}`);
  console.log(`  Schema types: ${schemas.length > 0 ? homepageData.schemaTypes.join(', ') : 'NONE'}`);
  console.log(`  GBP embed: ${hasGBPEmbed ? 'YES' : 'NO'}`);

  // ── 9. CRAWL (full site) ──────────────────────────────
  step(9, 'CRAWL');
  let crawlResults;
  if (argv['skip-crawl']) {
    console.log('  Skipped (--skip-crawl) — homepage only');
    crawlResults = {
      pages: [homepageData],
      links: links.filter(l => l.type === 'internal').map(l => ({ from: '/', to: l.href, text: l.text })),
      summary: { totalPages: 1, totalLinks: 0, pagesWithSchema: schemas.length > 0 ? 1 : 0, pagesWithMetaDesc: meta.description ? 1 : 0, pagesWithH1Issues: h1s.length !== 1 ? 1 : 0, avgWordCount: wordCount, avgBodyWordCount: bodyWordCount, errors: 0 },
      errors: []
    };
  } else {
    crawlResults = await crawlSite(site.domain, { maxPages: 200, delayMs: 300 });
    console.log(`  Crawled ${crawlResults.summary.totalPages} pages, ${crawlResults.summary.errors} errors`);
  }

  indexation.crawled_count = crawlResults.summary.totalPages;

  // ── 10. CORE 30 GAP ANALYSIS ──────────────────────────
  step(10, 'CORE 30 GAP ANALYSIS');
  const core30 = analyzeCore30(crawlResults, site);
  console.log(`  Categories: ${core30.categories.found}/${core30.categories.total} found, ${core30.categories.missing} missing, ${core30.categories.thin} thin`);
  console.log(`  Services: ${core30.services.found}/${core30.services.total} found, ${core30.services.missing} missing, ${core30.services.thin} thin`);
  console.log(`  Content briefs: ${core30.contentBriefs.length}`);

  // ── 11. GEO SIGNALS ──────────────────────────────────
  step(11, 'GEO / AEO SIGNALS');
  const geoSignals = [];
  const city = site.target_city || site.city || '';
  const state = site.target_state || site.state || '';

  // Schema LocalBusiness
  const hasLocalSchema = schemas.some(s => {
    const types = [].concat(s['@type'] || []);
    return types.some(t => /localbusiness|tattooshop|healthandbeauty/i.test(t));
  });
  geoSignals.push({ signal_name: 'local_business_schema', passed: hasLocalSchema });

  // City in title
  geoSignals.push({ signal_name: 'city_in_title', passed: city ? meta.title.toLowerCase().includes(city.toLowerCase()) : false });

  // City in H1
  geoSignals.push({ signal_name: 'city_in_h1', passed: city && h1s.length > 0 ? h1s[0].toLowerCase().includes(city.toLowerCase()) : false });

  // GBP embed
  geoSignals.push({ signal_name: 'gbp_embed', passed: hasGBPEmbed });

  // NAP on page (basic check — phone number)
  const pageText = homepageRes.html;
  const phoneOnPage = site.phone ? pageText.includes(site.phone.replace(/-/g, '')) || pageText.includes(site.phone) : false;
  geoSignals.push({ signal_name: 'phone_on_homepage', passed: phoneOnPage });

  // Address on page
  const addressOnPage = site.address ? pageText.toLowerCase().includes(site.address.toLowerCase()) : false;
  geoSignals.push({ signal_name: 'address_on_homepage', passed: addressOnPage });

  // FAQPage schema
  const hasFAQ = schemas.some(s => [].concat(s['@type'] || []).some(t => /faqpage/i.test(t)));
  geoSignals.push({ signal_name: 'faq_schema', passed: hasFAQ });

  // OpenGraph locale
  geoSignals.push({ signal_name: 'og_tags_present', passed: Object.keys(meta.ogTags || {}).length > 0 });

  const geoPassed = geoSignals.filter(g => g.passed).length;
  console.log(`  ${geoPassed}/${geoSignals.length} signals passed`);

  // ── 12. SCHEMA AUDIT ──────────────────────────────────
  step(12, 'SCHEMA AUDIT');
  console.log(`  Found ${schemas.length} JSON-LD blocks`);
  if (schemas.length > 0) {
    schemas.forEach((s, i) => console.log(`    [${i}] @type: ${[].concat(s['@type'] || ['?']).join(', ')}`));
  }

  // ── 13. WORD COUNT SUMMARY ──────────────────────────────
  step(13, 'WORD COUNT SUMMARY');
  console.log(`  Avg body word count: ${crawlResults.summary.avgBodyWordCount || crawlResults.summary.avgWordCount || 0}`);
  const thinPages = crawlResults.pages.filter(p => (p.bodyWordCount || p.wordCount || 0) < 300);
  if (thinPages.length > 0) {
    console.log(`  ⚠ ${thinPages.length} pages under 300 words:`);
    thinPages.slice(0, 5).forEach(p => console.log(`    ${p.url} — ${p.bodyWordCount || p.wordCount} words`));
  }

  // ── 14. SCORING ──────────────────────────────────────
  step(14, 'SCORING');
  const seoResult = scoring.calculateSEOScore({
    homepage: homepageData,
    site,
    crawlSummary: crawlResults.summary,
    core30Coverage: core30.summary,
    schemas
  });

  // AI score — read existing mentions from DB (populated by n8n probes)
  const { data: aiMentions } = await supabaseService
    .from('ai_mentions')
    .select('*')
    .eq('site_id', site.id);
  const aiScore = scoring.calculateAIScore(aiMentions);

  const geoScore = scoring.calculateGEOScore(geoSignals);
  const overallScore = scoring.calculateOverall(seoResult.score, aiScore, geoScore);

  console.log(`  SEO: ${seoResult.score}/100`);
  console.log(`  AI:  ${aiScore !== null ? aiScore + '/100' : 'null (no probes yet)'}`);
  console.log(`  GEO: ${geoScore}/100`);
  console.log(`  Overall: ${overallScore}`);

  // ── 15. GENERATE FINDINGS ──────────────────────────────
  step(15, 'GENERATE FINDINGS');
  const findings = [];
  let findingNum = 0;
  const fid = () => `AUDIT-${today.replace(/-/g, '')}-${String(++findingNum).padStart(3, '0')}`;

  // Layer 0: Strategic findings
  if (rethemeDetected) {
    findings.push({
      finding_id: fid(), severity: 'critical', category: 'strategic', layer: 0,
      title: `Site using ${rethemeTarget} — needs retheme`,
      page: '/',
      finding: `The site appears to be using the "${rethemeTarget}" template. This limits SEO potential significantly.`,
      fix: 'Build a custom GHL site or migrate to a professional theme with proper H1/title/schema support.',
      effort_minutes: 480, impact: 'high', status: 'open', first_detected: today
    });
  }

  if (site.target_city && site.city && site.target_city.toLowerCase() !== site.city.toLowerCase()) {
    findings.push({
      finding_id: fid(), severity: 'medium', category: 'strategic', layer: 0,
      title: `Target city "${site.target_city}" ≠ GBP city "${site.city}"`,
      page: null,
      finding: `Business is physically in ${site.city} but targeting ${site.target_city}. This creates a distance penalty in the local pack.`,
      fix: 'Consider: (1) get a virtual office in target city, (2) adjust target to match GBP city, or (3) create dedicated landing pages for the target area.',
      effort_minutes: 120, impact: 'high', status: 'open', first_detected: today
    });
  }

  // Layer 1: SEO findings
  if (!meta.description) {
    findings.push({
      finding_id: fid(), severity: 'high', category: 'meta', layer: 1,
      title: 'Missing meta description on homepage', page: '/',
      finding: 'Homepage has no meta description tag.',
      fix: `Add: <meta name="description" content="${site.business_name} in ${city}, ${state} — [your services]. Book online today.">`,
      effort_minutes: 10, impact: 'high', status: 'open', first_detected: today
    });
  }

  if (meta.titleLength > 60) {
    findings.push({
      finding_id: fid(), severity: 'medium', category: 'meta', layer: 1,
      title: `Homepage title too long (${meta.titleLength} chars)`, page: '/',
      finding: `Title is "${meta.title}" — ${meta.titleLength} chars. Google truncates at ~60.`,
      fix: `Shorten to: "${site.primary_keyword || 'Primary Keyword'} | ${site.business_name}"`,
      effort_minutes: 10, impact: 'medium', status: 'open', first_detected: today
    });
  }

  if (meta.titleLength === 0) {
    findings.push({
      finding_id: fid(), severity: 'critical', category: 'meta', layer: 1,
      title: 'Missing title tag on homepage', page: '/',
      finding: 'Homepage has no <title> tag.',
      fix: `Add: <title>${site.primary_keyword || 'Primary Keyword'} | ${site.business_name}</title>`,
      effort_minutes: 10, impact: 'high', status: 'open', first_detected: today
    });
  }

  if (h1s.length === 0) {
    findings.push({
      finding_id: fid(), severity: 'high', category: 'content', layer: 1,
      title: 'Missing H1 on homepage', page: '/',
      finding: 'No H1 heading found on homepage.',
      fix: `Add an H1 containing "${site.primary_keyword || 'your keyword'}" and "${city}".`,
      effort_minutes: 10, impact: 'high', status: 'open', first_detected: today
    });
  } else if (h1s.length > 1) {
    findings.push({
      finding_id: fid(), severity: 'low', category: 'content', layer: 1,
      title: `Multiple H1 tags on homepage (${h1s.length})`, page: '/',
      finding: `Found ${h1s.length} H1 tags. Best practice is exactly one.`,
      fix: 'Change extra H1s to H2 or H3.',
      effort_minutes: 15, impact: 'low', status: 'open', first_detected: today
    });
  }

  if (!hasGBPEmbed) {
    findings.push({
      finding_id: fid(), severity: 'medium', category: 'geo', layer: 1,
      title: 'No Google Maps embed on homepage', page: '/',
      finding: 'Homepage missing embedded Google Maps iframe.',
      fix: 'Add a Google Maps embed in the contact/footer section. Use the embed from your GBP listing.',
      effort_minutes: 15, impact: 'medium', status: 'open', first_detected: today
    });
  }

  if (!hasLocalSchema) {
    findings.push({
      finding_id: fid(), severity: 'high', category: 'schema', layer: 1,
      title: 'Missing LocalBusiness schema', page: '/',
      finding: 'No LocalBusiness (or subtype) JSON-LD found on homepage.',
      fix: 'Add a TattooShop or LocalBusiness JSON-LD script in the <head> or via GHL tracking code.',
      effort_minutes: 30, impact: 'high', status: 'open', first_detected: today
    });
  }

  if (!hasFAQ) {
    findings.push({
      finding_id: fid(), severity: 'low', category: 'schema', layer: 1,
      title: 'No FAQPage schema', page: '/',
      finding: 'Missing FAQPage structured data.',
      fix: 'Add FAQPage JSON-LD with 5-8 common questions about your services.',
      effort_minutes: 30, impact: 'low', status: 'open', first_detected: today
    });
  }

  // Placeholder/GHL issues
  if (placeholders.length > 0) {
    findings.push({
      finding_id: fid(), severity: 'medium', category: 'content', layer: 1,
      title: `Placeholder content detected (${placeholders.length} instances)`, page: '/',
      finding: `Found: ${placeholders.slice(0, 3).map(p => `"${p.text}"`).join(', ')}`,
      fix: 'Replace all placeholder text with real content.',
      effort_minutes: 30, impact: 'medium', status: 'open', first_detected: today
    });
  }

  if (ghlIssues.length > 0) {
    findings.push({
      finding_id: fid(), severity: 'medium', category: 'technical', layer: 1,
      title: `GHL template issues detected (${ghlIssues.length})`, page: '/',
      finding: ghlIssues.slice(0, 3).map(g => g.issue).join('; '),
      fix: 'Fix broken social links, double-slash URLs, and form artifacts in GHL editor.',
      effort_minutes: 20, impact: 'medium', status: 'open', first_detected: today
    });
  }

  // Core 30 missing page findings
  for (const brief of core30.contentBriefs) {
    const action = brief.action === 'expand' ? 'Expand' : 'Create';
    findings.push({
      finding_id: fid(), severity: 'high', category: 'content', layer: 1,
      title: `${action} page: "${brief.target_keyword}"`,
      page: brief.parent_page,
      finding: `Core 30 gap: ${brief.action === 'expand' ? `page exists but only ${brief.current_word_count} words (thin)` : 'no dedicated page found'}.`,
      fix: `${action} a page targeting "${brief.target_keyword}". Target ${brief.target_word_count}+ words. Must include: ${brief.must_include.join(', ')}.`,
      effort_minutes: brief.action === 'expand' ? 60 : 120,
      impact: 'high', status: 'open', first_detected: today
    });
  }

  // Internal linking gap findings
  for (const gap of core30.internalLinking.gaps) {
    findings.push({
      finding_id: fid(), severity: 'medium', category: 'linking', layer: 1,
      title: `Internal link missing: ${gap.from} → ${gap.to}`, page: gap.from,
      finding: gap.issue,
      fix: `Add an internal link from ${gap.from} to ${gap.to} with descriptive anchor text.`,
      effort_minutes: 5, impact: 'medium', status: 'open', first_detected: today
    });
  }

  // Thin pages from crawl
  for (const thin of thinPages) {
    if (thin.url === '/') continue; // already covered above
    findings.push({
      finding_id: fid(), severity: 'low', category: 'content', layer: 1,
      title: `Thin page: ${thin.url} (${thin.bodyWordCount || thin.wordCount} words)`,
      page: thin.url,
      finding: `Page has only ${thin.bodyWordCount || thin.wordCount} words. Target 800+ for meaningful content.`,
      fix: 'Add substantive content or consider merging with a related page.',
      effort_minutes: 60, impact: 'low', status: 'open', first_detected: today
    });
  }

  // Layer 3: GEO signal findings
  for (const sig of geoSignals) {
    if (!sig.passed) {
      const recommendation = {
        local_business_schema: 'Add LocalBusiness JSON-LD with address, phone, hours, and geo coordinates.',
        city_in_title: `Include "${city}" in the homepage title tag.`,
        city_in_h1: `Include "${city}" in the homepage H1 heading.`,
        gbp_embed: 'Embed a Google Maps iframe on the homepage.',
        phone_on_homepage: 'Display your phone number prominently on the homepage.',
        address_on_homepage: 'Display your full street address on the homepage.',
        faq_schema: 'Add FAQPage JSON-LD with common questions.',
        og_tags_present: 'Add Open Graph meta tags (og:title, og:description, og:image).'
      };

      findings.push({
        finding_id: fid(), severity: 'medium', category: 'geo', layer: 3,
        title: `GEO signal missing: ${sig.signal_name.replace(/_/g, ' ')}`, page: '/',
        finding: `The ${sig.signal_name.replace(/_/g, ' ')} signal is not present.`,
        fix: recommendation[sig.signal_name] || `Add the ${sig.signal_name} signal.`,
        effort_minutes: 15, impact: 'medium', status: 'open', first_detected: today
      });
    }
  }

  console.log(`  Generated ${findings.length} findings`);

  // ── 16. DB WRITE + DELTA ──────────────────────────────
  step(16, 'DB WRITE + DELTA');

  // Build scores object
  const scoresObj = {
    overall: overallScore,
    seo: { score: seoResult.score, breakdown: seoResult.breakdown },
    ai_discoverability: aiScore !== null ? { score: aiScore } : null,
    geo_readiness: { score: geoScore, signals: geoSignals }
  };

  // Build pages_checked from crawl
  const pagesChecked = crawlResults.pages.map(p => ({
    url: p.url,
    title: p.title,
    wordCount: p.bodyWordCount || p.wordCount,
    hasSchema: p.hasSchema,
    h1Count: p.h1Count
  }));

  // Insert audit
  const auditRecord = {
    site_id: site.id,
    audit_date: today,
    audit_type: 'full',
    scores: scoresObj,
    pages_checked: pagesChecked,
    link_inventory: crawlResults.links,
    run_duration_ms: Date.now() - startMs,
    triggered_by: 'cli',
    core30_coverage: core30.summary,
    indexation,
    content_briefs: core30.contentBriefs,
    crawler_source: 'builtin'
  };

  const { data: audit, error: auditErr } = await supabaseService
    .from('audits')
    .upsert(auditRecord, { onConflict: 'site_id,audit_date,audit_type' })
    .select()
    .single();

  if (auditErr) {
    console.error('Audit insert error:', auditErr.message);
    process.exit(1);
  }
  console.log(`  Audit saved: ${audit.id}`);

  // Insert findings
  if (findings.length > 0) {
    const findingRecords = findings.map(f => ({
      audit_id: audit.id,
      site_id: site.id,
      ...f
    }));

    const { error: fErr } = await supabaseService.from('findings').insert(findingRecords);
    if (fErr) console.error('  Findings insert error:', fErr.message);
    else console.log(`  Inserted ${findings.length} findings`);
  }

  // Insert GEO signals
  const geoRecords = geoSignals.map(g => ({
    site_id: site.id,
    audit_id: audit.id,
    signal_name: g.signal_name,
    signal_value: g.passed,
    recommendation: g.passed ? null : `Fix: ${g.signal_name.replace(/_/g, ' ')}`
  }));

  const { error: geoErr } = await supabaseService.from('geo_signals').upsert(geoRecords, {
    onConflict: 'site_id,audit_id,signal_name',
    ignoreDuplicates: true
  });
  if (geoErr) console.warn('  GEO signals insert note:', geoErr.message);

  // Generate + insert link checklist
  const linkItems = generateLinkChecklist(site, core30.contentBriefs);
  if (linkItems.length > 0) {
    const linkRecords = linkItems.map(l => ({
      site_id: site.id,
      audit_id: audit.id,
      ...l
    }));

    const { error: linkErr } = await supabaseService.from('link_checklist').insert(linkRecords);
    if (linkErr) console.warn('  Link checklist insert note:', linkErr.message);
    else console.log(`  Inserted ${linkItems.length} link checklist items`);
  }

  // Calculate delta via RPC
  try {
    await supabaseService.rpc('calculate_delta', { new_audit_id: audit.id });
    console.log('  Delta calculated');
  } catch (e) {
    console.warn('  Delta calculation note:', e.message);
  }

  // ── Summary ──────────────────────────────────────────
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log('\n═══════════════════════════════════════');
  console.log(' AUDIT COMPLETE');
  console.log(`  Site:     ${site.business_name}`);
  console.log(`  Overall:  ${overallScore}/100`);
  console.log(`  SEO:      ${seoResult.score}/100`);
  console.log(`  AI:       ${aiScore !== null ? aiScore + '/100' : 'null'}`);
  console.log(`  GEO:      ${geoScore}/100`);
  console.log(`  Findings: ${findings.length}`);
  console.log(`  Pages:    ${crawlResults.summary.totalPages}`);
  console.log(`  Rank Map: ${latestRankMap ? latestRankMap.top_3_pct + '% top-3' : 'not imported'}`);
  console.log(`  Time:     ${elapsed}s`);
  console.log('═══════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
