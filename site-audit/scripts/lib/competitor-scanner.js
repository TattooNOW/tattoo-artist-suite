/**
 * competitor-scanner.js — Lightweight competitor data for benchmarking
 * Pulls basic data from Google Places API
 * Does NOT do a full audit of competitors
 */
const fetch = require('node-fetch');

const PLACES_BASE = 'https://places.googleapis.com/v1/places';

/**
 * Scan top competitors for a keyword in a city
 * @param {string} city
 * @param {string} state
 * @param {string} keyword — e.g. "tattoo shop"
 * @param {number} count — how many competitors (default 3)
 * @param {string} excludeDomain — our client's domain to exclude
 * @returns {Array} competitor data
 */
async function scanCompetitors(city, state, keyword, count = 3, excludeDomain = '') {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn('  ⚠ GOOGLE_PLACES_API_KEY not set — skipping competitor scan');
    return [];
  }

  const query = `${keyword} ${city} ${state}`;

  try {
    const res = await fetch(`${PLACES_BASE}:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.websiteUri,places.formattedAddress,places.rating,places.userRatingCount,places.types'
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: count + 2  // fetch extra in case we need to exclude self
      })
    });

    const data = await res.json();
    if (!data.places || data.places.length === 0) {
      console.warn(`  ⚠ No competitor results for "${query}"`);
      return [];
    }

    const competitors = [];
    for (const place of data.places) {
      // Extract domain from website URL
      let domain = null;
      if (place.websiteUri) {
        try {
          domain = new URL(place.websiteUri).hostname.replace(/^www\./, '');
        } catch {}
      }

      // Skip our own client
      if (excludeDomain && domain && domain.includes(excludeDomain.replace(/^www\./, ''))) {
        continue;
      }

      if (competitors.length >= count) break;

      // Extract city from formatted address
      let gbpCity = null;
      if (place.formattedAddress) {
        const parts = place.formattedAddress.split(',');
        if (parts.length >= 2) {
          gbpCity = parts[parts.length - 3]?.trim() || parts[0]?.trim();
        }
      }

      // Estimate indexed pages (lightweight — just check site: count)
      const indexedPages = await estimateIndexedPages(domain);

      const categoryMap = {
        'tattoo_shop': 'Tattoo Shop',
        'body_piercing_shop': 'Body Piercing Shop',
      };
      const categories = (place.types || []).map(t => categoryMap[t]).filter(Boolean);

      competitors.push({
        name: place.displayName?.text || 'Unknown',
        domain,
        gbpCity,
        indexedPages,
        reviewCount: place.userRatingCount || 0,
        reviewRating: place.rating || null,
        categoriesCount: categories.length,
        servicesCount: null,  // not available via API
        placeId: place.id || null
      });

      console.log(`  → Competitor: ${competitors[competitors.length - 1].name} — ${domain || 'no website'} — ${place.userRatingCount || 0} reviews`);
    }

    return competitors;

  } catch (err) {
    console.error(`  ✗ Competitor scan error: ${err.message}`);
    return [];
  }
}

/**
 * Estimate number of indexed pages using site: search
 * This is a rough estimate — Google sometimes inflates/deflates counts
 * @param {string} domain
 * @returns {number|null}
 */
async function estimateIndexedPages(domain) {
  if (!domain) return null;

  try {
    // Use a simple Google search for "site:domain.com"
    // Note: This is rate-limited and may require a Custom Search API key
    // For now, return null and let manual entry handle it
    // TODO: Implement via Google Custom Search API if GOOGLE_CSE_KEY is set
    return null;
  } catch {
    return null;
  }
}

module.exports = { scanCompetitors };
