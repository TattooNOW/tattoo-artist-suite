# STATE.md — TattooNOW Site Audit System v3

> Authoritative reference for the architecture, data model, scoring methodology, and operational state of the audit system.
> Last updated: 2026-03-03

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Data Sources                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │Local     │ │SpyFu CSV │ │Google    │ │n8n Cloud │       │
│  │Falcon CSV│ │          │ │Places API│ │Workflow  │       │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
│       │             │            │             │             │
│  import-rankmap  import-sf   gbp-lookup   webhook/cron     │
└───────┼─────────────┼────────────┼─────────────┼────────────┘
        │             │            │             │
        ▼             ▼            ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase (Postgres)                                        │
│  sites │ audits │ findings │ ai_mentions │ geo_signals      │
│  rank_maps │ competitors │ link_checklist │ directory_listings│
└────────────────────────┬────────────────────────────────────┘
                         │
                    dashboard.html
                    (React SPA on GitHub Pages)
```

### Tech Stack

| Layer        | Technology                        |
|-------------|-----------------------------------|
| Database     | Supabase (hosted Postgres + RLS) — project `dwoqhaaugczqsymfirqu` |
| Dashboard    | React 18 (CDN), Recharts, Babel standalone — GitHub Pages `TattooNOW/site-audit` |
| Automation   | n8n cloud (`tn.reinventingai.com`) — 1 primary workflow |
| Scripts (CLI)| Node.js 18+ — `site-audit/scripts/` (backup pipeline) |
| Parsing      | Cheerio (CLI), regex-based (n8n) |
| APIs         | Google Places API (New), Local Falcon |

### Key Credentials

| Variable              | Purpose                    | Stored In |
|----------------------|----------------------------|-----------|
| `SUPABASE_URL`        | Supabase project URL       | n8n credentials |
| `SUPABASE_SERVICE_KEY` | Service role key (n8n writes) | n8n credentials |
| `SUPABASE_ANON_KEY`   | Public key (dashboard reads) | dashboard.html |
| `GOOGLE_PLACES_API_KEY` | GBP lookup + competitor scan | n8n credentials / .env |
| `N8N_API_KEY`         | n8n REST API for workflow updates | /tmp/*.py scripts |

---

## 2. Database Schema

### 2.1 `sites`

Core site record. One row per client.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| domain | text | |
| business_name | text | |
| city, state | text | GBP city/state |
| phone | text | Used for NAP matching against homepage |
| address | text | Used for NAP matching against homepage |
| ghl_location_id | text | GHL location for dashboard URL + webhook trigger |
| primary_keyword | text | |
| created_at | timestamptz | |
| target_city, target_state, target_area | text | May differ from GBP city |
| target_radius_mi | int | Rank map radius |
| gbp_place_id | text | Google Places ID |
| gbp_primary_category | text | Auto-filled from API |
| gbp_secondary_categories | text[] | |
| gbp_services | text[] | Used for Core 30 analysis + service recommendations |
| gbp_review_count | int | |
| gbp_review_rating | numeric(2,1) | |
| gbp_landing_page | text | |
| specialties | text[] | Used for service search volume ranking |
| retheme_detected | boolean | |
| retheme_target | text | |
| artist_count | int | |
| artist_names | text[] | |
| secondary_keywords | text[] | |

### 2.2 `audits`

One row per audit run.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| site_id | uuid FK | |
| audit_date | date | |
| audit_type | text | 'full' or 'quick' |
| scores | jsonb | `{overall, seo: {score, breakdown}, ai_discoverability: {score}, geo_readiness: {score, signals[]}}` |
| pages_checked | jsonb | Array of page summaries |
| link_inventory | jsonb | Internal link graph |
| delta | jsonb | Auto-calculated by RPC |
| run_duration_ms | int | |
| triggered_by | text | 'cli', 'n8n', 'webhook' |
| core30_coverage | jsonb | `{categories_total/found/missing, services_total/found/missing, notes}` |
| homepage_sections | jsonb | `{found, total, missing, critical_missing, sections[], top_services[]}` |
| indexation | jsonb | `{indexed_estimate, crawled_count, ratio}` |
| content_briefs | jsonb | Array of brief objects |
| crawler_source | text | 'n8n-cloud', 'builtin', 'screaming_frog' |

**Unique constraint**: `(site_id, audit_date, audit_type)`

### 2.3 `findings`

Individual issues discovered. Layer 0-3.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| audit_id, site_id | uuid FK | |
| finding_id | text | Slug-based: `no-schema-at-all`, `hp-missing-hero-banner`, etc. |
| severity | text | critical/high/medium/low |
| category | text | meta/content/schema/geo/homepage/technical/strategic |
| layer | int | 0=strategic, 1=SEO, 2=AI, 3=GEO |
| title, page, finding, fix | text | `fix` contains the specific recommendation |
| effort_minutes | int | Estimated fix time |
| impact | text | high/medium/low |
| status | text | open/fixed/in_progress |
| first_detected | date | |
| still_open_since | date | For aging |

### 2.4 `geo_signals`

GEO readiness signals per audit.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| audit_id, site_id | uuid FK | |
| signal_name | text | 9 signals (see §3.3) |
| signal_value | boolean | pass/fail |
| details | text | Human-readable detail with actual detected element |

### 2.5 `rank_maps`

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

### 2.6 `competitors`

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

### 2.7 `link_checklist`

| Column | Type |
|--------|------|
| id | uuid PK |
| site_id, audit_id | uuid FK |
| link_type | text | `directory`, `authority`, `sponsorship` |
| priority | int |
| title | text |
| description | text |
| target_url | text |
| target_page | text |
| estimated_cost | text |
| status | text |

### 2.8 `directory_listings`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| site_id | uuid FK | |
| platform | text | "Google Business Profile", "Yelp", etc. |
| tier | int | 1=Critical, 2=High Impact, 3=Industry, 4=Secondary, 5=Regional |
| status | text | listed/needs_claim/needs_fix/not_listed |
| claimed | boolean | |
| listing_url | text | URL of found listing |
| submit_url | text | Claim/register URL |
| nap_issues | text[] | `name_variation`, `wrong_address`, `wrong_phone`, etc. |
| nap_priority | text | high/medium/low |
| notes | text | |

### 2.9 `ai_mentions`

AI discoverability probe results.

| Column | Type |
|--------|------|
| id | uuid PK |
| site_id | uuid FK |
| engine | text | chatgpt/perplexity/gemini |
| query | text |
| mentioned | boolean |
| context | text |
| probe_date | date |

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

**Total possible: 100**

### 3.2 AI Score (0-100 or null)

- Returns `null` if no AI probe data exists (triggers weight redistribution)
- `(mentions where mentioned=true / total mentions) × 100`

### 3.3 GEO Score (0-100)

`(signals where passed=true / total signals) × 100`

**9 signals, grouped:**

| Signal | Group | Details |
|--------|-------|---------|
| `local_business_schema` | Schema & Structured Data | Checks for LocalBusiness JSON-LD |
| `faq_schema` | Schema & Structured Data | Checks for FAQPage JSON-LD |
| `city_in_title` | On-Page Local Signals | Target city appears in `<title>` tag |
| `city_in_h1` | On-Page Local Signals | Target city appears in `<h1>` tag |
| `og_tags_present` | On-Page Local Signals | Has og:title, og:description meta tags |
| `phone_on_homepage` | NAP & Contact | Matches actual business phone from site record (last 10 digits) |
| `address_on_homepage` | NAP & Contact | Matches actual street address from site record |
| `business_name_on_homepage` | NAP & Contact | Matches business name (+ variations: & ↔ "and", stripped suffixes) |
| `gbp_embed` | NAP & Contact | Google Maps iframe embed detected |

Each signal stores a `details` string showing the actual element found (e.g., `Phone "203-469-9208" found on homepage`) and a `recommendation` for failed signals.

### 3.4 Overall Score

- **With AI data**: SEO 40% + AI 15% + GEO 45%
- **Without AI data (null)**: SEO 55% + GEO 45%
- Rounded to integer

---

## 4. n8n Workflow: Site Audit Runner

**Workflow ID**: `k2xPgpbGZEqLYg8B`
**Instance**: `tn.reinventingai.com`
**Triggers**: Weekly cron (Sunday 3am) + webhook `POST /webhook/run-audit`

### 4.1 Pipeline (24 nodes)

```
Trigger (Cron / Webhook)
  → Determine Mode
  → Progress: Starting
  → Fetch Sites (HTTP → Supabase)
  → Filter or Create Site
  → Ensure Site Exists
  → Progress: Site Located
  → Prepare Audit
  → Progress: Crawling
  → Crawl Homepage (HTTP → site URL)
  → Progress: Analyzing
  → Analyze HTML
  → Progress: Scoring
  → Score
  → Generate Findings
  → Generate Link Checklist
  → Progress: Writing
  → Write Audit
  → Write GEO Signals
  → Write Findings
  → Write Link Checklist
  → Progress: Complete
  → Cleanup Progress
```

### 4.2 Node Details

| # | Node | Type | Purpose |
|---|------|------|---------|
| 1 | Every Sunday 3am | scheduleTrigger | Weekly cron |
| 2 | Webhook | webhook | `POST /webhook/run-audit` with `{locationId}` or `{domain}` |
| 3 | Determine Mode | code | Routes: all-sites (cron), single-site (webhook with locationId), domain-lookup |
| 4 | Fetch Sites | httpRequest | `GET /rest/v1/sites?select=...,address,phone` from Supabase |
| 5 | Filter or Create Site | code | Filters to requested site, or creates new site record if domain-only |
| 6 | Ensure Site Exists | code | Upserts site in Supabase, passes through all fields including address, phone |
| 7 | Prepare Audit | code | Creates audit record (POST or finds existing), builds context: `{site_id, audit_id, domain, business_name, city, state, target_city, target_state, primary_keyword, secondary_keywords, specialties, gbp_services, gbp_primary_category, address, phone, audit_date}` |
| 8 | Crawl Homepage | httpRequest | Fetches homepage HTML via HTTP GET |
| 9 | Analyze HTML | code | **Core analysis** — extracts SEO signals + 12 homepage sections (see §4.3) |
| 10 | Score | code | Computes SEO/AI/GEO/Overall scores + generates GEO signal objects with details/groups/recommendations |
| 11 | Write Audit | code | UPSERT audit record with scores, core30, content_briefs, homepage_sections |
| 12 | Write GEO Signals | code | Deletes old + inserts new geo_signals with details |
| 13-20 | Progress: * | code | Upserts progress status to `audit_progress` table for live dashboard updates |
| 21 | Generate Findings | code | Creates finding records from failed signals + missing homepage sections |
| 22 | Generate Link Checklist | code | Generates directory + authority + sponsorship link-building tasks |
| 23 | Write Findings | code | Upserts findings to Supabase (delete old + insert new) |
| 24 | Write Link Checklist | code | Upserts link checklist to Supabase |

### 4.3 Analyze HTML: Homepage Section Detection

12 sections detected via regex patterns against raw HTML:

| # | Section | Importance | Detection Strategy |
|---|---------|------------|-------------------|
| 1 | Hero / Banner | critical | Classes: hero, banner, jumbotron, splash, masthead, full-section. Uses `rankedServices` for personalized CTA recommendation |
| 2 | Services | critical | Classes/IDs: services. Headings: services, what we offer, what we do, our specialt. Links: /services, /what-we-do |
| 3 | Gallery / Portfolio | critical | Classes/IDs: gallery, portfolio. Headings: gallery, portfolio, our work, tattoo gallery, see our. Links: /gallery, /portfolio |
| 4 | About / Studio Info | high | Classes/IDs: about. Headings: about, our story, who we are, our studio |
| 5 | Testimonials / Reviews | high | Classes: testimonial, review. Headings: testimonial, review, what say. Embeds: google-review, elfsight |
| 6 | Call-to-Action / Booking | critical | Classes: cta, booking, book-now. Links: book now, schedule, get started |
| 7 | Contact Info on Page | high | Classes: contact, footer. IDs: contact. Headings: contact, get in touch, visit us. `<footer>` tag, `href="tel:"` links |
| 8 | Map Embed | medium | `google.com/maps/embed`, `maps.googleapis.com` in iframes |
| 9 | FAQ Section | medium | Classes: faq. Headings: faq, frequently asked, common questions |
| 10 | Social Proof / Badges | low | Classes: social-proof, badges, trust, award, certification, accredit. Images: badge, award, certified, APP, OSHA. Headings: award, certified, member, featured |
| 11 | Artists / Team | high | Classes/IDs: artists, team. Headings: artists, our team, meet the, our crew, the crew, staff, our piercers. Links: artist-bio, /artists/, meet-the- |
| 12 | Hours of Operation | high | Classes: hours, business-hours. Headings: hours, business hours, open, we're open |

### 4.4 Analyze HTML: NAP Matching

The audit matches **actual business data** from the site record, not just generic regex patterns:

- **Phone**: Strips non-digits from `ctx.phone` and `pageText`, checks if the last 10 digits appear on page. Falls back to generic `\d{3}-\d{3}-\d{4}` pattern if no phone in record.
- **Address**: Lowercases `ctx.address` and checks if it appears in page text. Falls back to generic street pattern if no address in record.
- **Business Name**: Checks exact match, then stripped variations (removes "Tattoo", "Studio", "Shop", "Piercing", "&", "LLC", etc.), then & ↔ "and" swaps.

Data pipeline for NAP fields: `Fetch Sites (select address,phone)` → `Ensure Site Exists (pass through)` → `Prepare Audit (add to context)` → `Analyze HTML (match against page)` → `Score (generate details)` → `Write GEO Signals (persist)`

### 4.5 Analyze HTML: Service Recommendations

When `ctx.specialties` or `ctx.gbp_services` are populated, the audit ranks services by search volume using a built-in lookup table (~40 tattoo/piercing services with monthly search volumes). The top 5 are included in:
- **Hero section recommendation**: "Lead with your most-searched service (X, Y/mo)"
- **Services section recommendation**: Lists top 5 by demand with volumes
- **`homepage_sections.top_services`**: Stored for dashboard display

### 4.6 Webhook Trigger

```bash
# Single site by GHL location
curl -X POST https://tn.reinventingai.com/webhook/run-audit \
  -H "Content-Type: application/json" \
  -d '{"locationId": "56Jnv0OGTMdU1XSZyJIR"}'

# Single site by domain
curl -X POST https://tn.reinventingai.com/webhook/run-audit \
  -H "Content-Type: application/json" \
  -d '{"domain": "darksidetattoo.com"}'
```

### 4.7 Updating the Workflow

All workflow modifications use Python scripts that:
1. `GET /api/v1/workflows/{WF_ID}` — fetch current state
2. Find target node by name, modify `jsCode` via string replacement
3. `POST /api/v1/workflows/{WF_ID}/deactivate`
4. `PUT /api/v1/workflows/{WF_ID}` — push updated nodes
5. `POST /api/v1/workflows/{WF_ID}/activate`

Scripts stored in `/tmp/` (ephemeral):
- `fix-analyze-html-order.py` — Fixed rankedServices variable ordering
- `fix-write-audit-hp.py` — Added homepage_sections to PATCH path
- `fix-contact-detection.py` — Broadened Contact Info detection
- `fix-artist-detection.py` — Broadened Artists/Team + Gallery + Services + Hero detection
- `fix-social-proof.py` — Made Social Proof recommendation tattoo-industry-specific
- `add-nap-matching.py` — Added real NAP matching (phone/address/name)
- `add-service-recs.py` — Added service search volume recommendations
- `enrich-geo-signals.py` — Added details/groups/recommendations to GEO signals

---

## 5. Dashboard

### 5.1 Deployment

- **Hosted on**: GitHub Pages — `TattooNOW/site-audit` repo
- **Deploy dir**: `/tmp/site-audit-deploy/` → push to GitHub
- **Must update BOTH**: `index.html` and `dashboard.html` (identical copies)
- **URL format**: `https://tattoonow.github.io/site-audit/?locationId=YOUR_GHL_LOCATION_ID`

### 5.2 Tabs (10 total)

| # | Tab | Data Source | Key Visuals |
|---|-----|-----------|-------------|
| 1 | Overview | audits, rank_maps | 4 score cards (SEO/AI/GEO/Overall), Core 30 bar, timeline chart, quick wins, GBP health |
| 2 | Homepage | audits.homepage_sections | 12 section cards (found/missing), search volume recommendations, critical missing count |
| 3 | Rank Map | rank_maps | Grid heatmap, stats cards, trend line |
| 4 | Core 30 | audits.core30_coverage, content_briefs | Coverage bars, content pipeline table |
| 5 | Findings | findings | Filterable table (severity/status/category/layer) |
| 6 | GEO | geo_signals | Grouped signal cards (Schema/On-Page/NAP) with details, score |
| 7 | AI | ai_mentions | Engine/query/mentioned table |
| 8 | Link Checklist | link_checklist | Priority table, built/total counter, type filter |
| 9 | Competitors | competitors, sites | Benchmark table, color-coded vs client |
| 10 | Directories | directory_listings | Status cards, NAP Match %, tier filtering, claim/register URLs (~35 platforms) |

### 5.3 Dashboard Data Flow

```
Supabase REST API (anon key)
  → sites: business info, location data
  → audits: scores, homepage_sections, core30, content_briefs
  → findings: filterable issues
  → geo_signals: 9 signals with details/groups
  → rank_maps: grid scan data
  → competitors: benchmark data
  → link_checklist: link-building tasks
  → directory_listings: NAP audit data
  → ai_mentions: AI probe results
```

---

## 6. File Inventory

```
site-audit/
├── dashboard.html          # React SPA — 10 tabs (deployed to GitHub Pages)
├── loader.js               # locationId param handler
├── .env.example            # Required env vars
├── STATE.md                # This file
│
├── supabase/
│   ├── setup.sql           # v2 DDL + seed data
│   └── migrate-v3.sql      # v3 migration — run after setup.sql
│
├── scripts/
│   ├── package.json        # v3.0.0 — deps + scripts
│   ├── run-audit.js        # 16-step CLI pipeline (backup — primary is n8n)
│   ├── seed-darkside.js    # Seed script for test data
│   ├── import-rankmap.js   # Local Falcon CSV → rank_maps
│   ├── import-sf.js        # SpyFu CSV → competitors
│   │
│   └── lib/
│       ├── supabase.js     # Supabase client init
│       ├── delta.js        # Delta calculation helpers
│       ├── scoring.js      # v3 scoring engine
│       ├── html-parser.js  # HTML fetch + signal extraction
│       ├── crawler.js      # Multi-page site crawler
│       ├── gbp-lookup.js   # Google Places API (New)
│       ├── core30-analyzer.js  # Core 30 gap analysis + content briefs
│       ├── link-checklist.js   # Link-building task generator
│       └── competitor-scanner.js # Lightweight competitor data
│
├── n8n/                    # Legacy local workflow JSONs (primary pipeline is now n8n cloud)
│   ├── audit-runner.json
│   ├── ai-prober.json
│   ├── report-notifier.json
│   └── rankmap-puller.json
│
└── docs/
    └── intake-form-fields.md  # 29-field intake form spec
```

---

## 7. Test Sites

| Field | Darkside Tattoo | TattooNOW |
|-------|----------------|-----------|
| Site UUID | `a1b2c3d4-0000-0000-0000-000000000001` | `c92052d8-54d2-4f18-b16c-4fd4c2053e0d` |
| Domain | `darksidetattoo.com` | `tattoonow.com` |
| GHL Location | `56Jnv0OGTMdU1XSZyJIR` | `dWlb0GcHLhNYv9zAChVt` |
| City | East Haven, CT | Easthampton, MA |
| Phone | 203-469-9208 | |
| Address | 190 Main Street | |

---

## 8. Migration Status

| Migration | Status | Notes |
|-----------|--------|-------|
| `setup.sql` | ✅ Done | v2 schema + seed data in Supabase |
| `migrate-v3.sql` | ✅ Done | v3 schema additions applied |
| `homepage_sections` column | ✅ Done | Added to audits table |
| `details` column | ✅ Done | Added to geo_signals table |
| `directory_listings` table | ✅ Done | Created for directory audit skill |

---

## 9. Findings Generation

The n8n workflow generates findings from multiple sources:

### 9.1 Schema Findings
- `no-schema-at-all` — No JSON-LD found (high)
- `no-localbusiness-schema` — Missing LocalBusiness (high)
- `no-faq-schema` — Missing FAQPage (low)

### 9.2 SEO Findings
- Missing/bad title tag, H1, meta description
- City not in title/H1

### 9.3 Homepage Section Findings
For each missing section with importance ≥ "high":
- `hp-missing-hero-banner` — Missing Hero/Banner section (high)
- `hp-missing-services` — Missing Services section (high)
- Recommendation text includes personalized service data with search volumes

### 9.4 GEO Findings
Generated from failed GEO signals — each includes the specific element checked (e.g., actual phone number, address).

---

## 10. Operational Runbook

### Trigger an audit
```bash
# Single site by location
curl -X POST https://tn.reinventingai.com/webhook/run-audit \
  -H "Content-Type: application/json" \
  -d '{"locationId": "56Jnv0OGTMdU1XSZyJIR"}'

# Check execution status
curl -s "https://tn.reinventingai.com/api/v1/executions?workflowId=k2xPgpbGZEqLYg8B&limit=1" \
  -H "X-N8N-API-KEY: $N8N_API_KEY"
```

### Import rank map data
```bash
cd scripts
node import-rankmap.js --file ~/Downloads/local-falcon-export.csv \
  --location 56Jnv0OGTMdU1XSZyJIR --keyword "tattoo shop" --date 2026-03-01
```

### Deploy dashboard
```bash
cd /tmp/site-audit-deploy
cp /path/to/dashboard.html index.html
cp /path/to/dashboard.html dashboard.html
git add -A && git commit -m "Update dashboard" && git push
```

### Run directory audit
Use the `directory-listing-audit` Claude skill — populates `directory_listings` table.

### Modify n8n workflow
Write a Python script following the pattern in §4.7. Always:
1. Fetch current workflow state
2. Find target node by `name`
3. String-replace the old code with new code
4. Deactivate → PUT → Activate

---

## 11. Known Limitations / TODOs

- [ ] AI prober workflow not yet active — needs ChatGPT/Perplexity/Gemini API configs
- [ ] Google Custom Search indexation estimates not implemented
- [ ] `competitor-scanner.js` `estimateIndexedPages()` returns null
- [ ] No automated Screaming Frog import
- [ ] Link Checklist has heavy overlap with Directories tab (22/25 items are directory listings) — consider combining
- [ ] Core 30 analysis needs `gbp_primary_category` populated to work
- [ ] No automated rank map pulling (Local Falcon CSV import only)
- [ ] `seed-darkside.js` uses v2 field set — needs v3 updates
