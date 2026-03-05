-- migrate-v5.sql — Audit billing + Apify usage tracking
-- Run in Supabase SQL Editor

-- ── audit_billing: per-report cost tracking + $2 charge ──
CREATE TABLE IF NOT EXISTS audit_billing (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  audit_id        uuid REFERENCES audits(id) ON DELETE SET NULL,
  audit_date      date NOT NULL,

  -- Cost breakdown
  apify_cost      numeric(8,4) DEFAULT 0,
  api_costs       jsonb DEFAULT '{}'::jsonb,    -- {"perplexity": 0.02, "openai": 0.01}
  total_cost      numeric(8,4) DEFAULT 0,

  -- Billing
  charge_amount   numeric(8,2) DEFAULT 2.00,
  margin          numeric(8,4) GENERATED ALWAYS AS (charge_amount - total_cost) STORED,

  -- Apify run details
  apify_runs      jsonb DEFAULT '[]'::jsonb,    -- [{actor, runId, cost, durationMs, status}]

  -- Status
  billing_status  text DEFAULT 'pending' CHECK (billing_status IN ('pending', 'invoiced', 'paid', 'waived')),

  created_at      timestamptz DEFAULT now(),
  UNIQUE(site_id, audit_date)
);

CREATE INDEX IF NOT EXISTS idx_audit_billing_site ON audit_billing(site_id, audit_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_billing_status ON audit_billing(billing_status);

ALTER TABLE audit_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_audit_billing" ON audit_billing
  FOR SELECT USING (true);
CREATE POLICY "service_write_audit_billing" ON audit_billing
  FOR ALL USING (true) WITH CHECK (true);

-- ── apify_usage_log: granular per-actor-run log ──
CREATE TABLE IF NOT EXISTS apify_usage_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  audit_id        uuid REFERENCES audits(id) ON DELETE SET NULL,
  actor_id        text NOT NULL,
  actor_name      text NOT NULL,
  run_id          text,
  status          text DEFAULT 'pending',
  cost_usd        numeric(8,6) DEFAULT 0,
  duration_ms     integer,
  items_returned  integer,
  input_params    jsonb,
  error_message   text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apify_usage_site ON apify_usage_log(site_id, created_at DESC);

ALTER TABLE apify_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_apify_usage" ON apify_usage_log
  FOR SELECT USING (true);
CREATE POLICY "service_write_apify_usage" ON apify_usage_log
  FOR ALL USING (true) WITH CHECK (true);

-- ── Add social_links column to sites if not exists ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'social_links') THEN
    ALTER TABLE sites ADD COLUMN social_links jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;
