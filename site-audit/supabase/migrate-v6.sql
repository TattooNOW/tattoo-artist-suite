-- migrate-v6.sql: Section refresh support + keyword suggestions

-- Add section column to audit_progress for per-section tracking
ALTER TABLE audit_progress ADD COLUMN IF NOT EXISTS section text DEFAULT 'full';

-- Keyword suggestions table for DataForSEO discovery
CREATE TABLE IF NOT EXISTS keyword_suggestions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  keyword         text NOT NULL,
  search_volume   integer,
  competition     numeric(4,3),
  source          text DEFAULT 'dataforseo',
  discovered_at   timestamptz DEFAULT now(),
  selected        boolean DEFAULT false,
  UNIQUE(site_id, keyword)
);

-- Enable RLS
ALTER TABLE keyword_suggestions ENABLE ROW LEVEL SECURITY;

-- Allow anon read access (dashboard uses anon key)
CREATE POLICY "Allow anon read keyword_suggestions"
  ON keyword_suggestions FOR SELECT
  TO anon USING (true);

-- Allow service_role full access (n8n uses service_role key)
CREATE POLICY "Allow service_role all keyword_suggestions"
  ON keyword_suggestions FOR ALL
  TO service_role USING (true) WITH CHECK (true);
