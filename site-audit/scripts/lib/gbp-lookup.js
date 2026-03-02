/**
 * gbp-lookup.js — Google Places API (New) for external GBP data
 * Fetches categories, rating, reviews, hours, address, phone, placeId
 * Does NOT return GBP services list (requires GMB Everywhere or backend access)
 */
const fetch = require('node-fetch');

const PLACES_BASE = 'https://places.googleapis.com/v1/places';

/**
 * Lookup GBP data by business name + location
 * @param {string} businessName
 * @param {string} city
 * @param {string} state
 * @returns {object} GBP data
 */
async function lookupGBP(businessName, city, state) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn('  ⚠ GOOGLE_PLACES_API_KEY not set — skipping GBP lookup');
    return null;
  }

  const query = `${businessName} ${city} ${state}`;

  try {
    // Use Text Search (New)
    const res = await fetch(`${PLACES_BASE}:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.primaryType,places.types,places.rating,places.userRatingCount,places.regularOpeningHours,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri'
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 1
      })
    });

    const data = await res.json();
    if (!data.places || data.places.length === 0) {
      console.warn(`  ⚠ No GBP result for "${query}"`);
      return null;
    }

    const place = data.places[0];
    return formatPlaceResult(place);

  } catch (err) {
    console.error(`  ✗ GBP lookup error: ${err.message}`);
    return null;
  }
}

/**
 * Lookup GBP data by Place ID (faster, more accurate)
 * @param {string} placeId — Google Place ID (e.g. "ChIJ...")
 * @returns {object} GBP data
 */
async function lookupByPlaceId(placeId) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn('  ⚠ GOOGLE_PLACES_API_KEY not set — skipping GBP lookup');
    return null;
  }

  try {
    const res = await fetch(`${PLACES_BASE}/${placeId}`, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,primaryType,types,rating,userRatingCount,regularOpeningHours,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,websiteUri,googleMapsUri'
      }
    });

    const place = await res.json();
    if (place.error) {
      console.warn(`  ⚠ GBP lookup by placeId failed: ${place.error.message}`);
      return null;
    }

    return formatPlaceResult(place);

  } catch (err) {
    console.error(`  ✗ GBP lookup error: ${err.message}`);
    return null;
  }
}

/**
 * Format raw Places API result into our standard shape
 */
function formatPlaceResult(place) {
  // Map Google's types to readable categories
  const categoryMap = {
    'tattoo_shop': 'Tattoo Shop',
    'body_piercing_shop': 'Body Piercing Shop',
    'beauty_salon': 'Beauty Salon',
    'hair_salon': 'Hair Salon',
    'art_gallery': 'Art Gallery'
  };

  const primaryCategory = categoryMap[place.primaryType] || place.primaryType || 'Unknown';
  const categories = (place.types || [])
    .map(t => categoryMap[t] || null)
    .filter(Boolean);

  // Parse hours
  let hours = null;
  if (place.regularOpeningHours && place.regularOpeningHours.periods) {
    hours = place.regularOpeningHours.periods.map(p => ({
      day: p.open?.day,
      open: p.open?.hour ? `${String(p.open.hour).padStart(2, '0')}:${String(p.open.minute || 0).padStart(2, '0')}` : null,
      close: p.close?.hour ? `${String(p.close.hour).padStart(2, '0')}:${String(p.close.minute || 0).padStart(2, '0')}` : null
    }));
  }

  const result = {
    placeId: place.id || null,
    name: place.displayName?.text || null,
    primaryCategory,
    categories,
    rating: place.rating || null,
    reviewCount: place.userRatingCount || null,
    address: place.formattedAddress || null,
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
    website: place.websiteUri || null,
    mapsUrl: place.googleMapsUri || null,
    hours,
    // Services NOT available via Places API — log note
    services: null,
    servicesNote: 'Services list not available via API — enter manually from GMB Everywhere or GBP backend.'
  };

  console.log(`  ✓ GBP: ${result.name} — ${result.primaryCategory} — ${result.reviewCount} reviews (${result.rating}★)`);
  if (!result.services) {
    console.log(`  ℹ ${result.servicesNote}`);
  }

  return result;
}

module.exports = { lookupGBP, lookupByPlaceId };
