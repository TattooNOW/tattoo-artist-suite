# STATE.md — TattooNOW Site Audit System v3

> Authoritative reference for the architecture, data model, scoring methodology, and operational state of the audit system.
> Last updated: 2026-03-02

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Data Sources                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │Local     │ │SpyFu CSV │ │Google    │ │n8n AI    │       │
│  │Falcon CSV│ │          │ │Places API│ │Probes    │       │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
│       │             │            │             │             │
│  import-rankmap  import-sf   gbp-lookup   ai-prober.json   │
└───────┼─────────────┼────────────┼─────────────┼────────────┘
        │             │            │             │
        ▼             ▼            ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase (Postgres)                                        │
│  sites │ audits │ findings │ ai_mentions │ geo_signals      │
│  rank_maps │ competitors │ link_checklist                   │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   run-audit.js    dashboard.html    n8n workflows
   (16-step CLI)   (React SPA)      (automation)
```

### Tech Stack

| Layer        | Technology                        |
|-------------|-----------------------------------|
| Database     | Supabase (hosted Postgres + RLS)  |
| Scripts      | Node.js 18+ (ESM-ish, CommonJS)  |
| Parsing      | Cheerio for HTML, csv-parse for CSV |
| APIs         | Google Places API (New), Local Falcon |
| Dashboard    | React 18 (CDN), Recharts, Babel standalone |
| Automation   | n8n (4 workflow JSONs)            |
| Deployment   | Python HTTP server / any static host |

### Key Credentials

| Variable              | Purpose                    |
|----------------------|----------------------------|
| `SUPABASE_URL`        | Supabase project URL       |
| `SUPABASE_ANON_KEY`   | Public (anon) key          |
| `SUPABASE_SERVICE_KEY` | Service role key (server-side) |
| `GOOGLE_PLACES_API_KEY` | GBP lookup + competitor scan |
| `LOCAL_FALCON_API_KEY` | Rank map automated pulls (optional) |
| `GHL_API_KEY`         | GoHighLevel API (future)   |

---

## 2. Database Schema

### 2.1 `sites` (14 v2 cols + 16 v3 cols)

Core site record. One row per client.

| Column | Type | v3 New? | Notes |
|--------|------|---------|-------|
| id | uuid PK | | |
| domain | text | | |
| business_name | text | | |
| city, state, phone, address | text | | |
| ghl_location_id | text | | GHL location for dashboard URL |
| primary_keyword | text | | |
| created_at | timestamptz | | |
| target_city, target_state, target_area | text | ✓ | May differ from GBP city |
| target_radius_mi | int | ✓ | Rank map radius |
| gbp_place_id | text | ✓ | Google Places ID |
| gbp_primary_category | text | ✓ | Auto-filled from API |
| gbp_secondary_categories | text[] | ✓ | |
| gbp_services | text[] | ✓ | |
| gbp_review_count | int | ✓ | |
| gbp_review_rating | numeric(2,1) | ✓ | |
| gbp_landing_page | text | ✓ | |
| retheme_detected | boolean | ✓ | |
| retheme_target | text | ✓ | |
| artist_count | int | ✓ | |
| artist_names | text[] | ✓ | |
| specialties | text[] | ✓ | |

### 2.2 `audits`

One row per audit run.

| Column | Type | v3 New? | Notes |
|--------|------|---------|-------|
| id | uuid PK | | |
| site_id | uuid FK | | |
| audit_date | date | | |
| audit_type | text | | 'full' or 'quick' |
| scores | jsonb | | `{overall, seo: {score, breakdown}, ai_discoverability: {score}, geo_readiness: {score, signals}}` |
| pages_checked | jsonb | | Array of page summaries |
| link_inventory | jsonb | | Internal link graph |
| delta | jsonb | | Auto-calculated by RPC |
| run_duration_ms | int | | |
| triggered_by | text | | 'cli', 'n8n', 'webhook' |
| core30_coverage | jsonb | ✓ | `{categories_total/found/missing, services_total/found/missing, notes}` |
| indexation | jsonb | ✓ | `{indexed_estimate, crawled_count, ratio}` |
| content_briefs | jsonb | ✓ | Array of brief objects |
| crawler_source | text | ✓ | 'builtin', 'screaming_frog', etc. |

**Unique constraint**: `(site_id, audit_date, audit_type)`

### 2.3 `findings`

Individual issues discovered. Layer 0-3.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| audit_id, site_id | uuid FK | |
| finding_id | text | `AUDIT-YYYYMMDD-NNN` |
| severity | text | critical/high/medium/low |
| category | text | meta/content/schema/geo/linking/technical/strategic |
| layer | int | 0=strategic, 1=SEO, 2=AI, 3=GEO |
| title, page, finding, fix | text | |
| effort_minutes | int | Estimated fix time |
| impact | text | high/medium/low |
| status | text | open/fixed/in_progress |
| first_detected | date | |
| still_open_since | date | For aging |

### 2.4 `rank_maps` (v3 new)

Local Falcon / DataForSEO grid scan results.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| site_id | uuid FK | |
| keyword | text | Search term |
| scan_date | date | |
| source | text | local_falcon/datafor_seo/leadsnap |
| grid_size | int | 5, 7, 9, etc. |
| radius_km | numeric | |
| grid_data | int[] | Flat array of ranks, row-major |
| top_3_pct | int | % of grid points ranking 1-3 |
| avg_rank | numeric(4,1) | |
| center_rank | int | Rank at grid center |

**Unique constraint**: `(site_id, keyword, scan_date)`

### 2.5 `competitors` (v3 new)

| Column | Type |
|--------|------|
| id | uuid PK |
| site_id | uuid FK |
| competitor_name | text |
| domain | text |
| gbp_city | text |
| indexed_pages | int |
| review_count | int |
| review_rating | numeric(2,1) |
| categories_count | int |
| services_count | int |
| last_checked | date |

### 2.6 `link_checklist` (v3 new)

| Column | Type |
|--------|------|
| id | uuid PK |
| site_id, audit_id | uuid FK |
| link_type | text |
| priority | int |
| title | text |
| description | text |
| target_url | text |
| target_page | text |
| estimated_cost | text |
| status | text |

### 2.7 `ai_mentions`, `geo_signals`

Unchanged from v2. See `supabase/setup.sql`.

---

## 3. Scoring Methodology

### 3.1 SEO Score (0-100)

Weighted sub-scores, normalized to 100:

| Sub-score | Max Points | Formula |
|-----------|------------|---------|
| Title Tag | 20 | Length(4) + Keyword(6) + Front-loaded(4) + Business name(4) + Separator(2) |
| H1 | 10 | Present(3) + Single(2) + Has keyword(3) + Has city(2) |
| Meta Description | 10 | Present(3) + Length(3) + Keyword(2) + CTA(2) |
| Schema | 10 | Has JSON-LD(3) + LocalBusiness(3) + FAQ(2) + Review(2) |
| GBP | 15 | Embed(3) + Reviews(4) + Rating(4) + Categories(2) + Services(2) |
| Core 30 | 20 | (found / total) × 20 |
| Tech SEO | 15 | Canonical(2) + Viewport(2) + HTTPS(2) + OG tags(2) + Pages crawled(3) + Avg word count(4) |

**Total possible: 100** (sum of max points)

### 3.2 AI Score (0-100 or null)

- Returns `null` if no AI probe data exists (triggers weight redistribution)
- `(mentions where mentioned=true / total mentions) × 100`

### 3.3 GEO Score (0-100)

- `(signals where passed=true / total signals) × 100`
- Signals: local_business_schema, city_in_title, city_in_h1, gbp_embed, phone_on_homepage, address_on_homepage, faq_schema, og_tags_present

### 3.4 Overall Score

- **With AI data**: SEO 40% + AI 15% + GEO 45%
- **Without AI data (null)**: SEO 55% + GEO 45%
- Rounded to integer

---

## 4. Pipeline Steps (run-audit.js)

| # | Step | Module | Writes to |
|---|------|--------|-----------|
| 1 | INTAKE | supabase.js | — |
| 2 | INDEX CHECK | (future CSE) | audit.indexation |
| 3 | GBP LOOKUP | gbp-lookup.js | sites (auto-fill) |
| 4 | RETHEME DETECT | html-parser.js | sites |
| 5 | RANK MAP FETCH | supabase.js | — (read-only) |
| 6 | CITY MISMATCH | — | finding if mismatch |
| 7 | COMPETITOR SCAN | competitor-scanner.js | competitors |
| 8 | HOMEPAGE ANALYSIS | html-parser.js | — |
| 9 | FULL CRAWL | crawler.js | — |
| 10 | CORE 30 GAP | core30-analyzer.js | — |
| 11 | GEO SIGNALS | — | geo_signals |
| 12 | SCHEMA AUDIT | html-parser.js | — |
| 13 | WORD COUNT | crawler.js results | — |
| 14 | SCORING | scoring.js | — |
| 15 | FINDINGS GEN | — | findings |
| 16 | DB WRITE + DELTA | supabase.js + RPC | audits, findings, geo_signals, link_checklist |

### CLI Usage

```bash
node run-audit.js --domain darksidetattoo.com
node run-audit.js --location 56Jnv0OGTMdU1XSZyJIR
node run-audit.js --domain darksidetattoo.com --skip-crawl --skip-gbp --skip-competitors
```

---

## 5. File Inventory

```
site-audit/
├── dashboard.html          # v3 React SPA — 9 tabs, rank-map hero
├── loader.js               # locationId param handler
├── .env.example            # Required env vars
├── STATE.md                # This file
│
├── supabase/
│   ├── setup.sql           # v2 DDL + seed data (669 lines)
│   └── migrate-v3.sql      # v3 migration (258 lines) — run after setup.sql
│
├── scripts/
│   ├── package.json        # v3.0.0 — deps + scripts
│   ├── run-audit.js        # 16-step pipeline (~400 lines)
│   ├── seed-darkside.js    # Seed script for test data
│   ├── import-rankmap.js   # Local Falcon CSV → rank_maps
│   ├── import-sf.js        # SpyFu CSV → competitors
│   ├── check-geo.js        # (legacy v2, functionality merged into run-audit.js)
│   ├── generate-schema.js  # (legacy v2, to be removed)
│   ├── inject-schema.js    # (legacy v2, to be removed)
│   │
│   └── lib/
│       ├── supabase.js     # Supabase client init
│       ├── delta.js        # Delta calculation helpers
│       ├── scoring.js      # v3 scoring engine (7 sub-scores + 4 calculators)
│       ├── html-parser.js  # HTML fetch + signal extraction (11 functions)
│       ├── crawler.js      # Multi-page site crawler
│       ├── gbp-lookup.js   # Google Places API (New)
│       ├── core30-analyzer.js  # Core 30 gap analysis + content briefs
│       ├── link-checklist.js   # Link-building task generator
│       └── competitor-scanner.js # Lightweight competitor data
│
├── n8n/
│   ├── audit-runner.json      # Weekly audit via Execute Command
│   ├── ai-prober.json         # Bi-monthly AI discoverability probes
│   ├── report-notifier.json   # Post-audit email notifications
│   └── rankmap-puller.json    # Bi-monthly Local Falcon API pulls
│
└── docs/
    └── intake-form-fields.md  # 29-field intake form spec
```

---

## 6. Dashboard Tabs

| Tab | Data Source | Key Visuals |
|-----|-----------|-------------|
| Overview | audits, rank_maps | Hero: top-3%, 4 score cards, Core 30 bar, timeline chart, quick wins, GBP health |
| Rank Map | rank_maps | Grid heatmap, stats cards, trend line |
| Core 30 | audits.core30_coverage, content_briefs | Coverage bars, content pipeline table |
| Findings | findings | Filterable table (severity/status/category/layer) |
| GEO | geo_signals | Signal cards (pass/fail), score |
| AI | ai_mentions | Engine/query/mentioned table |
| Link Checklist | link_checklist | Priority table, built/total counter |
| Competitors | competitors, sites | Benchmark table, color-coded vs client |
| Directories | directory_listings | Status cards, tier filtering |

**URL format**: `dashboard.html?locationId=YOUR_GHL_LOCATION_ID`

---

## 7. Seed Data (Darkside Tattoo)

| Field | Value |
|-------|-------|
| Site UUID | `a1b2c3d4-0000-0000-0000-000000000001` |
| Domain | `darksidetattoo.com` |
| GHL Location | `56Jnv0OGTMdU1XSZyJIR` |
| Feb Audit | `aaaa0001-0000-0000-0000-000000000001` |
| Mar Audit | `bbbb0002-0000-0000-0000-000000000002` |

---

## 8. Migration Status

| Migration | Status | Notes |
|-----------|--------|-------|
| `setup.sql` | ✅ Imported | v2 schema + seed data in Supabase |
| `migrate-v3.sql` | ⚠ NOT YET RUN | Run in Supabase SQL Editor before testing v3 |

**To apply v3 migration**: Open Supabase SQL Editor → paste contents of `supabase/migrate-v3.sql` → Run.

---

## 9. Operational Runbook

### First-time setup
1. Copy `.env.example` → `.env`, fill in keys
2. Run `setup.sql` in Supabase SQL Editor (if not already done)
3. Run `migrate-v3.sql` in Supabase SQL Editor
4. `cd scripts && npm install`
5. `node run-audit.js --domain darksidetattoo.com`
6. `python3 -m http.server 8888` (from site-audit root)
7. Open `http://localhost:8888/dashboard.html?locationId=56Jnv0OGTMdU1XSZyJIR`

### Import rank map data
```bash
node import-rankmap.js --file ~/Downloads/local-falcon-export.csv \
  --location 56Jnv0OGTMdU1XSZyJIR --keyword "tattoo shop" --date 2026-03-01
```

### Import competitor data
```bash
node import-sf.js --file ~/Downloads/spyfu-competitors.csv \
  --location 56Jnv0OGTMdU1XSZyJIR
```

### n8n deployment
1. Import each JSON from `n8n/` into your n8n instance
2. Replace `REPLACE_ME` credential IDs with your actual credential IDs
3. Update the `cd /path/to/` in audit-runner.json to your actual path
4. Activate workflows

---

## 10. Known Limitations / TODOs

- [ ] `migrate-v3.sql` not yet run in Supabase
- [ ] Google Custom Search indexation estimates not implemented (needs CSE key)
- [ ] `competitor-scanner.js` `estimateIndexedPages()` returns null (needs site: query API)
- [ ] AI prober n8n workflow only routes to ChatGPT — Perplexity and Gemini nodes need separate HTTP configs
- [ ] No automated Screaming Frog import (manual CSV only via crawler_source)
- [ ] `generate-schema.js` and `inject-schema.js` are legacy v2 files — safe to delete
- [ ] `check-geo.js` functionality merged into run-audit.js — safe to delete
- [ ] `seed-darkside.js` uses v2 field set — needs v3 field updates
