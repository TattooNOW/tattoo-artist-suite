# TattooNOW Site Audit System

This repository contains the implementation of a 3-layer site audit system used by TattooNOW. It includes:

- **Layer 1**: Technical SEO audit (HTML signals, metadata, link checks, etc.)
- **Layer 2**: AI discoverability probes (prompt engines to see if a business is mentioned in search-style queries)
- **Layer 3**: GEO/AEO readiness checks (structured data, FAQ presence, entity clarity, etc.)

The system consists of:

```
site-audit/
├── README.md
├── loader.js                    ← GHL embed script
├── dashboard.html               ← Single-file React dashboard
├── supabase/
│   └── setup.sql                ← Full schema with RLS policies
├── scripts/
│   ├── package.json
│   ├── run-audit.js             ← Layer 1: Technical SEO audit
│   ├── check-geo.js             ← Layer 3: GEO/AEO readiness check
│   ├── generate-schema.js       ← Generates JSON-LD for a site
│   ├── inject-schema.js         ← Pushes JSON-LD into GHL via API
│   ├── seed-darkside.js         ← Seeds Darkside Tattoo test data
│   └── lib/
│       ├── supabase.js          ← Supabase client init
│       ├── html-parser.js       ← HTML fetching + signal extraction
│       ├── scoring.js           ← Score calculation per STATE.md
│       └── delta.js             ← Delta calculation between audits
└── n8n/
    ├── audit-runner.json        ← n8n workflow: orchestrates Layers 1+3
    ├── ai-prober.json           ← n8n workflow: Layer 2 AI probes (primary engine)
    └── report-notifier.json     ← n8n workflow: sends summary to admin/client
```

Refer to STATE.md for architecture, data model, scoring, and client information.
