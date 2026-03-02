#!/usr/bin/env node

const { supabaseService } = require('./lib/supabase');

async function run() {
  // insert site
  const siteObj = {
    ghl_location_id: '56Jnv0OGTMdU1XSZyJIR',
    domain: 'darksidetattoo.com',
    business_name: 'Darkside Tattoo & Body Piercing',
    business_type: 'studio',
    address: '190 Main Street',
    city: 'East Haven',
    state: 'CT',
    zip: '06512',
    country: 'US',
    phone: '203-469-9208',
    email: null,
    year_started: 1992,
    primary_keyword: 'tattoo studio east haven ct',
    secondary_keywords: ['tattoo shop east haven', 'body piercing east haven ct'],
    social_links: {
      instagram: 'https://instagram.com/darksidetattoostudio',
      facebook: 'https://www.facebook.com/darksidetattoostudio'
    }
  };
  let { data: site, error } = await supabaseService.from('sites').upsert(siteObj).select().single();
  if (error) throw error;
  console.log('site seeded', site.id);

  // february audit baseline
  const febAudit = {
    site_id: site.id,
    audit_date: '2026-02-15',
    audit_type: 'full',
    scores: { overall: 28, seo: 22, ai_discoverability: null, geo_readiness: 15 }
  };
  let res = await supabaseService.from('audits').insert(febAudit).select().single();
  if (res.error) throw res.error;
  console.log('feb audit inserted');

  const marchAudit = {
    site_id: site.id,
    audit_date: '2026-03-01',
    audit_type: 'full',
    scores: { overall: 0, seo: 0, ai_discoverability: 0, geo_readiness: 0 }
  };
  res = await supabaseService.from('audits').insert(marchAudit).select().single();
  if (res.error) throw res.error;
  console.log('march audit inserted');

  // insert sample findings for march audit
  const findings = [
    {
      audit_id: res.data.id,
      site_id: site.id,
      finding_id: 'MARCH-001',
      severity: 'medium',
      category: 'meta',
      layer: 1,
      title: 'Missing meta description on homepage',
      page: '/',
      finding: 'Homepage does not have a meta description tag.',
      fix: 'Add a descriptive meta description in GHL SEO settings.',
      effort_minutes: 15,
      impact: 'medium',
      status: 'open',
      first_detected: '2026-03-01'
    },
    {
      audit_id: res.data.id,
      site_id: site.id,
      finding_id: 'MARCH-002',
      severity: 'low',
      category: 'schema',
      layer: 3,
      title: 'No FAQ schema present',
      page: '/',
      finding: 'The site is missing FAQPage structured data.',
      fix: 'Generate FAQPage JSON-LD and inject via GHL tracking code.',
      effort_minutes: 30,
      impact: 'low',
      status: 'open',
      first_detected: '2026-03-01'
    }
  ];
  await supabaseService.from('findings').insert(findings);

  await supabaseService.rpc('calculate_delta', { new_audit_id: res.data.id });
  console.log('delta calculated for march');
}

run().catch(err=>{console.error(err); process.exit(1);});