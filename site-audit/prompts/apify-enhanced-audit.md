# Prompt: Apify-Enhanced Audit System with Per-Report Billing

## Context

You are working on the TattooNOW Site Audit System. Read `site-audit/STATE.md` for the full architecture reference. The system currently runs a 24-node n8n workflow that crawls tattoo studio homepages, scores SEO/GEO/AI, and writes results to Supabase. A React SPA dashboard on GitHub Pages displays results across 10 tabs.

### What Already Exists
- **n8n workflow** `k2xPgpbGZEqLYg8B` on `tn.reinventingai.com` — 24-node audit pipeline
- **Supabase** project `dwoqhaaugczqsymfirqu` — tables: sites, audits, findings, geo_signals, rank_maps, competitors, link_checklist, directory_listings, ai_mentions, audit_progress
- **Dashboard** `site-audit/dashboard.html` — React 18 SPA, 10 tabs (Overview, Homepage, Rank Map, Core 30, Findings, GEO, AI, Link Checklist, Directories, Competitors)
- **Apify account** — API token in MEMORY.md, existing actor IDs for Instagram/Facebook/TikTok/Google Reviews/Yelp Reviews
- **Apify n8n credential ID**: `8oGQxWivuebaAAFG`
- **Webhook trigger**: `POST https://tn.reinventingai.com/webhook/run-audit` with `{locationId}` or `{domain}`
- **Scripts**: Python scripts in `/tmp/` for AI probing (`ai-prober.py`) and competitor intel (`competitor-intel.py`)

### Key Credentials (all in MEMORY.md)
- Supabase service_role key (for n8n writes)
- Supabase anon key (for dashboard reads)
- n8n API key (for workflow updates)
- Apify API token
- Perplexity API key
- OpenAI API key

---

## Objective

Build an **Apify-enhanced audit pipeline** that enriches each site audit with data from Apify actors, tracks usage costs per report, and bills clients $2.00 per report. The system must:

1. **Call Apify actors** during each audit run to gather richer data
2. **Track costs** — tally Apify compute/API costs per audit run
3. **Bill $2.00 per report** — record the charge against each site/client
4. **Integrate with the existing n8n workflow** (add nodes, don't rebuild)
5. **Update the dashboard** to show new data + billing info

---

## Phase 1: Billing & Usage Tracking Infrastructure

### 1.1 New Supabase Table: `audit_billing`

Create migration `migrate-v5.sql`:

```sql
CREATE TABLE IF NOT EXISTS audit_billing (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  audit_id        uuid REFERENCES audits(id) ON DELETE SET NULL,
  audit_date      date NOT NULL,

  -- Cost breakdown
  apify_cost      numeric(8,4) DEFAULT 0,      -- actual Apify credits consumed
  api_costs       jsonb DEFAULT '{}'::jsonb,    -- {"perplexity": 0.02, "openai": 0.01, ...}
  total_cost      numeric(8,4) DEFAULT 0,       -- sum of all costs

  -- Billing
  charge_amount   numeric(8,2) DEFAULT 2.00,    -- what we bill the client
  margin          numeric(8,4) GENERATED ALWAYS AS (charge_amount - total_cost) STORED,

  -- Apify run details
  apify_runs      jsonb DEFAULT '[]'::jsonb,    -- [{actor, runId, cost, durationMs, status}]

  -- Status
  billing_status  text DEFAULT 'pending' CHECK (billing_status IN ('pending', 'invoiced', 'paid', 'waived')),

  created_at      timestamptz DEFAULT now(),
  UNIQUE(site_id, audit_date)
);

CREATE INDEX idx_audit_billing_site ON audit_billing(site_id, audit_date DESC);
CREATE INDEX idx_audit_billing_status ON audit_billing(billing_status);

-- RLS
ALTER TABLE audit_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_audit_billing" ON audit_billing
  FOR SELECT USING (site_id IN (SELECT id FROM sites));
```

### 1.2 New Supabase Table: `apify_usage_log`

Granular log of every Apify actor call:

```sql
CREATE TABLE IF NOT EXISTS apify_usage_log (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  audit_id        uuid REFERENCES audits(id) ON DELETE SET NULL,
  actor_id        text NOT NULL,            -- Apify actor ID
  actor_name      text NOT NULL,            -- human-readable name
  run_id          text,                     -- Apify run ID
  status          text DEFAULT 'pending',   -- pending/running/succeeded/failed
  cost_usd        numeric(8,6) DEFAULT 0,   -- Apify cost for this run
  duration_ms     integer,
  items_returned  integer,
  input_params    jsonb,                    -- what we sent
  error_message   text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_apify_usage_site ON apify_usage_log(site_id, created_at DESC);
```

---

## Phase 2: Apify Actor Integration via n8n

### Actor Roster

Add these Apify actors to the audit pipeline. Each runs during an audit and writes to existing or new Supabase tables. Use the **HTTP Request node** in n8n to call Apify's API (or use the Apify n8n community node with credential `8oGQxWivuebaAAFG`).

**Apify API pattern:**
```
POST https://api.apify.com/v2/acts/{actorId}/run-sync-get-dataset-items?token={APIFY_TOKEN}
Content-Type: application/json
Body: {actor-specific input}
```

#### Group A: Enhance Existing Features (run every audit)

| # | Actor | Actor ID / Store Path | Writes To | Purpose |
|---|-------|-----------------------|-----------|---------|
| A1 | **Google Maps Scraper** | `compass/crawler-google-places` | `sites` (enrich), `competitors` | Pull full GBP profile: categories, services, hours, reviews, rating. Update site record + pull competitor GBP data |
| A2 | **Schema Markup Validator** | `consummate_mandala/schema-markup-validator` | `findings` | Deep schema validation — find missing fields, incorrect types, not just presence |
| A3 | **Website Speed Checker** | `onescales/website-speed-checker` | `audits.scores.performance` | Lighthouse scores: Performance, FCP, LCP, TBT, CLS for desktop + mobile |

#### Group B: AI Discoverability (run every audit — replaces manual AI prober)

| # | Actor | Actor ID / Store Path | Writes To | Purpose |
|---|-------|-----------------------|-----------|---------|
| B1 | **AI Brand Visibility** | `adityalingwal/ai-brand-visibility` | `ai_mentions` | Check ChatGPT + Gemini + Perplexity mentions in one call |
| B2 | **Perplexity Search Scraper** | `consummate_mandala/perplexity-search-scraper` | `ai_mentions` | Backup/supplement — check Perplexity citations with source URLs |

#### Group C: Rank Map Automation (run weekly or on-demand)

| # | Actor | Actor ID / Store Path | Writes To | Purpose |
|---|-------|-----------------------|-----------|---------|
| C1 | **Local SEO Rank Checker** | `consummate_mandala/local-seo-rank-checker` | `rank_maps` | Automated local pack + organic rank at grid coordinates. Replaces Local Falcon CSV import |

#### Group D: Social & Reviews (run monthly or on-demand)

| # | Actor | Actor ID / Store Path | Writes To | Purpose |
|---|-------|-----------------------|-----------|---------|
| D1 | **Instagram Profile** | Actor `dSCLg0C3YEZ83HzYX` (already configured) | `sites.social_links`, new `social_presence` | Follower count, post count, bio, engagement |
| D2 | **Facebook Pages** | Actor `4Hv5RhChiaDk6iwad` (already configured) | `sites.social_links`, `social_presence` | Page likes, followers, NAP verification |
| D3 | **TikTok Profile** | Actor `0FXVyOXXEmdGcV88a` (already configured) | `sites.social_links`, `social_presence` | Follower count, video count |
| D4 | **Google Reviews** | Actor `Xb8osYTtOjlsgI6k9` (already configured) | `competitors`, review analysis | Review text for sentiment analysis |
| D5 | **Yelp Reviews** | Actor `gTYnt7Xc2Qjw8eljO` (already configured) | `directory_listings`, review analysis | Yelp listing verification + reviews |

### n8n Workflow Modifications

Add nodes to the existing workflow AFTER the "Analyze HTML" node and BEFORE "Score". The pattern:

```
... → Analyze HTML → [NEW: Apify Enrichment Group] → Score → ...
```

**New nodes to add:**

1. **"Apify: Run Actors"** (Code node) — Fires all Group A + B actors in parallel using `Promise.all()`. Each call:
   - Calls Apify API (run-sync or run-async depending on timeout needs)
   - Logs each run to `apify_usage_log`
   - Returns combined results

2. **"Apify: Collect Results"** (Code node) — Waits for all actor runs, collects results, merges into the audit context. Calculates total Apify cost.

3. **"Write Billing"** (Code node) — Creates `audit_billing` record with cost breakdown and $2.00 charge.

**For the workflow update**, follow the existing Python script pattern (GET workflow → find node → modify → deactivate → PUT → activate). See STATE.md §4.7.

---

## Phase 3: Scoring Updates

### 3.1 Add Performance Sub-Score

Update the Score node to include performance data from Apify's Lighthouse results:

```javascript
// In the Score node, add to SEO breakdown:
const perfScore = apifyResults?.lighthouse?.performanceScore || null;
// Add to scores object:
scores.performance = perfScore ? {
  score: Math.round(perfScore * 100),
  mobile_score: apifyResults?.lighthouse?.mobile?.performanceScore ? Math.round(apifyResults.lighthouse.mobile.performanceScore * 100) : null,
  lcp: apifyResults?.lighthouse?.lcp,
  cls: apifyResults?.lighthouse?.cls,
  fcp: apifyResults?.lighthouse?.fcp,
  tbt: apifyResults?.lighthouse?.tbt
} : null;
```

### 3.2 Enrich AI Score

Replace the null AI score with real data from Apify's AI Brand Visibility actor:

```javascript
// AI score now populated from Apify results instead of returning null
const aiMentions = apifyResults?.aiBrandVisibility || [];
const mentioned = aiMentions.filter(m => m.mentioned).length;
scores.ai_discoverability = {
  score: aiMentions.length > 0 ? Math.round((mentioned / aiMentions.length) * 100) : null,
  engines_checked: ['chatgpt', 'gemini', 'perplexity'],
  mention_count: mentioned,
  total_queries: aiMentions.length
};
```

---

## Phase 4: Dashboard Updates

### 4.1 New "Billing" Section on Overview Tab

Add a billing summary card to the Overview tab showing:
- Total audits run (count of `audit_billing` records)
- Total charged ($2.00 × audit count)
- Total Apify cost (sum of `apify_cost`)
- Margin (charge - cost)
- Last audit date
- Billing status breakdown (pending/invoiced/paid)

Style: Use the existing `.card` class with the dark theme. Show a small table of recent audits with date, cost, charge, status.

### 4.2 New "Performance" Section on Overview Tab

Add Lighthouse score cards (Performance, LCP, CLS) next to the existing SEO/AI/GEO/Overall score cards. Use the same `.score-card` styling.

### 4.3 Enhance AI Tab

The AI tab currently shows `ai_mentions` data. With Apify-sourced data, it should now actually populate (currently returns null because AI prober isn't active). Ensure the existing AI tab components work with the new data format from the AI Brand Visibility actor.

### 4.4 Enhance Rank Map Tab

If using the Apify Local SEO Rank Checker (Group C), the rank_maps table will now auto-populate. Ensure the existing Rank Map tab visualization works with the new data. The grid_data format should match: flat array of ranks in row-major order.

### 4.5 Data Fetching

Add to the dashboard's Supabase queries:
```javascript
// Billing data
const { data: billing } = await db.from('audit_billing')
  .select('*')
  .eq('site_id', siteId)
  .order('audit_date', { ascending: false });
```

---

## Phase 5: Cost Tracking Logic

### 5.1 Per-Run Cost Calculation

After each Apify actor run completes, log the cost:

```javascript
// In the "Apify: Collect Results" node
async function logApifyRun(siteId, auditId, actorId, actorName, runResult) {
  const cost = runResult?.stats?.usageTotalUsd || 0;
  await supabase.from('apify_usage_log').insert({
    site_id: siteId,
    audit_id: auditId,
    actor_id: actorId,
    actor_name: actorName,
    run_id: runResult?.id,
    status: runResult?.status || 'succeeded',
    cost_usd: cost,
    duration_ms: runResult?.stats?.durationMs,
    items_returned: runResult?.stats?.datasetItemCount
  });
  return cost;
}
```

### 5.2 Billing Record Creation

```javascript
// In the "Write Billing" node
const totalApifyCost = apifyRuns.reduce((sum, r) => sum + r.cost, 0);
const apiCosts = {
  perplexity: perplexityCost || 0,
  openai: openaiCost || 0
};
const totalCost = totalApifyCost + Object.values(apiCosts).reduce((a, b) => a + b, 0);

await supabase.from('audit_billing').upsert({
  site_id: ctx.site_id,
  audit_id: ctx.audit_id,
  audit_date: ctx.audit_date,
  apify_cost: totalApifyCost,
  api_costs: apiCosts,
  total_cost: totalCost,
  charge_amount: 2.00,
  apify_runs: apifyRuns.map(r => ({
    actor: r.actorName,
    runId: r.runId,
    cost: r.cost,
    durationMs: r.durationMs,
    status: r.status
  })),
  billing_status: 'pending'
}, { onConflict: 'site_id,audit_date' });
```

---

## Implementation Order

1. **Run `migrate-v5.sql`** in Supabase SQL Editor — creates `audit_billing` and `apify_usage_log` tables
2. **Add Apify enrichment nodes** to n8n workflow (Group A + B first, they run every audit)
3. **Update the Score node** to incorporate Apify data (performance, AI mentions)
4. **Add the Write Billing node** to the workflow
5. **Update the dashboard** — add billing card to Overview, enhance AI tab
6. **Test with Darkside Tattoo** (`locationId: 56Jnv0OGTMdU1XSZyJIR`)
7. **Add Group C** (rank map automation) as a separate scheduled workflow or sub-workflow
8. **Add Group D** (social/reviews) as monthly enrichment

---

## Testing

After each phase, trigger a test audit:
```bash
curl -X POST https://tn.reinventingai.com/webhook/run-audit \
  -H "Content-Type: application/json" \
  -d '{"locationId": "56Jnv0OGTMdU1XSZyJIR"}'
```

Then verify:
- `audit_billing` has a new row with costs populated
- `apify_usage_log` has entries for each actor run
- Dashboard shows billing data on Overview tab
- AI tab populates (no longer null)
- Performance scores appear

---

## Cost Budget

Expected cost per audit with all Group A + B actors:
- Google Maps Scraper: ~$0.01-0.05
- Schema Validator: ~$0.01
- Website Speed Checker: ~$0.05
- AI Brand Visibility: ~$0.10-0.50
- Perplexity Scraper: ~$0.02-0.05
- **Total: ~$0.20-0.66 per audit**
- **Charge: $2.00 → Margin: $1.34-1.80 per audit**

---

## Files to Modify

| File | Changes |
|------|---------|
| `site-audit/supabase/migrate-v5.sql` | NEW — billing + usage tables |
| `site-audit/STATE.md` | Update with new tables, nodes, billing model |
| `site-audit/dashboard.html` | Add billing card, performance scores, enhance AI tab |
| `/tmp/add-apify-enrichment.py` | NEW — Python script to add Apify nodes to n8n workflow |
| `/tmp/add-billing-node.py` | NEW — Python script to add Write Billing node |
| `/tmp/update-score-node.py` | NEW — Python script to update Score node with Apify data |

---

## Constraints

- Do NOT rebuild the n8n workflow — ADD nodes to the existing one
- Follow the Python workflow update pattern in STATE.md §4.7
- Keep dashboard as a single-file React SPA (no build step)
- All Supabase writes use the service_role key (n8n side)
- All dashboard reads use the anon key (client side)
- The $2.00 charge amount should be configurable per site (default $2.00)
- Apify actor calls should be wrapped in try/catch — a failed actor should NOT block the audit
- Log all Apify costs even if the actor fails (cost = 0 for failures)
