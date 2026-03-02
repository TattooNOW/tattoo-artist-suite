# Intake Form Fields

> **Purpose:** Every field the CSM (or GHL form) needs to collect before running a first audit.  
> Fields map directly to `sites` table columns unless noted otherwise.

---

## Required Fields

| # | Field | DB Column | Type | Example | Why It Matters |
|---|-------|-----------|------|---------|----------------|
| 1 | GHL Location ID | `ghl_location_id` | text (unique) | `56Jnv0OGTMdU1XSZyJIR` | Links audit data to the GHL sub-account; used by loader.js to scope the dashboard |
| 2 | Domain | `domain` | text | `darksidetattoo.com` | Homepage URL for the crawler; all page-level findings reference this |
| 3 | Business Name | `business_name` | text | `Darkside Tattoo & Body Piercing` | Used in GBP lookup, competitor scanning, and title-tag scoring formula |
| 4 | Business Type | `business_type` | enum | `studio` | Controls which scoring weights apply. Values: `studio`, `event`, `portfolio`, `saas` |
| 5 | Primary Keyword | `primary_keyword` | text | `tattoo studio east haven ct` | Anchor keyword for title-tag scoring (Caleb formula), rank map, competitor scan |
| 6 | Target City | `target_city` | text | `East Haven` | Geo anchor for Core 30 content briefs, link checklist, and rank map grid |
| 7 | Target State | `target_state` | text | `CT` | Paired with target_city for geo scoring and competitor queries |

## Strongly Recommended

| # | Field | DB Column | Type | Example | Why It Matters |
|---|-------|-----------|------|---------|----------------|
| 8 | Target Area | `target_area` | text | `Greater New Haven` | Used in content briefs when the metro label differs from the city |
| 9 | Target Radius (mi) | `target_radius_mi` | integer | `10` | Sets rank map grid radius and competitor search scope. Default: 10 |
| 10 | Address | `address` | text | `190 Main Street` | Schema.org LocalBusiness, NAP consistency checks |
| 11 | City | `city` | text | `East Haven` | Physical city for NAP (may differ from target_city if studio targets a larger metro) |
| 12 | State | `state` | text | `CT` | Physical state for NAP |
| 13 | ZIP | `zip` | text | `06512` | Schema.org address, local pack data |
| 14 | Phone | `phone` | text | `203-469-9208` | NAP consistency; appears in schema findings |

## GBP (Google Business Profile) Data

> **How to collect:** CSM opens GBP dashboard or uses [GMB Everywhere](https://chrome.google.com/webstore/detail/gmb-everywhere/) Chrome extension.  
> If `GOOGLE_PLACES_API_KEY` is set, `gbp-lookup.js` auto-fills review count, rating, categories, and place ID — but **services must be entered manually** (not available via Places API).

| # | Field | DB Column | Type | Example | Why It Matters |
|---|-------|-----------|------|---------|----------------|
| 15 | GBP Primary Category | `gbp_primary_category` | text | `Tattoo Shop` | Core 30 uses this to check if homepage targets the primary category |
| 16 | GBP Secondary Categories | `gbp_secondary_categories` | text[] | `['Body Piercing Shop']` | Core 30 checks each category has a dedicated page with ≥1000 words |
| 17 | GBP Services | `gbp_services` | text[] | `['Custom Tattoo', 'Cover-Up Tattoo', 'Japanese Tattoo']` | **Core 30 gap analysis hinges on this list.** Each service should map to a page. Must be entered manually from GBP dashboard. |
| 18 | GBP Review Count | `gbp_review_count` | integer | `89` | Benchmarked against competitors; used in GBP score |
| 19 | GBP Review Rating | `gbp_review_rating` | numeric(2,1) | `4.3` | Benchmarked against competitors; displayed on dashboard |
| 20 | GBP Landing Page | `gbp_landing_page` | text | `/` | Which page GBP links to. Used to verify the homepage is the GBP destination. Default: `/` |
| 21 | GBP Place ID | `gbp_place_id` | text | `ChIJ...` | Enables direct GBP embed detection, future Map Pack tracking. Auto-filled by `gbp-lookup.js` if API key set. |

## Artist & Specialty Data

| # | Field | DB Column | Type | Example | Why It Matters |
|---|-------|-----------|------|---------|----------------|
| 22 | Artist Count | `artist_count` | integer | `7` | Flags if artist pages exist for each artist; content brief generation |
| 23 | Artist Names | `artist_names` | text[] | `['Sean O''Hara', 'Melinda O''Hara', 'Bobby D', ...]` | Core 30 checks each artist has a profile page; schema PersonalProfile generation |
| 24 | Specialties | `specialties` | text[] | `['Custom', 'Cover-ups', 'Japanese', 'Realism', 'Body Piercing']` | Supplemental to GBP services; used for content brief keyword targeting |

## Optional / Auto-Detected

| # | Field | DB Column | Type | Example | Why It Matters |
|---|-------|-----------|------|---------|----------------|
| 25 | Secondary Keywords | `secondary_keywords` | text[] | `['tattoo shop east haven', 'body piercing east haven ct']` | Additional keywords for title/H1 checks across inner pages |
| 26 | Email | `email` | text | `info@darkside.com` | Schema.org, optional contact checks |
| 27 | Year Started | `year_started` | integer | `1992` | Can appear in schema; "Serving since 1992" copy suggestions |
| 28 | Social Links | `social_links` | jsonb | `{instagram: "...", facebook: "..."}` | Link equity audit; schema sameAs property |
| 29 | Country | `country` | text | `US` | Default `US`. Schema.org address |

## Fields NOT Collected at Intake (Auto-Populated by Audit Pipeline)

These exist in the `sites` table but are **set by the audit scripts**, not the intake form:

| Field | DB Column | Set By |
|-------|-----------|--------|
| Retheme Detected | `retheme_detected` | `run-audit.js` — detects GHL default theme markers |
| Retheme Target | `retheme_target` | `run-audit.js` — records which GHL template is in use |

---

## Data Flow: Intake → Audit

```
Intake Form (GHL / CSM)
  │
  ▼
sites table (INSERT)
  │
  ├─ domain → crawler.js → crawl all pages
  ├─ business_name + target_city + target_state → gbp-lookup.js → auto-fill GBP fields
  ├─ primary_keyword + target_city → competitor-scanner.js → competitors table
  ├─ gbp_categories + gbp_services + artist_names → core30-analyzer.js → gap analysis
  ├─ core30 content_briefs → link-checklist.js → link_checklist table
  ├─ primary_keyword + target_city → rank map import → rank_maps table
  │
  ▼
audits table (INSERT) — scores, findings, content_briefs, core30_coverage
```

## View-Layer Considerations

The intake data powers several **dashboard views** that could be valuable for the client-facing experience:

### Dashboard Cards That Depend on Intake Data

| Dashboard Section | Intake Fields Used | What It Shows |
|-------------------|-------------------|---------------|
| **Hero Metric — Rank Map Top 3%** | `primary_keyword`, `target_city`, `target_radius_mi` | Grid heat map of local rankings; the single most important metric |
| **GBP Health Card** | `gbp_review_count`, `gbp_review_rating`, `gbp_primary_category` | Review count vs competitors, category coverage |
| **Core 30 Coverage** | `gbp_secondary_categories`, `gbp_services`, `artist_names` | Progress bar showing pages found vs pages needed |
| **Content Pipeline** | `specialties`, `gbp_services`, `target_city` | Content briefs prioritized by gap severity |
| **Link Checklist** | `target_city`, `city`, `business_name` | Actionable link-building tasks with cost estimates |
| **Competitor Benchmark** | `primary_keyword`, `target_city`, `target_state` | Side-by-side reviews, indexed pages, categories |
| **SEO Score Breakdown** | `primary_keyword`, `business_name`, `target_city` | Title tag formula score, H1 checks, GBP embed status |

### Potential Future Views

- **Artist Page Coverage** — grid showing which `artist_names` have dedicated pages with bio + gallery
- **Service Area Map** — visualize `target_radius_mi` around `target_city` with rank map overlay
- **NAP Consistency Report** — compare `address`/`phone`/`business_name` across GBP, site, and directories
- **Historical Intake Diff** — track when intake fields change between audits (e.g., new artists added, categories updated)

---

## GHL Form Mapping Notes

If building this as a GHL form (rather than manual CSV/Supabase entry):

1. **Multi-value fields** (`artist_names`, `specialties`, `gbp_secondary_categories`, `gbp_services`, `secondary_keywords`) need comma-separated text inputs → split on save
2. **GBP fields** (15–21) can be a separate "GBP Data" section with a note: *"Open your Google Business Profile dashboard or install GMB Everywhere to find these values"*
3. **GHL Location ID** is auto-populated from the sub-account context — CSM doesn't type it
4. **Domain** should validate: strip `https://`, `www.`, trailing slashes
5. Consider a **"Quick Start"** mode: fields 1–7 only, with GBP/artist data filled in on a follow-up call
