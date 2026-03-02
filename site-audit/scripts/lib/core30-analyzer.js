/**
 * core30-analyzer.js — Core 30 gap analysis
 * Compares crawled site structure against GBP categories + services
 * Identifies missing pages, thin content, and internal linking gaps
 */

const THIN_THRESHOLD = 1000;    // words — below this is "thin"
const STRONG_THRESHOLD = 2000;  // words — above this is "strong"

/**
 * Fuzzy match: does the page title/H1 match a keyword?
 * "Cover-Up Tattoos" matches "cover up tattoo", "cover-up tattoos", etc.
 */
function fuzzyMatch(pageText, keyword) {
  if (!pageText || !keyword) return false;
  // Normalize: lowercase, remove hyphens/punctuation, collapse spaces
  const normalize = (s) => s.toLowerCase().replace(/[-'']/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const normalPage = normalize(pageText);
  const normalKey = normalize(keyword);

  // Direct inclusion
  if (normalPage.includes(normalKey)) return true;

  // Check without trailing s (singular/plural)
  const singularKey = normalKey.replace(/s$/, '');
  if (normalPage.includes(singularKey)) return true;

  // Check each word of keyword appears in page text
  const keyWords = normalKey.split(' ').filter(w => w.length > 2);
  const matchCount = keyWords.filter(w => normalPage.includes(w)).length;
  return matchCount >= Math.ceil(keyWords.length * 0.7);
}

/**
 * Find which crawled page best matches a keyword
 */
function findMatchingPage(pages, keyword) {
  for (const page of pages) {
    // Check title
    if (fuzzyMatch(page.title, keyword)) return page;
    // Check H1s
    for (const h1 of (page.h1 || [])) {
      if (fuzzyMatch(h1, keyword)) return page;
    }
    // Check URL slug
    if (fuzzyMatch(page.url, keyword)) return page;
  }
  return null;
}

/**
 * Main analysis function
 * @param {object} crawlResults — from crawler.js
 * @param {object} siteRecord — from sites table (with GBP data)
 * @returns {object} Core 30 analysis results
 */
function analyzeCore30(crawlResults, siteRecord) {
  const pages = crawlResults.pages || [];
  const linkMap = crawlResults.links || [];
  const city = siteRecord.target_city || siteRecord.city || '';
  const state = siteRecord.target_state || siteRecord.state || '';

  // Build category list from GBP
  const primaryCategory = siteRecord.gbp_primary_category || '';
  const secondaryCategories = siteRecord.gbp_secondary_categories || [];
  const allCategories = [primaryCategory, ...secondaryCategories].filter(Boolean);

  // Build services list from GBP
  const services = siteRecord.gbp_services || [];

  // ──────── Categories analysis ────────
  const categoryResults = allCategories.map(cat => {
    const matched = findMatchingPage(pages, cat);
    let status = 'missing';
    let wordCount = 0;

    if (matched) {
      wordCount = matched.bodyWordCount || matched.wordCount || 0;
      status = wordCount < THIN_THRESHOLD ? 'thin' : 'found';
    }

    return {
      keyword: cat,
      searchTarget: `${cat} ${city} ${state}`.trim(),
      matchedPage: matched ? matched.url : null,
      status,
      wordCount
    };
  });

  // ──────── Services analysis ────────
  const serviceResults = services.map(svc => {
    const matched = findMatchingPage(pages, svc);
    let status = 'missing';
    let wordCount = 0;

    if (matched) {
      wordCount = matched.bodyWordCount || matched.wordCount || 0;
      status = wordCount < THIN_THRESHOLD ? 'thin' : 'found';
    }

    return {
      keyword: svc,
      searchTarget: `${svc} ${city} ${state}`.trim(),
      matchedPage: matched ? matched.url : null,
      status,
      wordCount
    };
  });

  // ──────── Homepage analysis ────────
  const homepage = pages.find(p => p.url === '/') || pages[0];
  const homepageAnalysis = {
    hasCategoryMentions: false,
    hasServiceMentions: false,
    missingMentions: []
  };

  if (homepage) {
    // Check homepage H2s and content for category/service mentions
    const homepageH2s = (crawlResults.pages || [])
      .find(p => p.url === '/')
      ?.h1 || [];

    // For categories: check if homepage has H2 mention + link to category page
    for (const cat of allCategories) {
      const hasLink = linkMap.some(l =>
        l.from === '/' && fuzzyMatch(l.text, cat)
      );
      if (!hasLink) {
        homepageAnalysis.missingMentions.push({
          type: 'category',
          keyword: cat,
          note: `Homepage missing H2 section + link for "${cat}"`
        });
      } else {
        homepageAnalysis.hasCategoryMentions = true;
      }
    }

    // For top services: check if homepage mentions them
    const topServices = services.slice(0, 4); // Check first 4 services
    for (const svc of topServices) {
      const hasLink = linkMap.some(l =>
        l.from === '/' && fuzzyMatch(l.text, svc)
      );
      if (!hasLink) {
        homepageAnalysis.missingMentions.push({
          type: 'service',
          keyword: svc,
          note: `Homepage missing H2 section + link for "${svc}"`
        });
      } else {
        homepageAnalysis.hasServiceMentions = true;
      }
    }
  }

  // ──────── Internal linking gaps ────────
  const linkingGaps = [];

  // Does homepage link to category pages?
  for (const cat of categoryResults) {
    if (cat.matchedPage && cat.status !== 'missing') {
      const homepageLinksTo = linkMap.some(l => l.from === '/' && l.to === cat.matchedPage);
      if (!homepageLinksTo) {
        linkingGaps.push({
          from: '/',
          to: cat.matchedPage,
          issue: `Homepage does not link to category page "${cat.keyword}" (${cat.matchedPage})`
        });
      }
    }
  }

  // Do category pages link to service pages?
  for (const svc of serviceResults) {
    if (svc.matchedPage && svc.status !== 'missing') {
      const anyParentLinks = linkMap.some(l =>
        categoryResults.some(c => c.matchedPage === l.from) && l.to === svc.matchedPage
      );
      if (!anyParentLinks) {
        linkingGaps.push({
          from: '(category pages)',
          to: svc.matchedPage,
          issue: `No category page links to service page "${svc.keyword}" (${svc.matchedPage})`
        });
      }
    }
  }

  // ──────── Generate content briefs for missing/thin pages ────────
  const contentBriefs = [];

  const missingCategories = categoryResults.filter(c => c.status === 'missing' || c.status === 'thin');
  const missingServices = serviceResults.filter(s => s.status === 'missing' || s.status === 'thin');

  // Category briefs (priority: high, phase: 1)
  for (const cat of missingCategories) {
    contentBriefs.push({
      target_keyword: `${cat.keyword} ${city} ${state}`.trim(),
      page_type: 'category',
      parent_page: '/',
      target_word_count: 1500,
      current_word_count: cat.wordCount || 0,
      must_include: [
        `overview of ${cat.keyword.toLowerCase()}`,
        'pricing or price range',
        'individual service links',
        `mention of ${city}`,
        'booking CTA'
      ],
      internal_links_to: ['/', '/consults'],
      internal_links_from: ['/'],
      priority: 'high',
      phase: 1,
      action: cat.status === 'thin' ? 'expand' : 'create'
    });
  }

  // Service briefs (priority varies, phase: 1)
  for (const svc of missingServices) {
    const parentCategory = categoryResults.find(c =>
      c.matchedPage && c.status !== 'missing'
    );

    contentBriefs.push({
      target_keyword: `${svc.keyword} ${city} ${state}`.trim(),
      page_type: 'service',
      parent_page: parentCategory ? parentCategory.matchedPage : '/',
      target_word_count: 1500,
      current_word_count: svc.wordCount || 0,
      must_include: [
        'process description',
        'pricing range',
        'before/after examples',
        'artist specializing in this',
        `mention of ${city}`,
        'booking CTA'
      ],
      internal_links_to: ['/', '/consults'],
      internal_links_from: parentCategory ? [parentCategory.matchedPage, '/'] : ['/'],
      priority: 'high',
      phase: 1,
      action: svc.status === 'thin' ? 'expand' : 'create'
    });
  }

  // ──────── Summary ────────
  const catFound = categoryResults.filter(c => c.status === 'found').length;
  const catThin = categoryResults.filter(c => c.status === 'thin').length;
  const catMissing = categoryResults.filter(c => c.status === 'missing').length;

  const svcFound = serviceResults.filter(s => s.status === 'found').length;
  const svcThin = serviceResults.filter(s => s.status === 'thin').length;
  const svcMissing = serviceResults.filter(s => s.status === 'missing').length;

  return {
    categories: {
      total: allCategories.length,
      found: catFound,
      thin: catThin,
      missing: catMissing,
      details: categoryResults
    },
    services: {
      total: services.length,
      found: svcFound,
      thin: svcThin,
      missing: svcMissing,
      details: serviceResults
    },
    homepage: homepageAnalysis,
    internalLinking: { gaps: linkingGaps },
    contentBriefs,
    summary: {
      categories_total: allCategories.length,
      categories_found: catFound,
      categories_missing: missingCategories.map(c => c.keyword),
      categories_thin: categoryResults.filter(c => c.status === 'thin').map(c => c.keyword),
      services_total: services.length,
      services_found: svcFound,
      services_missing: missingServices.map(s => s.keyword),
      services_thin: serviceResults.filter(s => s.status === 'thin').map(s => s.keyword),
      notes: services.length === 0
        ? 'GBP services list not yet entered — run GMB Everywhere or enter manually'
        : null
    }
  };
}

module.exports = { analyzeCore30, fuzzyMatch, findMatchingPage };
