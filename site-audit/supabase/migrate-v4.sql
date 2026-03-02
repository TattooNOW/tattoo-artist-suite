-- ============================================================
-- TattooNOW Site Audit System — v4 Migration
-- Run this in Supabase SQL Editor AFTER migrate-v3.sql
-- Adds: directory_listings table for NAP consistency audits
-- ============================================================

-- ============================================================
-- NEW TABLE: directory_listings — Directory presence + NAP audit
-- One row per platform per site. Updated each audit run.
-- ============================================================
CREATE TABLE IF NOT EXISTS directory_listings (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  audit_id        uuid REFERENCES audits(id) ON DELETE CASCADE,
  platform        text NOT NULL,               -- 'google_business', 'yelp', 'facebook', etc.
  platform_category text NOT NULL,             -- 'search', 'reviews', 'social', 'directory', 'industry', 'data_aggregator'
  tier            integer NOT NULL DEFAULT 1,  -- 1=critical, 2=high, 3=industry, 4=secondary, 5=regional
  status          text NOT NULL CHECK (status IN ('listed', 'needs_fix', 'needs_claim', 'not_listed')),
  listing_url     text,                        -- direct link to the listing (clickable)
  name_listed     text,                        -- business name as it appears on this platform
  address_listed  text,                        -- address as it appears
  phone_listed    text,                        -- phone as it appears
  nap_issues      text[],                      -- ['wrong_city', 'old_address', 'name_variation', etc.]
  nap_priority    text CHECK (nap_priority IN ('P0', 'P1', 'P2')),  -- fix urgency
  is_claimed      boolean,                     -- has the business claimed this listing?
  has_photos      boolean,
  has_reviews     boolean,
  review_count    integer,
  notes           text,                        -- audit notes, what's wrong, what's missing
  is_free         boolean DEFAULT true,        -- free vs paid listing
  cost_tier       text DEFAULT 'FREE',         -- 'FREE', '$', '$$', '$$$'
  is_bonus        boolean DEFAULT false,       -- found during audit, not in master checklist
  last_checked    date NOT NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(site_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_directory_listings_site ON directory_listings(site_id, status);
CREATE INDEX IF NOT EXISTS idx_directory_listings_audit ON directory_listings(audit_id);
CREATE INDEX IF NOT EXISTS idx_directory_listings_priority ON directory_listings(site_id, nap_priority);

-- RLS
ALTER TABLE directory_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_directory_listings" ON directory_listings
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites)
  );

-- ============================================================
-- Verify
-- ============================================================
-- SELECT * FROM directory_listings WHERE site_id = 'a1b2c3d4-0000-0000-0000-darksidetattoo'::uuid;
