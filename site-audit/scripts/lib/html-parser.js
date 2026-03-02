const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { URL } = require('url');

async function fetchPage(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const html = await res.text();
  return {
    html,
    status: res.status,
    redirectUrl: res.url,
    headers: res.headers.raw()
  };
}

function extractMeta(html) {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();
  const description = $('meta[name="description"]').attr('content') || '';
  const viewport = $('meta[name="viewport"]').attr('content') || '';
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const ogTags = {};
  $('meta[property^="og:"]').each((i, el) => {
    ogTags[$(el).attr('property')] = $(el).attr('content');
  });
  const twitterCards = {};
  $('meta[name^="twitter:"]').each((i, el) => {
    twitterCards[$(el).attr('name')] = $(el).attr('content');
  });
  return { title, titleLength: title.length, description, descriptionLength: description.length, viewport, canonical, ogTags, twitterCards };
}

function extractHeadings(html) {
  const $ = cheerio.load(html);
  const headings = [];
  for (let i = 1; i <= 6; i++) {
    $(`h${i}`).each((idx, el) => {
      const text = $(el).text().trim();
      headings.push({ level: i, text, isEmpty: text === '' });
    });
  }
  return headings;
}

function extractLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const links = [];
  const base = new URL(baseUrl);
  $('a[href]').each((i, el) => {
    const href = $(el).attr('href');
    let type = 'external';
    try {
      const u = new URL(href, base);
      if (u.origin === base.origin) {
        type = 'internal';
      }
    } catch (e) {
      type = 'anchor';
    }
    if (href.startsWith('#')) type = 'anchor';
    const text = $(el).text().trim();
    links.push({ href, text, type, context: $(el).parent().text().trim() });
  });
  return links;
}

function extractImages(html) {
  const $ = cheerio.load(html);
  const imgs = [];
  $('img').each((i, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt') || '';
    const format = src.split('.').pop().toLowerCase();
    const isLazy = $(el).attr('loading') === 'lazy' || src.startsWith('data:');
    imgs.push({ src, alt, hasAlt: alt.trim() !== '', format, isLazy });
  });
  return imgs;
}

function extractSchema(html) {
  const $ = cheerio.load(html);
  const schemas = [];
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const json = JSON.parse($(el).contents().text());
      schemas.push(json);
    } catch (e) {
      // ignore
    }
  });
  return schemas;
}

function detectPlaceholders(html) {
  const $ = cheerio.load(html);
  const results = [];
  const text = $.text();
  const patterns = [
    { type: 'lorem', regex: /lorem ipsum/gi },
    { type: 'template', regex: /\{\{.*?\}\}/g },
    { type: 'undefined', regex: /undefined/gi },
    { type: 'typo', regex: /teh|recieve|adress/gi }
  ];
  patterns.forEach(p => {
    let match;
    while ((match = p.regex.exec(text))) {
      results.push({ text: match[0], type: p.type, location: match.index });
    }
  });
  return results;
}

function detectGHLIssues(html) {
  const $ = cheerio.load(html);
  const issues = [];
  $('a[href]').each((i, el) => {
    const href = $(el).attr('href');
    if (href && href.startsWith('//')) {
      issues.push({ issue: 'double-slash URL', details: href });
    }
    if (href && href.includes('ghl_link')) {
      issues.push({ issue: 'template social link', details: href });
    }
  });
  if ($('form[action*="unpublished"]').length) {
    issues.push({ issue: 'form artifact', details: 'unpublished form action present' });
  }
  return issues;
}

function extractWordCount(html) {
  const $ = cheerio.load(html);
  // All visible text including nav/footer
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  return text ? text.split(/\s+/).length : 0;
}

function extractBodyWordCount(html) {
  const $ = cheerio.load(html);
  // Best-effort content area: remove nav, header, footer, sidebar elements
  const $clone = cheerio.load($.html());
  $clone('nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"], .nav, .header, .footer, .sidebar, #nav, #header, #footer, #sidebar').remove();
  const text = $clone('body').text().replace(/\s+/g, ' ').trim();
  return text ? text.split(/\s+/).length : 0;
}

function detectGBPEmbed(html) {
  const $ = cheerio.load(html);
  // Check for Google Maps iframe embed
  let found = false;
  $('iframe').each((i, el) => {
    const src = $(el).attr('src') || '';
    if (src.includes('google.com/maps') || src.includes('maps.google.com') || src.includes('google.com/maps/embed')) {
      found = true;
    }
  });
  return found;
}

module.exports = {
  fetchPage,
  extractMeta,
  extractHeadings,
  extractLinks,
  extractImages,
  extractSchema,
  detectPlaceholders,
  detectGHLIssues,
  extractWordCount,
  extractBodyWordCount,
  detectGBPEmbed
};
