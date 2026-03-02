-- ============================================================
-- TattooNOW Site Audit System — v3 Migration
-- Run this in Supabase SQL Editor AFTER setup.sql has been imported
-- Adds: rank_maps, competitors, link_checklist tables
-- Adds: new columns to sites, audits, findings
-- Adds: get_rankmap_trend function
-- ============================================================

-- ============================================================
-- ALTER TABLE: sites — add intake form fields
-- ============================================================
ALTER TABLE sites ADD COLUMN IF NOT EXISTS target_city text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS target_state text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS target_area text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS target_radius_mi integer DEFAULT 10;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS gbp_primary_category text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS gbp_secondary_categories text[];
ALTER TABLE sites ADD COLUMN IF NOT EXISTS gbp_services text[];
ALTER TABLE sites ADD COLUMN IF NOT EXISTS gbp_review_count integer;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS gbp_review_rating numeric(2,1);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS gbp_landing_page text DEFAULT '/';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS gbp_place_id text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS retheme_detected boolean DEFAULT false;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS retheme_target text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS artist_count integer;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS artist_names text[];
ALTER TABLE sites ADD COLUMN IF NOT EXISTS specialties text[];

-- ============================================================
-- ALTER TABLE: audits — add v3 fields
-- ============================================================
ALTER TABLE audits ADD COLUMN IF NOT EXISTS core30_coverage jsonb;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS indexation jsonb;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS content_briefs jsonb;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS crawler_source text DEFAULT 'builtin';

-- ============================================================
-- ALTER TABLE: findings — allow layer 0 (strategic)
-- ============================================================
-- Drop old CHECK constraint on layer and replace with one that allows 0
ALTER TABLE findings DROP CONSTRAINT IF EXISTS findings_layer_check;
ALTER TABLE findings ADD CONSTRAINT findings_layer_check CHECK (layer IN (0, 1, 2, 3));

-- Allow 'strategic' as a category value (no constraint change needed — category is text, not enum)

-- ============================================================
-- NEW TABLE: rank_maps — Hero metric storage
-- ============================================================
CREATE TABLE IF NOT EXISTS rank_maps (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  keyword         text NOT NULL,
  scan_date       date NOT NULL,
  grid_size       text NOT NULL,                        -- '7x7', '5x5', etc.
  grid_center_lat numeric,
  grid_center_lng numeric,
  grid_radius_mi  numeric,
  grid_data       jsonb,                                -- [{lat, lng, rank, in_top3: bool}]
  top_3_pct       numeric NOT NULL,                     -- HERO METRIC
  top_3_count     integer,
  total_points    integer,
  avg_rank        numeric,
  source          text NOT NULL,                        -- 'local_falcon', 'dataforseo', 'manual', 'leadsnap'
  raw_response    jsonb,
  screenshot_url  text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(site_id, keyword, scan_date)
);

CREATE INDEX IF NOT EXISTS idx_rank_maps_site_keyword ON rank_maps(site_id, keyword, scan_date DESC);

-- RLS
ALTER TABLE rank_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_rank_maps" ON rank_maps
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites)
  );

-- ============================================================
-- NEW TABLE: competitors — Per-site competitor snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS competitors (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id           uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  competitor_name   text NOT NULL,
  domain            text,
  gbp_city          text,
  indexed_pages     integer,
  review_count      integer,
  review_rating     numeric(2,1),
  categories_count  integer,
  services_count    integer,
  rank_map_top3_pct numeric,
  notes             text,
  last_checked      date,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitors_site ON competitors(site_id);

-- RLS
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_competitors" ON competitors
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites)
  );

-- ============================================================
-- NEW TABLE: link_checklist — Generated link-building tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS link_checklist (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  audit_id        uuid REFERENCES audits(id) ON DELETE CASCADE,
  link_type       text NOT NULL,                        -- 'authority', 'not_slop', 'directory', 'sponsorship'
  priority        integer NOT NULL,
  title           text NOT NULL,
  description     text NOT NULL,
  target_url      text,
  target_page     text,
  estimated_cost  text,
  status          text DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'skipped')),
  completed_date  date,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_link_checklist_site ON link_checklist(site_id, status);

-- RLS
ALTER TABLE link_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_link_checklist" ON link_checklist
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites)
  );

-- ============================================================
-- FUNCTION: get_rankmap_trend
-- Returns last 12 rank map scans for a site + keyword
-- ============================================================
CREATE OR REPLACE FUNCTION get_rankmap_trend(p_site_id uuid, p_keyword text)
RETURNS TABLE (
  scan_date date,
  top_3_pct numeric,
  avg_rank numeric,
  grid_size text,
  source text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT rm.scan_date, rm.top_3_pct, rm.avg_rank, rm.grid_size, rm.source
  FROM rank_maps rm
  WHERE rm.site_id = p_site_id
    AND rm.keyword = p_keyword
  ORDER BY rm.scan_date DESC
  LIMIT 12;
END;
$$;

-- ============================================================
-- SEED: Update Darkside Tattoo with v3 fields
-- ============================================================
UPDATE sites SET
  target_city = 'East Haven',
  target_state = 'CT',
  target_area = 'Greater New Haven',
  target_radius_mi = 10,
  gbp_primary_category = 'Tattoo Shop',
  gbp_secondary_categories = ARRAY['Body Piercing Shop'],
  gbp_services = ARRAY[]::text[],       -- empty until manually entered from GMB Everywhere
  gbp_review_count = 89,
  gbp_review_rating = 4.3,
  gbp_landing_page = '/',
  gbp_place_id = NULL,                   -- lookup pending
  retheme_detected = false,
  retheme_target = NULL,
  artist_count = 7,
  artist_names = ARRAY['Sean O''Hara', 'Melinda O''Hara', 'Bobby D', 'Colin', 'Jake', 'Nicky', 'Ray'],
  specialties = ARRAY['Custom', 'Cover-ups', 'Japanese', 'Realism', 'Body Piercing']
WHERE ghl_location_id = '56Jnv0OGTMdU1XSZyJIR';

-- Update March audit with v3 fields
UPDATE audits SET
  core30_coverage = '{
    "categories_total": 2,
    "categories_found": 1,
    "categories_missing": ["Body Piercing Shop"],
    "categories_thin": [],
    "services_total": 0,
    "services_found": 0,
    "services_missing": [],
    "services_thin": [],
    "notes": "GBP services list not yet entered — run GMB Everywhere or enter manually"
  }'::jsonb,
  indexation = '{
    "indexed_estimate": null,
    "crawled_count": 5,
    "ratio": null,
    "notes": "site: estimate not yet run"
  }'::jsonb,
  content_briefs = '[
    {
      "target_keyword": "body piercing East Haven CT",
      "page_type": "category",
      "parent_page": "/",
      "target_word_count": 1500,
      "must_include": ["piercing types", "pricing", "aftercare", "age requirements", "booking CTA"],
      "internal_links_to": ["/", "/consults"],
      "internal_links_from": ["/"],
      "priority": "high",
      "phase": 1
    },
    {
      "target_keyword": "cover-up tattoos East Haven CT",
      "page_type": "service",
      "parent_page": "/",
      "target_word_count": 1500,
      "must_include": ["process", "before/after examples", "pricing range", "consultation CTA"],
      "internal_links_to": ["/", "/consults", "/tattoo-gallery"],
      "internal_links_from": ["/", "/tattoo-gallery"],
      "priority": "high",
      "phase": 1
    },
    {
      "target_keyword": "Japanese tattoo East Haven CT",
      "page_type": "service",
      "parent_page": "/",
      "target_word_count": 1500,
      "must_include": ["style overview", "artist specializing", "gallery examples", "booking CTA"],
      "internal_links_to": ["/", "/consults"],
      "internal_links_from": ["/"],
      "priority": "medium",
      "phase": 1
    }
  ]'::jsonb,
  crawler_source = 'builtin'
WHERE id = 'bbbb0002-0000-0000-0000-000000000002';

-- Insert a manual rank_map placeholder (not yet tracked)
INSERT INTO rank_maps (site_id, keyword, scan_date, grid_size, top_3_pct, top_3_count, total_points, source)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001'::uuid,
  'tattoo shop East Haven',
  '2026-03-01',
  '7x7',
  0,
  0,
  49,
  'manual'
);

-- Done! Verify with:
-- SELECT * FROM rank_maps;
-- SELECT target_city, gbp_primary_category, artist_names FROM sites WHERE ghl_location_id = '56Jnv0OGTMdU1XSZyJIR';
-- SELECT get_rankmap_trend('a1b2c3d4-0000-0000-0000-000000000001'::uuid, 'tattoo shop East Haven');
