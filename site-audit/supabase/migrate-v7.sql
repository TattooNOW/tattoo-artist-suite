-- migrate-v7.sql: Credit system for audit reports

-- Add credit columns to sites
ALTER TABLE sites ADD COLUMN IF NOT EXISTS credits_remaining integer DEFAULT 1;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS credits_purchased integer DEFAULT 0;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS credits_monthly integer DEFAULT 1;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS credits_last_refill timestamptz DEFAULT now();

-- Credit transaction log
CREATE TABLE IF NOT EXISTS credit_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  amount          integer NOT NULL,       -- positive = purchase/refill, negative = usage
  balance_after   integer NOT NULL,
  type            text DEFAULT 'usage',   -- 'usage', 'purchase', 'monthly_refill'
  description     text,
  created_at      timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read credit_transactions"
  ON credit_transactions FOR SELECT
  TO anon USING (true);

CREATE POLICY "Allow service_role all credit_transactions"
  ON credit_transactions FOR ALL
  TO service_role USING (true) WITH CHECK (true);
