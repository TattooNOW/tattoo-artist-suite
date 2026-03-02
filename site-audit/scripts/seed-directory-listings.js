#!/usr/bin/env node
// seed-directory-listings.js
// Seeds directory listing audit results for Darkside Tattoo into Supabase
// Run: node scripts/seed-directory-listings.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const SITE_ID = 'a1b2c3d4-0000-0000-0000-000000000001';
const AUDIT_ID = 'bbbb0002-0000-0000-0000-000000000002';
const TODAY = '2026-03-02';

const listings = [
  // ===== TIER 1: CRITICAL =====
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'Google Business Profile',
    platform_category: 'search', tier: 1,
    status: 'listed',
    listing_url: 'https://www.google.com/maps/place/Darkside+Tattoo+and+Body+Piercing/',
    name_listed: 'Darkside Tattoo and Body Piercing',
    address_listed: '190 Main St, East Haven, CT 06512',
    phone_listed: '(203) 469-9208',
    nap_issues: null, nap_priority: null,
    is_claimed: true, has_photos: true, has_reviews: true,
    review_count: 89,
    notes: '4.3 stars, 89 reviews. Claimed, photos present, hours set. NAP correct.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'Apple Maps',
    platform_category: 'maps', tier: 1,
    status: 'needs_claim',
    listing_url: null,
    name_listed: null, address_listed: null, phone_listed: null,
    nap_issues: null, nap_priority: 'P1',
    is_claimed: false, has_photos: false, has_reviews: false,
    review_count: 0,
    notes: 'Not found in search results. Likely auto-generated from Yelp data but unclaimed. Claim via Apple Maps Connect.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'Yelp',
    platform_category: 'reviews', tier: 1,
    status: 'listed',
    listing_url: 'https://www.yelp.com/biz/darkside-tattoo-east-haven-2',
    name_listed: 'Darkside Tattoo',
    address_listed: '190 Main St, East Haven, CT 06512',
    phone_listed: '(203) 469-9208',
    nap_issues: ['name_variation'],
    nap_priority: 'P2',
    is_claimed: true, has_photos: true, has_reviews: true,
    review_count: 13,
    notes: 'Name shows "Darkside Tattoo" without "& Body Piercing". 40 photos, 13 reviews. Last updated Dec 2025. Address and phone correct.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'Facebook Business',
    platform_category: 'social', tier: 1,
    status: 'listed',
    listing_url: 'https://www.facebook.com/darksidetattoostudio',
    name_listed: 'Darkside Tattoo Studio',
    address_listed: null,
    phone_listed: null,
    nap_issues: ['name_variation'],
    nap_priority: 'P2',
    is_claimed: true, has_photos: true, has_reviews: false,
    review_count: null,
    notes: 'Page exists. Name uses "Studio" instead of "& Body Piercing". Could not verify address/phone (page requires login). Linked from site social icons.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'Instagram Business',
    platform_category: 'social', tier: 1,
    status: 'listed',
    listing_url: 'https://www.instagram.com/darksidetattoostudio/',
    name_listed: 'Darkside Tattoo Studio',
    address_listed: null,
    phone_listed: null,
    nap_issues: null, nap_priority: null,
    is_claimed: true, has_photos: true, has_reviews: false,
    review_count: null,
    notes: '7,525 followers. Active posting. Primary client discovery platform. Handle @darksidetattoostudio. Bio links to darksidetattoo.com.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'Bing Places',
    platform_category: 'search', tier: 1,
    status: 'not_listed',
    listing_url: null,
    name_listed: null, address_listed: null, phone_listed: null,
    nap_issues: null, nap_priority: null,
    is_claimed: false, has_photos: false, has_reviews: false,
    review_count: 0,
    notes: 'No Bing Places listing found. Claim at bingplaces.com — free and pulls from GBP data.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },

  // ===== TIER 2: HIGH IMPACT =====
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'YellowPages',
    platform_category: 'directory', tier: 2,
    status: 'needs_fix',
    listing_url: 'https://www.yellowpages.com/east-haven-ct/mip/darkside-tattoo-and-body-piercing-24502964',
    name_listed: 'Darkside Tattoo and Body Piercing',
    address_listed: '190 Main St, East Haven, CT 06512',
    phone_listed: '(203) 469-9208',
    nap_issues: null, nap_priority: 'P2',
    is_claimed: false, has_photos: false, has_reviews: false,
    review_count: 0,
    notes: 'NAP correct but listing appears unclaimed. 0 photos, 0 reviews. Claim and add photos/description to optimize.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'TripAdvisor',
    platform_category: 'reviews', tier: 2,
    status: 'not_listed',
    listing_url: null,
    name_listed: null, address_listed: null, phone_listed: null,
    nap_issues: null, nap_priority: null,
    is_claimed: false, has_photos: false, has_reviews: false,
    review_count: 0,
    notes: 'No TripAdvisor listing found. Less relevant for tattoo studios but free to claim.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'Foursquare',
    platform_category: 'data_aggregator', tier: 2,
    status: 'not_listed',
    listing_url: null,
    name_listed: null, address_listed: null, phone_listed: null,
    nap_issues: null, nap_priority: null,
    is_claimed: false, has_photos: false, has_reviews: false,
    review_count: 0,
    notes: 'No Foursquare listing for East Haven location. Other "Darkside Tattoo" shops exist on Foursquare in other states. Important: Foursquare data feeds Apple Maps, Bing, and many aggregators.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'MapQuest',
    platform_category: 'maps', tier: 2,
    status: 'not_listed',
    listing_url: null,
    name_listed: null, address_listed: null, phone_listed: null,
    nap_issues: null, nap_priority: null,
    is_claimed: false, has_photos: false, has_reviews: false,
    review_count: 0,
    notes: 'No MapQuest listing found.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'Superpages',
    platform_category: 'directory', tier: 2,
    status: 'not_listed',
    listing_url: null,
    name_listed: null, address_listed: null, phone_listed: null,
    nap_issues: null, nap_priority: null,
    is_claimed: false, has_photos: false, has_reviews: false,
    review_count: 0,
    notes: 'No Superpages listing for East Haven location. Other Darkside shops listed in WI and MO.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'BBB',
    platform_category: 'directory', tier: 2,
    status: 'not_listed',
    listing_url: null,
    name_listed: null, address_listed: null, phone_listed: null,
    nap_issues: null, nap_priority: null,
    is_claimed: false, has_photos: false, has_reviews: false,
    review_count: 0,
    notes: 'No BBB listing for East Haven. Other Darkside shops listed in IL and ND. BBB accreditation is paid but listing is free.',
    is_free: true, cost_tier: '$', is_bonus: false, last_checked: TODAY
  },

  // ===== TIER 3: INDUSTRY =====
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'TattooCloud',
    platform_category: 'industry', tier: 3,
    status: 'listed',
    listing_url: 'https://tattoocloud.com/darksidetattoostudio',
    name_listed: 'Darkside Tattoo',
    address_listed: '190 Main Street, East Haven CONNECTICUT 06512',
    phone_listed: '203-469-9208',
    nap_issues: ['name_variation'],
    nap_priority: 'P2',
    is_claimed: true, has_photos: true, has_reviews: false,
    review_count: null,
    notes: 'Name shows "Darkside Tattoo" without "& Body Piercing". Address/phone correct. Has portfolio. Links to social profiles. State shown as "CONNECTICUT" (all caps).',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'TattooNOW (Legacy)',
    platform_category: 'industry', tier: 3,
    status: 'needs_fix',
    listing_url: 'https://www.darksidetattoo.com/',
    name_listed: 'Darkside Tattoo',
    address_listed: '190 Main Street, East Haven, CT 06512',
    phone_listed: '203-469-9208',
    nap_issues: ['dead_link_risk'],
    nap_priority: 'P1',
    is_claimed: true, has_photos: true, has_reviews: false,
    review_count: null,
    notes: 'Legacy TattooNOW site at www.darksidetattoo.com still indexed. Contains old news posts ("moving" announcement). New site is darksidetattoo.com (no www). Both are live which can confuse search engines and AI systems. Need 301 redirect from www to non-www.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'Tattoodo',
    platform_category: 'industry', tier: 3,
    status: 'not_listed',
    listing_url: null,
    name_listed: null, address_listed: null, phone_listed: null,
    nap_issues: null, nap_priority: null,
    is_claimed: false, has_photos: false, has_reviews: false,
    review_count: 0,
    notes: 'No Tattoodo listing found. Free to create.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'TikTok',
    platform_category: 'social', tier: 3,
    status: 'listed',
    listing_url: 'https://TikTok.com/@darksidetatstudio',
    name_listed: 'Darkside Tattoo Studio',
    address_listed: null, phone_listed: null,
    nap_issues: null, nap_priority: null,
    is_claimed: true, has_photos: false, has_reviews: false,
    review_count: null,
    notes: 'Account exists @darksidetatstudio. Activity level unknown — could not verify post count. Growing discovery channel.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'LinkedIn',
    platform_category: 'social', tier: 3,
    status: 'needs_fix',
    listing_url: 'https://www.linkedin.com/company/darkside-tattoo',
    name_listed: 'Darkside Tattoo',
    address_listed: null,
    phone_listed: null,
    nap_issues: ['wrong_category', 'name_variation'],
    nap_priority: 'P2',
    is_claimed: true, has_photos: false, has_reviews: false,
    review_count: null,
    notes: 'Company page exists. Listed as "Retail Art Supplies" instead of Tattoo Shop. No address shown. Sean OHara personal profile also links to studio (73 connections). Fix category and add location.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'YouTube',
    platform_category: 'social', tier: 3,
    status: 'listed',
    listing_url: 'https://youtube.com/@darksidetattoostudio',
    name_listed: 'Darkside Tattoo Studio',
    address_listed: null, phone_listed: null,
    nap_issues: null, nap_priority: null,
    is_claimed: true, has_photos: false, has_reviews: false,
    review_count: null,
    notes: 'Channel exists (linked from site social icons). Activity level unknown.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'X (Twitter)',
    platform_category: 'social', tier: 3,
    status: 'listed',
    listing_url: 'https://x.com/DarksideTatShop',
    name_listed: 'Darkside Tattoo Shop',
    address_listed: null, phone_listed: null,
    nap_issues: ['name_variation'],
    nap_priority: 'P2',
    is_claimed: true, has_photos: false, has_reviews: false,
    review_count: null,
    notes: 'Account @DarksideTatShop exists. Name uses "Shop" instead of "& Body Piercing" or "Studio". Linked from site.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },

  // ===== TIER 4: SECONDARY =====
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'Manta',
    platform_category: 'directory', tier: 4,
    status: 'not_listed',
    listing_url: null,
    name_listed: null, address_listed: null, phone_listed: null,
    nap_issues: null, nap_priority: null,
    is_claimed: false, has_photos: false, has_reviews: false,
    review_count: 0,
    notes: 'No Manta listing for East Haven location.',
    is_free: true, cost_tier: 'FREE', is_bonus: false, last_checked: TODAY
  },

  // ===== BONUS: DISCOVERED DURING AUDIT =====
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'Wheree',
    platform_category: 'data_aggregator', tier: 4,
    status: 'needs_fix',
    listing_url: 'https://darkside-tattoo-and-body-piercing-llc.wheree.com/',
    name_listed: 'Darkside Tattoo and Body Piercing LLC',
    address_listed: 'East Haven Town, South Central CT',
    phone_listed: null,
    nap_issues: ['wrong_category', 'name_variation'],
    nap_priority: 'P2',
    is_claimed: false, has_photos: true, has_reviews: false,
    review_count: null,
    notes: 'Aggregator listing. Listed as "Art Galleries" not "Tattoo Shop". Name includes LLC. Address shows region not street. Pulls from Google/Yelp — fixing source fixes this. Informational only.',
    is_free: true, cost_tier: 'FREE', is_bonus: true, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'Waze',
    platform_category: 'maps', tier: 4,
    status: 'listed',
    listing_url: 'https://www.waze.com/live-map/directions/darkside-tattoo-main-st-190-east-haven',
    name_listed: 'Darkside Tattoo',
    address_listed: '190 Main St, East Haven',
    phone_listed: null,
    nap_issues: ['name_variation'],
    nap_priority: 'P2',
    is_claimed: false, has_photos: false, has_reviews: false,
    review_count: null,
    notes: 'Listed on Waze for navigation. Name without "& Body Piercing". Waze pulls from Google data. Fixing GBP fixes Waze.',
    is_free: true, cost_tier: 'FREE', is_bonus: true, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'Nextdoor',
    platform_category: 'social', tier: 4,
    status: 'listed',
    listing_url: 'https://nextdoor.com/pages/dark-side-tattoo-east-haven-ct/',
    name_listed: 'Darkside Tattoo',
    address_listed: '190 Main St, East Haven, CT 06512',
    phone_listed: '203-469-9208',
    nap_issues: ['name_variation'],
    nap_priority: 'P2',
    is_claimed: false, has_photos: false, has_reviews: false,
    review_count: null,
    notes: 'Auto-generated listing. Name without "& Body Piercing". Category shows "Personal care". Address/phone correct. URL slug uses "dark-side" (two words). Claim via Nextdoor for Business.',
    is_free: true, cost_tier: 'FREE', is_bonus: true, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'RocketReach',
    platform_category: 'data_aggregator', tier: 4,
    status: 'listed',
    listing_url: 'https://rocketreach.co/darkside-tattoo-profile_b4590dd8fc5d4977',
    name_listed: 'Darkside Tattoo',
    address_listed: null, phone_listed: null,
    nap_issues: null, nap_priority: null,
    is_claimed: false, has_photos: false, has_reviews: false,
    review_count: null,
    notes: 'Data broker listing. Informational only — fixing source data fixes aggregator.',
    is_free: true, cost_tier: 'FREE', is_bonus: true, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'Birdeye',
    platform_category: 'data_aggregator', tier: 4,
    status: 'listed',
    listing_url: 'https://reviews.birdeye.com/darkside-tattoo-and-body-piercing-146776882614057',
    name_listed: 'Darkside Tattoo and Body Piercing',
    address_listed: null, phone_listed: null,
    nap_issues: null, nap_priority: null,
    is_claimed: false, has_photos: false, has_reviews: true,
    review_count: 583,
    notes: '583 aggregated reviews (pulls from Google, Yelp, etc). Informational — not a direct listing. Shows business is well-reviewed across platforms.',
    is_free: true, cost_tier: 'FREE', is_bonus: true, last_checked: TODAY
  },
  {
    site_id: SITE_ID, audit_id: AUDIT_ID,
    platform: 'TattooShopReviews',
    platform_category: 'industry', tier: 4,
    status: 'listed',
    listing_url: 'https://tattooshopreviews.com/listing/darkside-tattoo-2/darkside-tattoo-east-haven-connecticut-2/',
    name_listed: 'Darkside Tattoo',
    address_listed: 'East Haven, Connecticut',
    phone_listed: null,
    nap_issues: null, nap_priority: null,
    is_claimed: false, has_photos: false, has_reviews: true,
    review_count: 4,
    notes: '4.5 stars, 4 reviews. Niche tattoo review site. Low traffic but relevant backlink.',
    is_free: true, cost_tier: 'FREE', is_bonus: true, last_checked: TODAY
  },
];

async function main() {
  console.log(`Seeding ${listings.length} directory listings for Darkside Tattoo...`);

  // Upsert each listing (unique on site_id + platform)
  for (const listing of listings) {
    const { data, error } = await supabase
      .from('directory_listings')
      .upsert(listing, { onConflict: 'site_id,platform' });

    if (error) {
      console.error(`  ERROR [${listing.platform}]:`, error.message);
    } else {
      const icon = listing.status === 'listed' ? '\u2705' :
                   listing.status === 'needs_fix' || listing.status === 'needs_claim' ? '\u26A0\uFE0F' : '\u274C';
      console.log(`  ${icon} ${listing.platform} — ${listing.status}`);
    }
  }

  // Summary
  const listed = listings.filter(l => l.status === 'listed').length;
  const needsAttention = listings.filter(l => l.status === 'needs_fix' || l.status === 'needs_claim').length;
  const notListed = listings.filter(l => l.status === 'not_listed').length;
  const bonus = listings.filter(l => l.is_bonus).length;

  console.log(`\nAudit Scorecard:`);
  console.log(`  Total platforms checked: ${listings.length}`);
  console.log(`  \u2705 Listed & Active: ${listed} (${Math.round(listed/listings.length*100)}%)`);
  console.log(`  \u26A0\uFE0F Needs Attention: ${needsAttention} (${Math.round(needsAttention/listings.length*100)}%)`);
  console.log(`  \u274C Not Listed: ${notListed} (${Math.round(notListed/listings.length*100)}%)`);
  console.log(`  Bonus platforms discovered: ${bonus}`);
}

main().catch(e => { console.error(e); process.exit(1); });
