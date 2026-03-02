-- ============================================================
-- TattooNOW Site Audit System — Supabase Setup
-- Run this in Supabase SQL Editor (or via CLI)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: sites
-- One row per client site
-- ============================================================
CREATE TABLE sites (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ghl_location_id text UNIQUE NOT NULL,
  domain          text NOT NULL,
  business_name   text NOT NULL,
  business_type   text NOT NULL CHECK (business_type IN ('studio', 'event', 'portfolio', 'saas')),
  address         text,
  city            text,
  state           text,
  zip             text,
  country         text DEFAULT 'US',
  phone           text,
  email           text,
  year_started    integer,
  primary_keyword text,
  secondary_keywords text[],
  social_links    jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_sites_ghl ON sites(ghl_location_id);
CREATE INDEX idx_sites_domain ON sites(domain);

-- ============================================================
-- TABLE: audits
-- One row per audit run
-- ============================================================
CREATE TABLE audits (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  audit_date      date NOT NULL,
  audit_type      text NOT NULL CHECK (audit_type IN ('full', 'seo_only', 'ai_only', 'geo_only')),
  scores          jsonb NOT NULL,
  delta           jsonb,
  pages_checked   jsonb,
  link_inventory  jsonb,
  run_duration_ms integer,
  triggered_by    text DEFAULT 'manual',
  created_at      timestamptz DEFAULT now(),
  UNIQUE(site_id, audit_date, audit_type)
);

CREATE INDEX idx_audits_site_date ON audits(site_id, audit_date DESC);

-- ============================================================
-- TABLE: findings
-- Individual checklist items per audit
-- ============================================================
CREATE TABLE findings (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id        uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  finding_id      text NOT NULL,
  severity        text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  category        text NOT NULL,
  layer           integer NOT NULL CHECK (layer IN (1, 2, 3)),
  title           text NOT NULL,
  page            text,
  finding         text NOT NULL,
  fix             text NOT NULL,
  effort_minutes  integer,
  impact          text CHECK (impact IN ('high', 'medium', 'low')),
  status          text DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'wont_fix', 'in_progress')),
  first_detected  date NOT NULL,
  fixed_date      date,
  still_open_since date,
  metadata        jsonb,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_findings_audit ON findings(audit_id);
CREATE INDEX idx_findings_site_status ON findings(site_id, status);
CREATE INDEX idx_findings_severity ON findings(severity);


-- ============================================================
-- TABLE: ai_mentions
-- AI discoverability probe results
-- ============================================================
CREATE TABLE ai_mentions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id        uuid REFERENCES audits(id) ON DELETE CASCADE,
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  probe_date      date NOT NULL,
  engine          text NOT NULL CHECK (engine IN ('chatgpt', 'perplexity', 'claude', 'google_ai')),
  query           text NOT NULL,
  mentioned       boolean NOT NULL,
  mention_text    text,
  nap_accurate    boolean,
  sentiment       text CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  competitors     text[],
  citations       text[],
  raw_response    text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_mentions_site_engine ON ai_mentions(site_id, engine, probe_date DESC);

-- ============================================================
-- TABLE: geo_signals
-- Structured data / AEO readiness checks
-- ============================================================
CREATE TABLE geo_signals (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id        uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  signal_name     text NOT NULL,
  signal_value    boolean NOT NULL,
  details         text,
  page            text,
  recommendation  text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_geo_signals_audit ON geo_signals(audit_id);

-- ============================================================
-- RLS POLICIES
-- Anon key: read-only, scoped to locationId
-- Service role: full access (bypasses RLS automatically)
-- ============================================================

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_signals ENABLE ROW LEVEL SECURITY;

-- Sites: anon can read if they know the ghl_location_id
CREATE POLICY "anon_read_sites" ON sites
  FOR SELECT USING (true);
  -- Dashboard filters by locationId in app code.
  -- We allow SELECT on all sites since locationIds are not secret
  -- and the dashboard only queries for one at a time.

-- Audits: anon can read audits for any site they can see
CREATE POLICY "anon_read_audits" ON audits
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites)
  );

-- Findings: anon can read
CREATE POLICY "anon_read_findings" ON findings
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites)
  );

-- AI mentions: anon can read
CREATE POLICY "anon_read_ai_mentions" ON ai_mentions
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites)
  );

-- GEO signals: anon can read
CREATE POLICY "anon_read_geo_signals" ON geo_signals
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites)
  );

-- No INSERT/UPDATE/DELETE policies for anon.
-- All writes go through service_role key (n8n, scripts).

-- ============================================================
-- FUNCTION: calculate_delta
-- Call after inserting a new audit to compute deltas
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_delta(new_audit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_site_id uuid;
  v_audit_date date;
  v_audit_type text;
  v_prev_audit_id uuid;
  v_current_scores jsonb;
  v_prev_scores jsonb;
  v_delta jsonb;
  v_prev_finding record;
  v_current_finding_ids text[];
BEGIN
  -- Get the new audit's info
  SELECT site_id, audit_date, audit_type, scores
  INTO v_site_id, v_audit_date, v_audit_type, v_current_scores
  FROM audits WHERE id = new_audit_id;

  -- Find the most recent previous audit of the same type for this site
  SELECT id, scores INTO v_prev_audit_id, v_prev_scores
  FROM audits
  WHERE site_id = v_site_id
    AND audit_type = v_audit_type
    AND audit_date < v_audit_date
  ORDER BY audit_date DESC
  LIMIT 1;

  -- If no previous audit, delta is null
  IF v_prev_audit_id IS NULL THEN
    UPDATE audits SET delta = NULL WHERE id = new_audit_id;
    RETURN;
  END IF;

  -- Calculate score deltas
  v_delta = jsonb_build_object(
    'overall', (v_current_scores->>'overall')::numeric - (v_prev_scores->>'overall')::numeric,
    'seo', COALESCE((v_current_scores->'seo'->>'score')::numeric, 0) - COALESCE((v_prev_scores->'seo'->>'score')::numeric, 0),
    'ai_discoverability', COALESCE((v_current_scores->'ai_discoverability'->>'score')::numeric, 0) - COALESCE((v_prev_scores->'ai_discoverability'->>'score')::numeric, 0),
    'geo_readiness', COALESCE((v_current_scores->'geo_readiness'->>'score')::numeric, 0) - COALESCE((v_prev_scores->'geo_readiness'->>'score')::numeric, 0),
    'previous_audit_id', v_prev_audit_id::text,
    'previous_audit_date', v_audit_date::text
  );

  UPDATE audits SET delta = v_delta WHERE id = new_audit_id;

  -- Get current finding IDs for comparison
  SELECT array_agg(finding_id) INTO v_current_finding_ids
  FROM findings WHERE audit_id = new_audit_id;

  -- For persistent findings: update still_open_since
  UPDATE findings f_new
  SET still_open_since = f_old.first_detected
  FROM findings f_old
  WHERE f_new.audit_id = new_audit_id
    AND f_old.audit_id = v_prev_audit_id
    AND f_new.finding_id = f_old.finding_id
    AND f_new.status = 'open';

  -- Mark fixed: previous findings not in current audit
  FOR v_prev_finding IN
    SELECT finding_id, id
    FROM findings
    WHERE audit_id = v_prev_audit_id
      AND status = 'open'
      AND finding_id != ALL(COALESCE(v_current_finding_ids, ARRAY[]::text[]))
  LOOP
    UPDATE findings
    SET status = 'fixed', fixed_date = v_audit_date
    WHERE id = v_prev_finding.id;
  END LOOP;

END;
$$;


-- ============================================================
-- SEED DATA: Darkside Tattoo
-- ============================================================

-- Site record
INSERT INTO sites (
  id, ghl_location_id, domain, business_name, business_type,
  address, city, state, zip, country, phone, email,
  year_started, primary_keyword, secondary_keywords,
  social_links
) VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
  '56Jnv0OGTMdU1XSZyJIR',
  'darksidetattoo.com',
  'Darkside Tattoo & Body Piercing',
  'studio',
  '190 Main Street',
  'East Haven',
  'CT',
  '06512',
  'US',
  '203-469-9208',
  NULL,
  1992,
  'tattoo studio east haven ct',
  ARRAY['tattoo shop east haven', 'body piercing east haven ct', 'custom tattoos new haven area', 'east haven tattoo artist'],
  '{
    "instagram": "https://instagram.com/darksidetattoostudio",
    "facebook": "https://www.facebook.com/darksidetattoostudio",
    "tiktok": "https://TikTok.com/@darksidetatstudio",
    "youtube": "https://youtube.com/@darksidetattoostudio",
    "x": "https://x.com/DarksideTatShop",
    "linkedin": "https://www.linkedin.com/in/darksidetattoostudio/"
  }'::jsonb
);


-- ============================================================
-- AUDIT 1: February 2026 baseline (pre-GHL migration complete)
-- This represents the state when the site was partially migrated
-- ============================================================

INSERT INTO audits (
  id, site_id, audit_date, audit_type, scores,
  pages_checked, link_inventory, triggered_by
) VALUES (
  'aaaa0001-0000-0000-0000-000000000001'::uuid,
  'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
  '2026-02-02',
  'full',
  '{
    "overall": 28,
    "seo": {"score": 22, "weight": 0.35},
    "ai_discoverability": {"score": null, "weight": 0.35, "note": "not tested"},
    "geo_readiness": {"score": 15, "weight": 0.30}
  }'::jsonb,
  '[
    {"url": "/", "status": 200, "title": "Darkside Tattoo and Body Piercing", "title_length": 37, "h1_count": 1, "meta_desc": false}
  ]'::jsonb,
  '{
    "total": 20,
    "working": 3,
    "broken": 12,
    "unknown": 5,
    "link_health_score": 15,
    "notes": "Most internal pages not yet migrated to GHL. Many old TattooNOW URLs returning 404."
  }'::jsonb,
  'manual'
);

-- Feb findings
INSERT INTO findings (audit_id, site_id, finding_id, severity, category, layer, title, page, finding, fix, effort_minutes, impact, status, first_detected, still_open_since, metadata) VALUES
('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'HIGH-001', 'high', 'seo', 1,
 'No meta description on any page', 'site-wide',
 'No meta description tag detected on any page',
 'GHL > Settings > SEO Meta Data > Add description with keywords, location, CTA, phone number',
 15, 'high', 'open', '2026-02-02', '2026-02-02', NULL),

('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'HIGH-002', 'high', 'seo', 1,
 'No structured data / JSON-LD schema', 'site-wide',
 'No LocalBusiness or Organization schema detected',
 'GHL > Settings > Tracking Code > Header > Paste LocalBusiness JSON-LD',
 20, 'high', 'open', '2026-02-02', '2026-02-02', NULL),

('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'HIGH-003', 'high', 'seo', 1,
 'No robots.txt or sitemap.xml', 'site-wide',
 'Neither file accessible',
 'GHL > Settings > verify sitemap generation. Submit to Google Search Console',
 20, 'high', 'open', '2026-02-02', '2026-02-02', NULL),

('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'MED-001', 'medium', 'seo', 1,
 'Persistent typos across pages', 'site-wide',
 'Multiple spelling errors: "acheived", "CONSULTATOIN" in footer',
 'Find-and-replace in GHL page editor. Footer requires editing global section.',
 20, 'medium', 'open', '2026-02-02', '2026-02-02',
 '{"typos": [
    {"page": "/", "text": "acheived", "correction": "achieved"},
    {"page": "/info", "text": "tradtional", "correction": "traditional"},
    {"page": "/info", "text": "thouroughly", "correction": "thoroughly"},
    {"page": "/info", "text": "recommmended", "correction": "recommended"},
    {"page": "/info", "text": "atleast", "correction": "at least"},
    {"page": "/history", "text": "alot", "correction": "a lot", "count": 2},
    {"page": "footer", "text": "CONSULTATOIN", "correction": "CONSULTATION"},
    {"page": "footer", "text": "lastest", "correction": "latest"}
  ]}'::jsonb),

('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'LOW-001', 'low', 'seo', 1,
 'No alt text on most images', 'site-wide',
 'Hero images, logo, gallery images missing alt attributes',
 'GHL > each page > click images > add descriptive alt text',
 30, 'medium', 'open', '2026-02-02', '2026-02-02', NULL),

('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'MED-002', 'medium', 'seo', 1,
 'Title tag too short, missing keywords', '/',
 'Title: "Darkside Tattoo and Body Piercing" (37 chars). No location, no "studio" keyword.',
 'Change to: "Darkside Tattoo Studio | Custom Tattoos & Piercing | East Haven CT"',
 5, 'medium', 'open', '2026-02-02', '2026-02-02', NULL),

('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'HIGH-004', 'high', 'platform', 1,
 'Social media links point to platform homepages', 'site-wide',
 'GHL template default social icons linking to facebook.com, instagram.com instead of actual profiles',
 'GHL > Footer > Update each social link to actual business profile URLs',
 10, 'high', 'open', '2026-02-02', NULL, NULL),

('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'CRIT-001', 'critical', 'platform', 1,
 'Most internal pages not yet migrated', 'site-wide',
 'Gallery, artist bios, info pages, booking all returning 404. Only homepage functional.',
 'Complete GHL page build-out for all site sections',
 480, 'high', 'open', '2026-02-02', NULL, NULL);
INSERT INTO geo_signals (audit_id, site_id, signal_name, signal_value, details, page, recommendation) VALUES
('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'direct_answer_blocks', false, 'No "Darkside Tattoo is..." definition pattern found', '/', 'Add opening paragraph: "Darkside Tattoo is a custom tattoo studio in East Haven, CT, established in 1992..."'),
('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'faq_structure', false, 'No FAQ content on site', NULL, 'Create FAQ page with Q&A pairs matching common search queries'),
('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'faq_schema', false, 'No FAQPage JSON-LD', NULL, 'Generate and inject FAQPage schema'),
('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'entity_clarity', false, 'Business name present but no clear definition block', '/', 'Structure first paragraph as entity definition'),
('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'service_specificity', false, 'No pricing or service details on site', NULL, 'Add pricing page with specific dollar amounts'),
('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'structured_hours', false, 'Hours not in schema or parseable format', NULL, 'Add hours to LocalBusiness schema'),
('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'structured_contact', false, 'Phone visible but not in schema', '/', 'Add phone + address to LocalBusiness JSON-LD'),
('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'review_signals', false, 'No testimonials or reviews on site', NULL, 'Add testimonials page with structured review markup'),
('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'freshness', false, 'No blog or news content', NULL, 'Start blog with regular posts'),
('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'topical_authority', false, 'Only 1 indexable page', '/', 'Build out 10+ pages covering services, artists, aftercare, FAQ'),
('aaaa0001-0000-0000-0000-000000000001'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'natural_language_match', false, 'No headings match conversational search queries', NULL, 'Add headings like "How much does a tattoo cost at Darkside?" and "How do I book a tattoo in East Haven?"');


-- ============================================================
-- AUDIT 2: March 2026 (post GHL migration, current state)
-- ============================================================

INSERT INTO audits (
  id, site_id, audit_date, audit_type, scores,
  pages_checked, link_inventory, triggered_by
) VALUES (
  'bbbb0002-0000-0000-0000-000000000002'::uuid,
  'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
  '2026-03-01',
  'full',
  '{
    "overall": 42,
    "seo": {"score": 38, "weight": 0.35},
    "ai_discoverability": {"score": null, "weight": 0.35, "note": "not yet probed"},
    "geo_readiness": {"score": 25, "weight": 0.30}
  }'::jsonb,
  '[
    {"url": "/", "status": 200, "title": "Darkside Tattoo & Body Piercing - Greater New Haven CT", "title_length": 54, "h1_count": 2, "meta_desc": false},
    {"url": "/tattoo-gallery", "status": 200, "title": "Bioshock Songbird", "title_length": 17, "h1_count": 1, "meta_desc": false, "notes": "Title pulling from first blog post, not gallery page"},
    {"url": "/consults", "status": 200, "title": "Fresh Tattoos Emailed Weekly:", "title_length": 29, "h1_count": 1, "meta_desc": false, "notes": "Title pulling from footer section"},
    {"url": "/info", "status": 200, "title": "Fresh Tattoos Emailed Weekly:", "title_length": 29, "h1_count": 1, "meta_desc": false},
    {"url": "/history", "status": 200, "title": "Fresh Tattoos Emailed Weekly:", "title_length": 29, "h1_count": 1, "meta_desc": false, "notes": "Content in reverse chronological order"}
  ]'::jsonb,
  '{
    "total": 52,
    "working": 38,
    "broken": 2,
    "double_slash": 2,
    "undefined": 1,
    "external_working": 8,
    "external_broken": 0,
    "link_health_score": 72,
    "broken_details": [
      {"url": "/undefined", "source": "/tattoo-gallery", "context": "Piercing nav > Book piercing link"},
      {"url": "//history", "source": "site-wide footer", "context": "ABOUT US link"},
      {"url": "//consults", "source": "site-wide footer + nav", "context": "Book Consult button + footer CTA"}
    ]
  }'::jsonb,
  'manual'
);

INSERT INTO findings (audit_id, site_id, finding_id, severity, category, layer, title, page, finding, fix, effort_minutes, impact, status, first_detected, still_open_since, metadata) VALUES

-- CRITICAL: New findings from March
('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'CRIT-002', 'critical', 'platform', 1,
 'Consult form leaks UTM parameter names into page', '/consults',
 'Raw field names visible to users: utm_medium, am_id, fbclid, gclid, utm_campaign, utm_keyword, utm_term, utm_source',
 'GHL > Sites > Consults page > Edit form > Set hidden fields to Hidden type, not text input',
 10, 'high', 'open', '2026-03-01', NULL, NULL),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'CRIT-003', 'critical', 'platform', 1,
 'Consult form shows empty-state messages to visitors', '/consults',
 'Artist picker dropdown renders "No elements found" and "List is empty" to end users',
 'GHL > Form builder > Artist dropdown > Check data source binding, ensure options populate without search',
 15, 'high', 'open', '2026-03-01', NULL, NULL),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'CRIT-004', 'critical', 'platform', 1,
 'Piercing booking link resolves to /undefined on gallery page', '/tattoo-gallery',
 'Nav Piercing > "Book your Body Piercing online!" href is /undefined. Only broken on gallery page.',
 'GHL > Navigation > Verify piercing booking URL is hardcoded to /book-piercing on ALL page templates',
 5, 'high', 'open', '2026-03-01', NULL, NULL),

-- HIGH: Persistent from Feb (still_open_since set)
('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'HIGH-001', 'high', 'seo', 1,
 'No meta description on any page', 'site-wide',
 'No meta description tag on homepage, gallery, info, history, or consults',
 'GHL > Settings > SEO Meta Data > Add: "Custom tattoos and professional body piercing in East Haven, CT since 1992. Book your free consultation today. (203) 469-9208"',
 15, 'high', 'open', '2026-02-02', '2026-02-02', NULL),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'HIGH-002', 'high', 'seo', 1,
 'No structured data / JSON-LD schema', 'site-wide',
 'No LocalBusiness, TattooShop, or Organization schema detected',
 'GHL > Settings > Tracking Code > Header > Paste LocalBusiness JSON-LD with NAP, hours, geo, sameAs',
 20, 'high', 'open', '2026-02-02', '2026-02-02', NULL),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'HIGH-003', 'high', 'seo', 1,
 'No robots.txt or sitemap.xml detected', 'site-wide',
 'Neither file returned results. GHL may auto-generate but not accessible.',
 'GHL > Settings > verify sitemap enabled. Submit to Google Search Console.',
 20, 'high', 'open', '2026-02-02', '2026-02-02', NULL),

-- HIGH: New findings
('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'HIGH-005', 'high', 'seo', 1,
 'Double-slash URLs in footer navigation', 'site-wide footer',
 'ABOUT US links to //history, BOOK A FREE CONSULTATION links to //consults. Creates protocol-relative URLs.',
 'GHL > Footer section > Remove extra leading slash from /history and /consults hrefs',
 5, 'medium', 'open', '2026-03-01', NULL, NULL),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'HIGH-006', 'high', 'seo', 1,
 'Gallery and subpage title tags pulling wrong content', '/tattoo-gallery',
 'Gallery title is "Bioshock Songbird" (first blog post title). Consults and Info pages title is "Fresh Tattoos Emailed Weekly:" (footer section). Only homepage has a real title.',
 'GHL > Each page > Settings > SEO Meta Data > Set unique, keyword-rich title per page',
 15, 'high', 'open', '2026-03-01', NULL, NULL),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'HIGH-007', 'high', 'seo', 1,
 'History page content in reverse chronological order', '/history',
 'Page opens with 2010 reopening story. 1992 founding buried at bottom. Visitor encounters middle of story first.',
 'GHL > History page > Rearrange content blocks: 1992 founding first, progress to present day',
 15, 'medium', 'open', '2026-03-01', NULL, NULL),

-- MEDIUM: Persistent from Feb
('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'MED-001', 'medium', 'seo', 1,
 'Persistent typos across multiple pages', 'site-wide',
 'Homepage: "acheived". Info: "tradtional", "thouroughly", "recommmended", "atleast". History: "alot" x2. Footer: "CONSULTATOIN", "lastest".',
 'Find-and-replace in GHL page editor. Footer typos require editing global footer section.',
 20, 'medium', 'open', '2026-02-02', '2026-02-02',
 '{"typos": [
    {"page": "/", "text": "acheived", "correction": "achieved"},
    {"page": "/info", "text": "tradtional", "correction": "traditional"},
    {"page": "/info", "text": "thouroughly", "correction": "thoroughly"},
    {"page": "/info", "text": "recommmended", "correction": "recommended"},
    {"page": "/info", "text": "atleast", "correction": "at least"},
    {"page": "/history", "text": "alot", "correction": "a lot", "count": 2},
    {"page": "footer", "text": "CONSULTATOIN", "correction": "CONSULTATION"},
    {"page": "footer", "text": "lastest", "correction": "latest"}
  ]}'::jsonb),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'MED-002', 'medium', 'seo', 1,
 'Homepage title missing primary keyword', '/',
 'Current: "Darkside Tattoo & Body Piercing - Greater New Haven CT" (54 chars). Missing "studio" keyword. "Greater New Haven" is vague — actual city is East Haven.',
 'Change to: "Darkside Tattoo Studio | Custom Tattoos & Piercing | East Haven CT" (62 chars)',
 5, 'medium', 'open', '2026-02-02', '2026-02-02', NULL),

-- MEDIUM: New
('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'MED-003', 'medium', 'seo', 1,
 'Relative URLs in nav for 2 items', 'site-wide nav',
 '"Our Mission and Values" links to relative "mission-and-values". "Bella Taverney" links to relative "artist-bio-bella-taverney". All others use absolute URLs.',
 'GHL > Navigation > Change both to absolute: https://darksidetattoo.com/mission-and-values and /artist-bio-bella-taverney',
 5, 'low', 'open', '2026-03-01', NULL, NULL),

-- LOW: Persistent
('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'LOW-001', 'low', 'seo', 1,
 'No alt text on most images', 'site-wide',
 'Hero images, footer logo, and most gallery images have empty or missing alt. Only logo and blog thumbnails have alt.',
 'GHL > each page > click images > add descriptive alt. Priority: logo, hero images, artist photos.',
 30, 'medium', 'open', '2026-02-02', '2026-02-02', NULL),

-- LOW: New
('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'LOW-002', 'low', 'seo', 1,
 'Blog post description bleeds raw URL', '/tattoo-gallery',
 'Bioshock Songbird post includes raw URL "https://www.darksidetattoo" in description. IG caption used verbatim.',
 'GHL > Blog > Edit post > Clean excerpt. Consider workflow rule to strip URLs from auto-imported IG captions.',
 5, 'low', 'open', '2026-03-01', NULL, NULL);

INSERT INTO geo_signals (audit_id, site_id, signal_name, signal_value, details, page, recommendation) VALUES
('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'direct_answer_blocks', false,
 'Homepage opens with "Not many studios have ever acheived..." — narrative, not definition. No "Darkside Tattoo is..." pattern.',
 '/', 'Rewrite opening paragraph: "Darkside Tattoo is a custom tattoo studio in East Haven, CT. Established in 1992, we specialize in..."'),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'faq_structure', true,
 'FAQ page exists at /faq (linked from nav). Could not verify content structure via fetch.',
 '/faq', 'Ensure each FAQ uses question heading + immediate paragraph answer format'),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'faq_schema', false,
 'No FAQPage JSON-LD detected',
 '/faq', 'Generate FAQPage schema from FAQ content and inject via GHL header code'),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'entity_clarity', true,
 'Business name, city, state, phone all present on homepage. Year (1992) mentioned. But spread across page, not in a clear definition block.',
 '/', 'Consolidate entity info into opening paragraph for AI extraction'),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'service_specificity', true,
 'Tattoo pricing on /info: $90 minimum, $175/hr. Piercing prices with specific dollar amounts for each type.',
 '/info', 'Add Service schema with priceRange for each service type'),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'structured_hours', false,
 'Hours visible in nav dropdown (Tue-Sat 11am-6pm) but not in JSON-LD schema',
 NULL, 'Add openingHoursSpecification to LocalBusiness schema'),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'structured_contact', false,
 'Phone and address visible on page but not in JSON-LD',
 NULL, 'Add telephone and address to LocalBusiness schema'),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'review_signals', true,
 'Testimonials page exists at /testimonials (linked from nav + footer)',
 '/testimonials', 'Add AggregateRating or Review schema based on testimonial content'),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'freshness', true,
 'Most recent blog post: Bioshock Songbird by Sean OHara, published 24 Feb 2026 (5 days ago)',
 '/tattoo-gallery', 'Maintain weekly posting cadence'),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'topical_authority', true,
 '100+ blog posts in gallery. Individual artist bio pages (7 artists). Info page, history page, FAQ page, events page. 15+ indexable pages.',
 NULL, 'Continue building content. Add aftercare and pricing as separate pages for deeper topical coverage.'),

('bbbb0002-0000-0000-0000-000000000002'::uuid, 'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
 'natural_language_match', false,
 'No headings match conversational query patterns like "How much does a tattoo cost at Darkside?" or "Where is Darkside Tattoo located?"',
 NULL, 'Rewrite FAQ and info page headings to match how people actually ask questions');


-- ============================================================
-- Run delta calculation for the March audit
-- ============================================================
SELECT calculate_delta('bbbb0002-0000-0000-0000-000000000002'::uuid);


-- ============================================================
-- Mark the Feb finding that got FIXED (social links)
-- The automated delta function handles findings that disappear,
-- but HIGH-004 (social links) was explicitly fixed.
-- We update it manually since it's not in the March findings.
-- ============================================================
UPDATE findings
SET status = 'fixed', fixed_date = '2026-03-01'
WHERE audit_id = 'aaaa0001-0000-0000-0000-000000000001'::uuid
  AND finding_id = 'HIGH-004';

-- CRIT-001 (pages not migrated) is also fixed
UPDATE findings
SET status = 'fixed', fixed_date = '2026-03-01'
WHERE audit_id = 'aaaa0001-0000-0000-0000-000000000001'::uuid
  AND finding_id = 'CRIT-001';


-- ============================================================
-- Verify
-- ============================================================
-- Run these to confirm:
-- SELECT * FROM sites;
-- SELECT id, audit_date, scores, delta FROM audits ORDER BY audit_date;
-- SELECT finding_id, severity, title, status, first_detected, still_open_since FROM findings WHERE audit_id = 'bbbb0002-0000-0000-0000-000000000002'::uuid ORDER BY severity, finding_id;
-- SELECT signal_name, signal_value FROM geo_signals WHERE audit_id = 'bbbb0002-0000-0000-0000-000000000002'::uuid;
