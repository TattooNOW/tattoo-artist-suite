/**
 * crawler.js — Multi-page Node.js crawler with link following
 * Sufficient for tattoo studio sites (typically 10-100 pages, max ~500)
 */
const { URL } = require('url');
const { fetchPage, extractMeta, extractHeadings, extractLinks, extractImages, extractSchema, extractWordCount, extractBodyWordCount, detectGBPEmbed, detectPlaceholders, detectGHLIssues } = require('./html-parser');

const DEFAULT_OPTIONS = {
  maxPages: 500,
  followExternalLinks: false,
  respectRobots: true,
  delayMs: 500,        // polite delay between requests
  timeoutMs: 10000,
  userAgent: 'TattooNOW-SiteAudit/1.0'
};

/**
 * Parse robots.txt and return disallowed paths
 */
async function parseRobotsTxt(baseUrl) {
  try {
    const res = await fetchPage(`${baseUrl}/robots.txt`);
    if (res.status !== 200) return { allowed: true, disallowed: [], sitemapUrls: [] };

    const lines = res.html.split('\n');
    const disallowed = [];
    const sitemapUrls = [];
    let appliesToUs = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('user-agent:')) {
        const agent = trimmed.split(':')[1].trim();
        appliesToUs = agent === '*' || agent.toLowerCase().includes('tattoonow');
      }
      if (appliesToUs && trimmed.toLowerCase().startsWith('disallow:')) {
        const path = trimmed.split(':').slice(1).join(':').trim();
        if (path) disallowed.push(path);
      }
      if (trimmed.toLowerCase().startsWith('sitemap:')) {
        sitemapUrls.push(trimmed.split(':').slice(1).join(':').trim());
      }
    }

    return { allowed: true, disallowed, sitemapUrls };
  } catch (e) {
    return { allowed: true, disallowed: [], sitemapUrls: [] };
  }
}

/**
 * Check if a path is allowed by robots.txt rules
 */
function isAllowed(path, disallowed) {
  for (const rule of disallowed) {
    if (path.startsWith(rule)) return false;
  }
  return true;
}

/**
 * Normalize URL for deduplication
 */
function normalizeUrl(href, base) {
  try {
    const u = new URL(href, base);
    // Remove trailing slash, hash, common tracking params
    let path = u.pathname.replace(/\/$/, '') || '/';
    return `${u.origin}${path}`;
  } catch {
    return null;
  }
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Crawl a full site, following internal links
 * @param {string} domain — e.g. "darksidetattoo.com"
 * @param {object} options — override DEFAULT_OPTIONS
 * @returns {{ pages: Array, links: Array, summary: object }}
 */
async function crawlSite(domain, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
  const base = new URL(baseUrl);

  // Parse robots.txt
  let disallowed = [];
  if (opts.respectRobots) {
    const robots = await parseRobotsTxt(baseUrl);
    disallowed = robots.disallowed;
    console.log(`  robots.txt: ${disallowed.length} disallowed paths, ${robots.sitemapUrls.length} sitemaps`);
  }

  const visited = new Set();
  const queue = ['/'];
  const pages = [];
  const linkMap = [];     // { from, to, text }
  const errors = [];

  while (queue.length > 0 && visited.size < opts.maxPages) {
    const path = queue.shift();
    const normalized = normalizeUrl(path, baseUrl);
    if (!normalized || visited.has(normalized)) continue;
    visited.add(normalized);

    // Robots check
    const urlPath = new URL(normalized).pathname;
    if (opts.respectRobots && !isAllowed(urlPath, disallowed)) {
      console.log(`  SKIP (robots): ${urlPath}`);
      continue;
    }

    // Skip non-HTML resources
    if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|css|js|ico|woff|woff2|ttf|eot|mp4|mp3|avi)$/i.test(urlPath)) {
      continue;
    }

    try {
      console.log(`  CRAWL: ${urlPath}`);
      const res = await fetchPage(normalized);

      // Skip non-HTML responses
      const contentType = (res.headers['content-type'] || [''])[0];
      if (!contentType.includes('text/html')) continue;

      const meta = extractMeta(res.html);
      const headings = extractHeadings(res.html);
      const links = extractLinks(res.html, normalized);
      const images = extractImages(res.html);
      const schemas = extractSchema(res.html);
      const wordCount = extractWordCount(res.html);
      const bodyWordCount = extractBodyWordCount(res.html);
      const hasGBPEmbed = detectGBPEmbed(res.html);
      const placeholders = detectPlaceholders(res.html);
      const ghlIssues = detectGHLIssues(res.html);

      // H1s
      const h1s = headings.filter(h => h.level === 1).map(h => h.text);

      // Internal links out from this page
      const internalLinksOut = [];
      for (const link of links) {
        if (link.type === 'internal') {
          const linkNorm = normalizeUrl(link.href, normalized);
          if (linkNorm) {
            const linkPath = new URL(linkNorm).pathname;
            internalLinksOut.push(linkPath);
            linkMap.push({ from: urlPath, to: linkPath, text: link.text });

            // Add to crawl queue
            if (!visited.has(linkNorm)) {
              queue.push(linkNorm);
            }
          }
        }
      }

      // Issues list
      const issues = [
        ...placeholders.map(p => ({ type: 'placeholder', ...p })),
        ...ghlIssues.map(g => ({ type: 'ghl', ...g }))
      ];

      const pageData = {
        url: urlPath,
        status: res.status,
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
        internalLinksOut: [...new Set(internalLinksOut)],
        internalLinksIn: [],  // populated after full crawl
        images: {
          total: images.length,
          withAlt: images.filter(i => i.hasAlt).length,
          formats: [...new Set(images.map(i => i.format))]
        },
        issues
      };

      pages.push(pageData);

      // Polite delay
      if (opts.delayMs > 0) await delay(opts.delayMs);

    } catch (err) {
      errors.push({ url: urlPath, error: err.message });
      console.log(`  ERROR: ${urlPath} — ${err.message}`);
    }
  }

  // Post-process: populate internalLinksIn for each page
  const pagesByUrl = {};
  for (const page of pages) {
    pagesByUrl[page.url] = page;
  }
  for (const link of linkMap) {
    if (pagesByUrl[link.to]) {
      if (!pagesByUrl[link.to].internalLinksIn.includes(link.from)) {
        pagesByUrl[link.to].internalLinksIn.push(link.from);
      }
    }
  }

  // Summary
  const summary = {
    totalPages: pages.length,
    totalLinks: linkMap.length,
    pagesWithSchema: pages.filter(p => p.hasSchema).length,
    pagesWithMetaDesc: pages.filter(p => p.metaDescription).length,
    pagesWithH1Issues: pages.filter(p => p.h1Count !== 1).length,
    avgWordCount: pages.length > 0 ? Math.round(pages.reduce((s, p) => s + p.wordCount, 0) / pages.length) : 0,
    avgBodyWordCount: pages.length > 0 ? Math.round(pages.reduce((s, p) => s + p.bodyWordCount, 0) / pages.length) : 0,
    errors: errors.length,
    maxPagesReached: visited.size >= opts.maxPages
  };

  return { pages, links: linkMap, summary, errors };
}

module.exports = { crawlSite, parseRobotsTxt };
