/**
 * link-checklist.js — Generates link-building task list for studio owner
 * Tasks are for the STUDIO OWNER to execute — not automated acquisition
 */

/**
 * Generate the full link-building checklist for a site
 * @param {object} siteRecord — from sites table
 * @param {Array} contentBriefs — from core30-analyzer
 * @returns {Array} link checklist items
 */
function generateLinkChecklist(siteRecord, contentBriefs = []) {
  const items = [];
  const city = siteRecord.target_city || siteRecord.city || 'your city';
  const gbpCity = siteRecord.city || city;
  const state = siteRecord.state || '';
  const businessName = siteRecord.business_name || 'your business';
  let priority = 0;

  // ──── Tier 1: Local Authority Links ────

  // 1. Chamber of Commerce — GBP city
  priority++;
  items.push({
    link_type: 'authority',
    priority,
    title: `Join ${gbpCity} Chamber of Commerce`,
    description: `Most powerful per-dollar local authority link. Search "${gbpCity} ${state} chamber of commerce" to find the application page. Annual membership is typically $100-300.`,
    target_url: null, // lookup is manual
    target_page: null,
    estimated_cost: '$100-300/yr'
  });

  // If target city differs from GBP city, add a second chamber
  if (siteRecord.target_city && siteRecord.city && siteRecord.target_city !== siteRecord.city) {
    priority++;
    items.push({
      link_type: 'authority',
      priority,
      title: `Join ${siteRecord.target_city} Chamber of Commerce`,
      description: `Your GBP is in ${gbpCity} but your target market is ${siteRecord.target_city}. A chamber membership in both cities strengthens your authority in the target area.`,
      target_url: null,
      target_page: null,
      estimated_cost: '$100-300/yr'
    });
  }

  // 2. Tattoo community directories
  const tattooDirectories = [
    { name: 'TattooNOW', url: 'https://www.tattoonow.com', cost: 'Free-$50' },
    { name: 'TattooFilter', url: 'https://www.tattoofilter.com', cost: 'Free' },
    { name: 'Tattoodo', url: 'https://www.tattoodo.com', cost: 'Free' },
    { name: 'InkMatch', url: 'https://www.inkmatch.com', cost: 'Free' },
  ];

  for (const dir of tattooDirectories) {
    priority++;
    items.push({
      link_type: 'directory',
      priority,
      title: `Claim/update ${dir.name} listing`,
      description: `Niche authority + citation consistency. Make sure NAP (name, address, phone) matches your GBP exactly. Add photos and service descriptions.`,
      target_url: dir.url,
      target_page: null,
      estimated_cost: dir.cost
    });
  }

  // 3. General business directories
  const generalDirectories = [
    { name: 'Yelp', url: 'https://biz.yelp.com' },
    { name: 'BBB', url: 'https://www.bbb.org' },
    { name: 'Yellow Pages', url: 'https://www.yellowpages.com' },
    { name: 'Apple Maps', url: 'https://mapsconnect.apple.com' },
    { name: 'Bing Places', url: 'https://www.bingplaces.com' },
  ];

  for (const dir of generalDirectories) {
    priority++;
    items.push({
      link_type: 'directory',
      priority,
      title: `Claim/update ${dir.name} listing`,
      description: `Citation consistency + basic authority. Ensure NAP matches your GBP exactly.`,
      target_url: dir.url,
      target_page: null,
      estimated_cost: 'Free'
    });
  }

  // 4. Local sponsorship suggestions
  priority++;
  items.push({
    link_type: 'sponsorship',
    priority,
    title: `Sponsor a local event or youth league in ${city}`,
    description: `.org and .edu links are disproportionately powerful. Search "${city} youth sports sponsor" or "${city} charity events" to find opportunities. Even $50-100 sponsorships often get you a link.`,
    target_url: null,
    target_page: null,
    estimated_cost: '$50-500'
  });

  // 5. Convention website listings
  priority++;
  items.push({
    link_type: 'authority',
    priority,
    title: 'Get listed on tattoo convention websites',
    description: `If you attend or participate in conventions, make sure ${businessName} is listed on their website with a link to your site. Contact convention organizers directly.`,
    target_url: null,
    target_page: null,
    estimated_cost: 'Free'
  });

  // ──── Tier 2: "Not Slop" Links — one per content brief page ────
  for (const brief of contentBriefs) {
    priority++;
    const keyword = brief.target_keyword || brief.keyword || 'this page';
    const pagePath = brief.parent_page || '/';

    items.push({
      link_type: 'not_slop',
      priority,
      title: `Get one quality link for "${keyword}" page`,
      description: `Every new page needs at least one decent external link. Signals to Google it's not AI-generated content. Options: share on studio Instagram/Facebook with link to the page, submit to a relevant forum or community, or ask a satisfied client to mention it on their blog/social.`,
      target_url: null,
      target_page: pagePath,
      estimated_cost: 'Free'
    });
  }

  return items;
}

module.exports = { generateLinkChecklist };
