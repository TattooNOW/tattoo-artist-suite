/**
 * scoring.js — v3 scoring engine
 * Calculates SEO, AI, GEO scores and overall composite
 *
 * SEO sub-scores:
 *   titleTag (20 pts)  — Caleb formula
 *   h1       (10 pts)
 *   metaDesc (10 pts)
 *   schema   (10 pts)
 *   gbp      (15 pts)
 *   core30   (20 pts)
 *   techSEO  (15 pts)
 *   TOTAL    100 pts
 *
 * AI  = probe-based (null if no probes run)
 * GEO = geo-signal checklist pass rate
 *
 * Overall weighting:
 *   When AI is available: SEO 35%, AI 35%, GEO 30%
 *   When AI is null:      SEO 55%, GEO 45%
 */

// ─── SEO Sub-Scores ─────────────────────────────────────────

/**
 * Caleb title-tag formula (0–20 pts)
 * Perfect title: "{Primary Keyword} | {Business Name}" or "{Primary Keyword} - {Business Name}"
 * Under 60 chars, includes keyword + business name
 */
function scoreTitleTag(title, primaryKeyword, businessName) {
  if (!title || !primaryKeyword) return { score: 0, max: 20, notes: 'No title or keyword' };

  let score = 0;
  const notes = [];
  const titleLower = title.toLowerCase();
  const kwLower = primaryKeyword.toLowerCase();
  const bnLower = (businessName || '').toLowerCase();

  // Length check (0-4 pts)
  if (title.length > 0 && title.length <= 60) {
    score += 4;
  } else if (title.length > 60 && title.length <= 70) {
    score += 2;
    notes.push(`Title ${title.length} chars (ideal ≤60)`);
  } else if (title.length > 70) {
    notes.push(`Title ${title.length} chars — truncated in SERP`);
  } else {
    notes.push('Empty title');
  }

  // Primary keyword present (0-6 pts)
  if (titleLower.includes(kwLower)) {
    score += 6;
  } else {
    // Partial: check if most keyword words appear
    const kwWords = kwLower.split(/\s+/).filter(w => w.length > 2);
    const found = kwWords.filter(w => titleLower.includes(w)).length;
    if (found >= Math.ceil(kwWords.length * 0.7)) {
      score += 3;
      notes.push('Partial keyword match in title');
    } else {
      notes.push('Primary keyword missing from title');
    }
  }

  // Keyword leads title (0-4 pts) — front-loaded keyword
  if (titleLower.startsWith(kwLower)) {
    score += 4;
  } else if (titleLower.indexOf(kwLower) !== -1 && titleLower.indexOf(kwLower) < 20) {
    score += 2;
    notes.push('Keyword present but not front-loaded');
  }

  // Business name present (0-4 pts)
  if (bnLower && titleLower.includes(bnLower)) {
    score += 4;
  } else if (bnLower) {
    // Check abbreviated name (first word)
    const firstWord = bnLower.split(/\s+/)[0];
    if (firstWord.length > 3 && titleLower.includes(firstWord)) {
      score += 2;
      notes.push('Business name partially in title');
    } else {
      notes.push('Business name missing from title');
    }
  }

  // Separator present (0-2 pts)
  if (/[|–—\-]/.test(title)) {
    score += 2;
  }

  return { score: Math.min(score, 20), max: 20, notes };
}

/**
 * H1 score (0–10 pts)
 * Exactly one H1, contains primary keyword or city
 */
function scoreH1(h1s, primaryKeyword, city) {
  if (!h1s || h1s.length === 0) return { score: 0, max: 10, notes: ['No H1 tag found'] };

  let score = 0;
  const notes = [];

  // Exactly one H1 (0-4 pts)
  if (h1s.length === 1) {
    score += 4;
  } else {
    score += 1;
    notes.push(`${h1s.length} H1 tags (should be exactly 1)`);
  }

  const h1Text = h1s[0].toLowerCase();
  const kwLower = (primaryKeyword || '').toLowerCase();
  const cityLower = (city || '').toLowerCase();

  // Contains keyword (0-4 pts)
  if (kwLower && h1Text.includes(kwLower)) {
    score += 4;
  } else {
    const kwWords = kwLower.split(/\s+/).filter(w => w.length > 2);
    const found = kwWords.filter(w => h1Text.includes(w)).length;
    if (found >= Math.ceil(kwWords.length * 0.5)) {
      score += 2;
      notes.push('Partial keyword match in H1');
    } else {
      notes.push('Primary keyword missing from H1');
    }
  }

  // Contains city (0-2 pts)
  if (cityLower && h1Text.includes(cityLower)) {
    score += 2;
  } else if (cityLower) {
    notes.push('City missing from H1');
  }

  return { score: Math.min(score, 10), max: 10, notes };
}

/**
 * Meta description score (0–10 pts)
 */
function scoreMetaDesc(description) {
  if (!description) return { score: 0, max: 10, notes: ['No meta description'] };

  let score = 0;
  const notes = [];

  // Exists
  score += 4;

  // Good length (120-155 chars)
  if (description.length >= 120 && description.length <= 155) {
    score += 4;
  } else if (description.length >= 50 && description.length < 120) {
    score += 2;
    notes.push(`Meta desc ${description.length} chars (ideal 120-155)`);
  } else if (description.length > 155) {
    score += 2;
    notes.push(`Meta desc ${description.length} chars — may be truncated`);
  } else {
    notes.push(`Meta desc too short (${description.length} chars)`);
  }

  // Contains a CTA-like word
  const ctaWords = /book|call|visit|contact|schedule|free|consult/i;
  if (ctaWords.test(description)) {
    score += 2;
  }

  return { score: Math.min(score, 10), max: 10, notes };
}

/**
 * Schema score (0–10 pts)
 * Checks for LocalBusiness, FAQPage, breadcrumb
 */
function scoreSchema(schemas) {
  if (!schemas || schemas.length === 0) return { score: 0, max: 10, notes: ['No structured data found'] };

  let score = 0;
  const notes = [];
  const types = schemas.map(s => s['@type']).flat().filter(Boolean);

  // Any schema present
  score += 2;

  // LocalBusiness or subtype
  const hasLocal = types.some(t =>
    /localbusiness|tattooshop|healthandbeauty|store/i.test(t)
  );
  if (hasLocal) {
    score += 4;
  } else {
    notes.push('Missing LocalBusiness schema');
  }

  // FAQPage
  if (types.some(t => /faqpage/i.test(t))) {
    score += 2;
  } else {
    notes.push('Missing FAQPage schema');
  }

  // Breadcrumb or other
  if (types.some(t => /breadcrumb/i.test(t))) {
    score += 2;
  } else if (types.length > 1) {
    score += 1; // Bonus for multiple schema types
  }

  return { score: Math.min(score, 10), max: 10, notes };
}

/**
 * GBP score (0–15 pts)
 * GBP embed, review count, rating, categories
 */
function scoreGBP(site, homepage) {
  let score = 0;
  const notes = [];

  // GBP embed on homepage (0-3 pts)
  if (homepage && homepage.hasGBPEmbed) {
    score += 3;
  } else {
    notes.push('No Google Maps embed on homepage');
  }

  // Review count (0-4 pts)
  const reviews = site.gbp_review_count || 0;
  if (reviews >= 100) {
    score += 4;
  } else if (reviews >= 50) {
    score += 3;
  } else if (reviews >= 20) {
    score += 2;
  } else if (reviews > 0) {
    score += 1;
  } else {
    notes.push('No GBP review data');
  }

  // Rating (0-4 pts)
  const rating = site.gbp_review_rating || 0;
  if (rating >= 4.5) {
    score += 4;
  } else if (rating >= 4.0) {
    score += 3;
  } else if (rating >= 3.5) {
    score += 2;
  } else if (rating > 0) {
    score += 1;
  }

  // Categories set (0-2 pts)
  if (site.gbp_primary_category) {
    score += 1;
  }
  if (site.gbp_secondary_categories && site.gbp_secondary_categories.length > 0) {
    score += 1;
  }

  // Services set (0-2 pts)
  if (site.gbp_services && site.gbp_services.length > 0) {
    score += 2;
  } else {
    notes.push('GBP services list not entered');
  }

  return { score: Math.min(score, 15), max: 15, notes };
}

/**
 * Core 30 score (0–20 pts)
 * Based on core30-analyzer coverage output
 */
function scoreCore30(core30Coverage) {
  if (!core30Coverage) return { score: 0, max: 20, notes: ['Core 30 analysis not run'] };

  let score = 0;
  const notes = [];

  const catTotal = core30Coverage.categories_total || 0;
  const catFound = core30Coverage.categories_found || 0;
  const svcTotal = core30Coverage.services_total || 0;
  const svcFound = core30Coverage.services_found || 0;

  // Category coverage (0-10 pts)
  if (catTotal > 0) {
    const catPct = catFound / catTotal;
    score += Math.round(catPct * 10);
    if (catPct < 1) {
      notes.push(`${catTotal - catFound} category pages missing`);
    }
  } else {
    score += 5; // No categories to track = neutral
  }

  // Service coverage (0-10 pts)
  if (svcTotal > 0) {
    const svcPct = svcFound / svcTotal;
    score += Math.round(svcPct * 10);
    if (svcPct < 1) {
      notes.push(`${svcTotal - svcFound} service pages missing`);
    }
  } else {
    notes.push('GBP services not entered — Core 30 service coverage unknown');
    score += 0; // Can't score what we can't measure
  }

  return { score: Math.min(score, 20), max: 20, notes };
}

/**
 * Tech SEO score (0–15 pts)
 * Viewport, canonical, image alt, internal linking, page count
 */
function scoreTechSEO(crawlSummary, homepage) {
  let score = 0;
  const notes = [];

  if (!crawlSummary && !homepage) return { score: 0, max: 15, notes: ['No crawl data'] };

  // Viewport (0-2 pts)
  if (homepage && homepage.hasViewport) {
    score += 2;
  } else {
    notes.push('Missing viewport meta tag');
  }

  // Canonical (0-2 pts)
  if (homepage && homepage.hasCanonical) {
    score += 2;
  } else {
    notes.push('Missing canonical link on homepage');
  }

  // Page count — more pages = better for content sites (0-4 pts)
  if (crawlSummary) {
    const pages = crawlSummary.totalPages || 0;
    if (pages >= 20) score += 4;
    else if (pages >= 10) score += 3;
    else if (pages >= 5) score += 2;
    else score += 1;
  }

  // Meta description coverage (0-3 pts)
  if (crawlSummary && crawlSummary.totalPages > 0) {
    const coverage = (crawlSummary.pagesWithMetaDesc || 0) / crawlSummary.totalPages;
    if (coverage >= 0.9) score += 3;
    else if (coverage >= 0.5) score += 2;
    else score += 1;
    if (coverage < 0.9) notes.push(`Only ${Math.round(coverage * 100)}% of pages have meta descriptions`);
  }

  // Average word count (0-2 pts)
  if (crawlSummary) {
    const avg = crawlSummary.avgBodyWordCount || crawlSummary.avgWordCount || 0;
    if (avg >= 800) score += 2;
    else if (avg >= 400) score += 1;
    else notes.push(`Average body word count ${avg} — aim for 800+`);
  }

  // H1 coverage (0-2 pts)
  if (crawlSummary && crawlSummary.totalPages > 0) {
    const h1Issues = crawlSummary.pagesWithH1Issues || 0;
    const okPages = crawlSummary.totalPages - h1Issues;
    const coverage = okPages / crawlSummary.totalPages;
    if (coverage >= 0.9) score += 2;
    else if (coverage >= 0.5) score += 1;
  }

  return { score: Math.min(score, 15), max: 15, notes };
}

/**
 * Calculate full SEO score (0–100)
 * @param {object} params
 *   - homepage: page data from crawler (title, h1, metaDesc, schema, etc.)
 *   - site: sites table record
 *   - crawlSummary: crawler summary stats
 *   - core30Coverage: from core30-analyzer summary
 *   - schemas: array of parsed JSON-LD from homepage
 * @returns {object} { score, breakdown: {...}, notes: [...] }
 */
function calculateSEOScore({ homepage, site, crawlSummary, core30Coverage, schemas }) {
  const titleResult = scoreTitleTag(
    homepage?.title || '',
    site?.primary_keyword || '',
    site?.business_name || ''
  );

  const h1Result = scoreH1(
    homepage?.h1 || [],
    site?.primary_keyword || '',
    site?.target_city || site?.city || ''
  );

  const metaResult = scoreMetaDesc(homepage?.metaDescription || '');
  const schemaResult = scoreSchema(schemas || []);
  const gbpResult = scoreGBP(site || {}, homepage || {});
  const core30Result = scoreCore30(core30Coverage);
  const techResult = scoreTechSEO(crawlSummary, homepage);

  const total = titleResult.score + h1Result.score + metaResult.score +
    schemaResult.score + gbpResult.score + core30Result.score + techResult.score;

  const allNotes = [
    ...titleResult.notes.map(n => `[Title] ${n}`),
    ...h1Result.notes.map(n => `[H1] ${n}`),
    ...metaResult.notes.map(n => `[Meta] ${n}`),
    ...schemaResult.notes.map(n => `[Schema] ${n}`),
    ...gbpResult.notes.map(n => `[GBP] ${n}`),
    ...core30Result.notes.map(n => `[Core30] ${n}`),
    ...techResult.notes.map(n => `[Tech] ${n}`)
  ];

  return {
    score: Math.round(total),
    breakdown: {
      titleTag: titleResult,
      h1: h1Result,
      metaDescription: metaResult,
      schema: schemaResult,
      gbp: gbpResult,
      core30: core30Result,
      techSEO: techResult
    },
    notes: allNotes
  };
}

/**
 * Calculate AI discoverability score
 * Returns null (not 0) if no probes have been run yet
 */
function calculateAIScore(mentions) {
  if (!mentions || mentions.length === 0) return null;

  const engines = {};
  mentions.forEach(m => {
    if (!engines[m.engine]) engines[m.engine] = { mentioned: 0, total: 0, accurate: 0, sentimentTotal: 0 };
    engines[m.engine].total += 1;
    if (m.mentioned) engines[m.engine].mentioned += 1;
    if (m.nap_accurate) engines[m.engine].accurate += 1;
    const weight = m.sentiment === 'positive' ? 1 : m.sentiment === 'neutral' ? 0.7 : 0.3;
    engines[m.engine].sentimentTotal += weight;
  });

  let totalScore = 0;
  let count = 0;
  Object.values(engines).forEach(e => {
    const mentionRate = (e.mentioned / e.total) * 100;
    const accMod = e.mentioned ? (e.accurate / e.mentioned) : 1;
    const sentMod = e.sentimentTotal / e.total;
    totalScore += mentionRate * accMod * sentMod;
    count += 1;
  });

  return count ? Math.round(totalScore / count) : null;
}

/**
 * Calculate GEO readiness score
 */
function calculateGEOScore(geoSignals) {
  if (!geoSignals || geoSignals.length === 0) return 0;
  const passed = geoSignals.filter(s => s.passed || s.signal_value).length;
  return Math.round((passed / geoSignals.length) * 100);
}

/**
 * Calculate overall composite score
 * When AI is null: redistribute weight to SEO 55% + GEO 45%
 * When AI is available: SEO 35% + AI 35% + GEO 30%
 */
function calculateOverall(seo, ai, geo) {
  if (ai === null || ai === undefined) {
    // No AI data — redistribute
    return Math.round(seo * 0.55 + geo * 0.45);
  }
  return Math.round(seo * 0.35 + ai * 0.35 + geo * 0.30);
}

module.exports = {
  // Sub-score functions (exported for testing)
  scoreTitleTag,
  scoreH1,
  scoreMetaDesc,
  scoreSchema,
  scoreGBP,
  scoreCore30,
  scoreTechSEO,
  // Main scoring functions
  calculateSEOScore,
  calculateAIScore,
  calculateGEOScore,
  calculateOverall
};