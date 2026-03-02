# Claude Code Prompt: Merge Benefit-Driven Onboarding with Google Sheets Backend

> **Copy-paste this entire prompt into a Claude Code session working on the `tattoo-artist-suite` repo.**

---

## Context

This repo has three standalone HTML pages in `public/`:

1. **`onboarding.html`** — A 4-screen benefit-driven onboarding flow:
   - Screen 1: Welcome (contact info form)
   - Screen 2: Priority picker (choose up to 4 from 7 benefit cards)
   - Screen 3: Task list (personalized tasks grouped by selected benefits)
   - Screen 4: Summary & submit
   - Currently uses **localStorage only** for persistence
   - Has a webhook system (fires `priorities_selected`, `task_completed`, `onboarding_complete`) but requires a webhookUrl to be passed in

2. **`launchpad-checklist.html`** — A technical setup checklist (domain, Google Business, social media, etc.)
   - Has a working **Google Sheets integration** via Google Apps Script
   - Pattern: `fetch(APPS_SCRIPT_URL)` with `action=save` / `action=load` and `locationId` + `secretKey`
   - Falls back to localStorage when offline
   - Uses YouTube video embeds per step
   - Has a progress wheel (circular SVG)

3. **`dashboard.html`** — A circuit-board-style command center showing tool health/status

There's also **`launchpad-embed.js`** — an iframe embed script for HighLevel integration.

---

## The Task

**Connect `onboarding.html` to the Google Sheets backend** using the same pattern established in `launchpad-checklist.html`. Then create a unified flow where the benefit-driven onboarding feeds into (or merges with) the launchpad checklist.

### Part 1: Add Google Sheets Persistence to `onboarding.html`

Reference the Apps Script integration pattern from `launchpad-checklist.html`:

```javascript
// These are the existing credentials (DO NOT change):
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwNjZ1kzDqvqCyi45CKgSljCVE5jGbW1Za1iInIXDo6uJvB5b9n7OP6sjV-O1Nu7MjL/exec';
const APPS_SCRIPT_SECRET = 'tattoonow_onboarding_2024';
```

**What to save to Sheets (via Apps Script `action=save`):**
- `locationId` — from URL params
- `contactName`, `businessName`, `contactEmail`, `contactPhone`
- `selectedBenefits` — JSON array of benefit IDs in selection order
- `completedTasks` — JSON object of `{ taskId: true }` entries
- `currentScreen` — which screen the user is on (0-3)
- `onboardingCompleted` — boolean flag
- `submittedAt` — ISO timestamp when they hit final submit

**What to load from Sheets (via Apps Script `action=load`):**
- All of the above, to restore state on page load
- Fall back to localStorage if Sheets fetch fails (same pattern as launchpad-checklist.html)

**Save triggers:**
- On every screen navigation (`goToScreen()`)
- On every benefit selection/deselection (`toggleBenefit()`)
- On every task completion (`toggleTask()`)
- On final submit (`submitOnboarding()`)

**Load trigger:**
- On page load, before `renderProgressBar()` and `renderBenefitGrid()` are called
- Try Sheets first, fall back to localStorage

### Part 2: Create the Unified Onboarding Flow

After the benefit-driven onboarding is complete (user hits "Submit & Finish" on Screen 4), the flow should transition into the launchpad checklist — but **filtered/prioritized based on the benefits the user selected**.

**Approach options (pick the cleanest one):**

**Option A — Single page with phases:**
Merge both into one HTML file. After the 4 benefit screens, the page transitions into a checklist phase where:
- Steps from `launchpad-checklist.html` are shown, but ordered/highlighted based on selected benefits
- The benefit-to-tool mapping already exists in `onboarding.html`'s `BENEFITS` array (each benefit has a `tools` array)
- Steps related to selected benefits appear first with a "Priority" badge
- Remaining steps appear in a "Also recommended" section

**Option B — Two pages, shared state:**
Keep them as separate HTML files but share state through Google Sheets. When onboarding.html completes:
- Save the benefit selections to Sheets
- Redirect to `launchpad-checklist.html?locationId=XXX`
- Launchpad checklist reads the benefit data from Sheets and reorders/prioritizes its steps accordingly

**Option C — Embed handoff:**
After onboarding completes, embed the launchpad checklist inline via iframe (similar to how `launchpad-embed.js` works), passing benefit data via postMessage.

### Part 3: Shared Design System

Both pages already use the same CSS variables and fonts. Make sure the merged/connected flow feels seamless:
- Same dark theme (`--bg`, `--card`, `--primary`, `--accent`, etc.)
- Same fonts (Archivo Black for headings, DM Sans for body)
- Same animation patterns (`fadeInUp`)
- Consistent button styles (`.btn-primary`, `.btn-outline`)

### Part 4: Update the Embed Script

Update `launchpad-embed.js` (or create a new `onboarding-embed.js`) so the full onboarding flow can be embedded in HighLevel pages. It should:
- Accept the same URL params (`locationId`, `package`, `webhookUrl`, `studioType`)
- Communicate events via postMessage to the parent page
- Events to fire: `screen_changed`, `priorities_selected`, `task_completed`, `onboarding_complete`, `checklist_step_completed`

---

## Key Files to Reference

| File | What to look at |
|------|----------------|
| `public/onboarding.html` | Benefit definitions (`BENEFITS` array), task structure, contact form, webhook system, localStorage state management |
| `public/launchpad-checklist.html` | Google Sheets integration pattern (`saveProgress()`, `loadProgress()`), Apps Script URL/secret, video config, progress wheel |
| `public/launchpad-embed.js` | Embed pattern, URL param extraction, postMessage API, global `window.TattooNOWLaunchpad` API |
| `public/dashboard.html` | Tool definitions (`BASE_TOOLS`), studio type profiles — useful for understanding the tool ecosystem |

---

## Constraints

- **Do NOT change the Apps Script URL or secret** — the Google Sheets backend is already deployed
- **Do NOT break the existing launchpad-checklist.html** — it's in use. Any changes should be additive
- **Keep it as standalone HTML** — no build step, no npm, no React. These are served as static files and embedded via iframes in HighLevel
- **Mobile-first** — must work well on phones (existing CSS is already responsive, maintain this)
- **Offline resilience** — always fall back to localStorage if Sheets is unreachable

---

## Benefit-to-Tool Mapping (for reference)

This mapping drives which launchpad steps get prioritized:

| Benefit | Tools |
|---------|-------|
| Get More Clients | website, reputation, post-scheduler, email-marketing |
| Never Miss a Lead | funnels, crm, one-box, ivr |
| Communicate Best-in-Class | calendars, one-box, reputation, appointments |
| Get Paid Faster | appointments, text-to-pay, payments |
| Save Time | post-scheduler, one-box, email-marketing, calendars |
| Grow Your Team | multi-artist, recruiting, website, business-plan |
| Level Up My Business | roundtable, consulting, courses, business-plan |

---

## Expected Deliverables

1. Updated `onboarding.html` with Google Sheets save/load
2. A unified flow connecting benefit selection to the launchpad checklist
3. Updated or new embed script for the full flow
4. All changes committed with clear messages
