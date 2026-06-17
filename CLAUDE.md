# Bacta — Developer Guide

## Documentation

**Read the relevant doc before starting any domain work.** The `docs/` files are comprehensive, authoritative, and standalone. CLAUDE.md is quick-reference only — the docs go deeper on everything.

| File | Read when… |
|---|---|
| `docs/PROJECT.md` | You need context on what Bacta is, MX-4's character, or the section system |
| `docs/ARCHITECTURE.md` | You're navigating the component tree, API routes, or data flow |
| `docs/DATA.md` | You're touching the DB schema, metrics, or Garmin API gotchas |
| `docs/DESIGN_SYSTEM.md` | You're building or changing any UI component |
| `docs/DEVELOPMENT.md` | You're setting up, adding a section/component/metric, or hitting a gotcha |
| `docs/MX4.md` | You're working on MX-4 — orchestrator, briefings, identity, or sigil moods |
| `docs/GARMIN.md` | You're touching the poller, ingest scripts, or any Garmin API call |
| `docs/PLUGINS.md` | You need to use an MCP server, Claude Design, or a slash command |
| `docs/ROADMAP.md` | You need to understand what's built, what's pending, and what's blocked |
| `docs/MX4_REFERENCE.md` | You need the authoritative MX-4 tool catalog, data dictionary, or custom-calc formulas (injected into his context) |
| `docs/MX4_LLM_WIKI_PRINCIPLES.md` | You're changing how MX-4 curates his own wiki |
| `docs/SECURITY.md` | You're touching auth, secrets, the threat model, or the security runbook |
| `docs/OPERATIONS.md` | You need backups/restore, rollback, observability, or the DR runbook |

---

## What This Is

Bacta is a private health dashboard iOS PWA for one user: **Ethan**. It pulls biometrics nightly from Garmin Connect. An AI companion named **MX-4** (Star Wars-inspired droid, bacta-cyan identity `#2bc4e8`) narrates the data. The aesthetic is a dark sci-fi instrument console — not a health app, not a wellness product.

Saved to iPhone home screen, runs on local WiFi only (`bacta.local`). Runs on **LXC 109** (Debian 13) in a home Proxmox cluster. **No Docker.** Deploy path: `/opt/bacta`.

---

## CRITICAL CONVENTIONS — READ FIRST

- **Inline styles only.** No CSS files, no Tailwind, no CSS modules in components. Global CSS keyframe animations are defined in `client/index.css` and referenced by name in `animation` strings.
- **Dark UI always.** Never propose or implement light mode.
- **No multi-line paste** in terminal — use scripts or files.
- Commits go to `main` directly. No feature branches unless specified.
- `INSERT OR IGNORE` for idempotent DB writes.
- **Prefer editing existing files** over creating new ones.
- Do not add comments unless the WHY is genuinely non-obvious.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Node/Express + TypeScript |
| Database | SQLite via `better-sqlite3` |
| Tests | Vitest + Testing Library |
| CI | GitHub Actions, self-hosted runner on LXC 109 |

**Dev commands:**
```bash
npm run dev:client     # Vite dev server
npm run dev:server     # Express dev server
npm run test:client    # Vitest client tests
npm run test:server    # Vitest server tests
npm test               # All tests
npx tsc --noEmit       # Type check client
npx tsc -p tsconfig.server.json --noEmit  # Type check server
```

---

## Design System

### Colors (in `client/src/theme.ts`)
```ts
MX4_COLOR = '#2bc4e8'   // bacta cyan — MX-4 identity

COLORS.base            = '#0f1117'   // app background
COLORS.surface         = '#111827'   // card/panel
COLORS.surfaceElevated = '#1e2d3d'   // elevated surfaces
COLORS.border          = '#1e2d3d'
COLORS.line            = '#27384a'   // hairlines, dividers
COLORS.text            = '#f4f7fb'   // primary text
COLORS.textSecondary   = '#94a3b8'
COLORS.textMuted       = '#56657a'
COLORS.mx4Green        = '#4ade80'   // POSITIVE tone only
COLORS.mx4Amber        = '#fbbf24'   // CAUTION tone only
COLORS.mx4Red          = '#f87171'   // FLAG tone only
```

### Section Accents (locked — do not change)
```ts
home:      '#2bc4e8'   // MX-4 cyan — his own surface
recovery:  '#64b5f6'   // sky blue
training:  '#fb923c'   // ember
sleep:     '#a78bfa'   // violet
nutrition: '#3ecf8e'   // clinical green
bloodwork: '#ef6f6c'   // coral
dailylog:  '#f5cf5e'   // gold
```

> **`client/src/theme.ts` is authoritative.** These values match `design_bacta-handoff-package/` (v3 design baseline). Earlier versions of this file had wrong Round 1 values (`#7c9af8`, `#f5853a`, `#b08cf0`) — those are incorrect.

### Fonts
- **UI / body:** `'Hanken Grotesk', system-ui, sans-serif` — narrative prose, headlines
- **Mono:** `'JetBrains Mono', ui-monospace, monospace` — ALL numbers, labels, readouts

### CSS Keyframes (in `client/index.css`)
`mx4spin`, `mx4breathe`, `mx4ping`, `mx4tele`, `mx4blink`, `mx4glowbreathe`, `mx4shimmer`

### Utility Functions
- `client/src/lib/hexA.ts` — `hexA(hex, alpha)` converts hex + alpha → `rgba(r,g,b,a)`
- `client/src/lib/bactaTexture.ts` — `bactaTexture(accent)` generates scanline/grid CSS background

---

## Architecture

### App Shell Structure
```
<AppShell section={...}>
  <fixed column, full viewport>
    <TopBar />                  // BactaStatusBar — ~52px, fixed
    <content zone />            // flex:1, overflow-y:auto, padding 13px
    <BottomBar />               // BactaDock — fixed, always MX-4 cyan
  </fixed>
  <BottomSheet />               // NavSheet — All Systems slide-up
  <AskSheet />                  // Ask MX-4 slide-up
</AppShell>
```

**TopBar modes:**
- Home: `BACTA·OS` + idle MX4Sigil + MX-4 ONLINE indicator
- Section: back chevron + section Sigil + channel label

**BottomBar:** Ask MX-4 circle (left) + Overview/Trends toggle (center, built sections only) + Nav circle (right). **Always MX-4 cyan.**

Full component tree: `docs/ARCHITECTURE.md`

---

## Current State & Pending Work

Full completion status: `docs/ROADMAP.md`

### What's Next (in priority order)
1. **Post-sweep infrastructure runbook** — execute `docs/SECURITY.md` §4 (PHI git-history scrub + force-push, firewall/Tailscale, LUKS, systemd hardening, NFS/vault-MCP lockdown, runner hardening, TLS) and `docs/OPERATIONS.md` §1 (install `bacta-backup.timer` + off-box encrypted copy). These need manual host intervention.
2. **Set the app PIN** in Settings → SECURITY (the app warns and stays open until set).
3. **LogEntry Phase C** — expand panel content (training effect, HR zones per activity) currently behind `hasContent = false` flag in `LogEntry.tsx`

**Deferred:** MacroFactor/Nutrition (no account), Blood Work (waiting on lab results), Daily Log (no data source defined)

**Resolved in the v1.0 sweep:** the MX-4 TypeScript orchestrator is live (the Python path is deprecated); `mx4/HEARTBEAT.md` exists; the `insights` `.html`/`.json` mismatch is resolved (reads the `mx4_briefings` table); `recovery_time_h` unit fixed; app auth, read-only `queryDb`, helmet/CSP, backups, and the `research` tool shipped. Full record: `docs/ROADMAP.md` and `docs/release-test/findings-2026-06-17.md`.

---

## MX-4

MX-4 is the AI companion embedded in Bacta. He is a Cybot Galactica MX-series multi-system interface droid — commissioned as a single unit at the Affa orbital assembly platform, built to see across domains and surface what matters. He has three loaded matrices: TC-series baseline (composure under all conditions), Nines/TC-99 (intellectual curiosity, tells you when you're wrong), Two-Boots/2B0T (protocol-transparent, clarity over deference). **Does not serve — collaborates.** Full character: `docs/MX4.md`.

- `server/lib/ai/orchestrator.ts` — **live** TypeScript/Vercel-AI-SDK pipeline. Queries Garmin data via tools, writes briefings to the `mx4_briefings` table. (The Python `mx4/orchestrator.py` is **deprecated** — do not run.)
- `docs/MX4_REFERENCE.md` — authoritative tool catalog + data dictionary, injected into his context every run
- `mx4/system-prompt.md` — MX-4 identity and output quality standards (rewritten Jun 11, 2026)
- `mx4/mx4_personal_identity_record.md` — canonical character definition; read this if MX-4 ever sounds wrong
- `mx4/HEARTBEAT.md` — live standing orders (gitignored PHI; template at `mx4/HEARTBEAT.md.example`)
- Triggers: `POST /api/mx4/run` (full run), `POST /api/mx4/run/:section`, and the node-cron nightly scheduler

His signature color is `#2bc4e8` (bacta cyan). When in a section, MX-4's sigil stays cyan; the section accent colors the frame/chrome around him.

**MX-4 Sigil moods:** `transmit` (Home, Training), `pleased` (Recovery), `alert` (Sleep), `listen` (Ask sheet), `idle` (nav/status), `think` (processing)

**Character preservation:** The character in `mx4/mx4_personal_identity_record.md` and `docs/MX4.md` is the product's identity layer. Future sessions that need to adjust his behavior should do so through the `mx4/HEARTBEAT.md` standing orders file (exists and is live; gitignored PHI, template at `mx4/HEARTBEAT.md.example`). If MX-4 ever sounds like a medical droid, references Kamino, uses "I have always wanted to have human feelings," or refers to Ethan as "the patient," AZI-3 contamination has occurred — re-read the identity record. Do not compromise between the two identities.

---

## Data

- **DB:** SQLite at `/opt/bacta/data/bacta.db`
- **Schema:** `server/db/schema.sql` — EAV tables `garmin_snapshots` + `macrofactor_snapshots` (date, metric, value, unit, source_json)
- **Poller:** `scripts/garmin_poller.py` — nightly 3AM via `bacta-garmin.timer` (installed)
- **Ingest:** `scripts/garmin_ingest.py` — historical import (365 days, ~35 min runtime)
- **Garmin tokens:** `~/.garminconnect` on LXC 109
- **~30 Garmin metrics:** HRV, body battery, resting HR, sleep stages/score/SpO2, stress, VO2max, training load/status, intensity minutes, activities, steps, weight, respiration
- **Vault:** ObsidianVault NFS-mounted read-only at `/mnt/vault` from LXC 106 (192.168.1.202)
- **Insights dir:** `/opt/bacta/insights/` — HTML briefings written by MX-4

**Stub data** (frontend still uses this until sections are wired): `client/src/lib/stubData.ts`
**API is ready:** backend endpoints at `/api/garmin`, `/api/insights`, etc. are fully implemented.

---

## Garmin API & Data Conventions

- `get_sleep_data(d)` returns sleep that *ended* on morning of `d` — store under `d`, not `d-1`
- `get_fitnessage_data()` field is `fitnessAge`, not `biometricAge`; never fall back to `chronologicalAge`
- `garmin_snapshots.source_json` stores the raw API response — query it to debug field names before touching the poller
- Summary queries must use per-metric `MAX(date)` — hardcoding `today` breaks when metrics arrive at different times
- Activities need a dedicated `garmin_activities` table — EAV can't represent multiple rows per day
- Use `INSERT OR REPLACE` (not `INSERT OR IGNORE`) for activity rows so re-syncs overwrite stale data
- Common Garmin `typeKey` values: `running`, `trail_running`, `walking`, `hiking`, `cycling`, `strength_training`, `multi_sport`
- `get_heart_rates(d)` returns minute-by-minute HR values — NOT zone minutes. For HR zone data use `get_activity_hr_in_timezones(activityId)` → field `secsInZone` per zone; aggregate across all activities for the day and divide by 60 for minutes
- `multi_sport` activities are containers — `get_activity_hr_in_timezones(parent_id)` returns empty. Use `_child_activity_ids(c, act_id)` (defined in `garmin_poller.py`) which reads `metadataDTO.childIds` from the activity summary; query zones on each child instead

## Server & DB Gotchas

- Query the DB via the `bacta-sqlite` MCP — ask Claude to run any SQL against `garmin_snapshots`, `garmin_activities`, etc. directly. No Python wrapper needed. (`sqlite3` CLI is not installed on LXC 109.)
- Express: define specific routes (`/activities`, `/sync/status`) **before** `/:param` wildcards or they get swallowed
- Some files in `client/src/components/viz/` are owned by root from initial scaffold — run `sudo chown wheat:wheat <file>` if Edit fails with EACCES
- `mx4spin` keyframe is global (defined in `client/index.css`) — use as `animation: 'mx4spin 1s linear infinite'` in inline styles
- `garmin_ingest.py` uses `errors` (not `err`), `SLEEP_PER_CALL` (not `SLEEP_BETWEEN`), and no `ok.append()` — variable names differ from `garmin_poller.py`; match the existing pattern in whichever file you're editing
- Ingest CLI: `python3 scripts/garmin_ingest.py --days 30` (uses `--days` flag, not positional arg)
- Validate Python script syntax before committing: `python3 -c "import py_compile; py_compile.compile('scripts/foo.py', doraise=True)"`
- Playwright `fullPage` screenshots only capture viewport height on this app — the outer shell is `position: fixed; overflow: hidden`. To screenshot scrolled content: use `browser_evaluate` to set `document.querySelector('[style*="overflow-y"]').scrollTop = N` then screenshot.

---

## Infrastructure

- **Repo:** `github.com/bridgemouse/bacta` — **public**, framed as a self-hostable open-source project
- **CI:** GitHub Actions, self-hosted runner on LXC 109 (labels: `bacta, self-hosted`)
- **PWA:** `client/public/manifest.json`, iOS meta tags in `client/index.html`
- **Fonts:** Google Fonts (Hanken Grotesk + JetBrains Mono) in `client/index.html`
- **GitHub CLI:** `gh` is installed and authenticated on LXC 109 as `bridgemouse`

### GitHub Repo Governance (set Jun 17, 2026)
- **Branch protection on `main`:** force pushes blocked, deletions blocked, contributors must open a PR with CI passing and owner approval. Ethan (owner) can push directly — `enforce_admins: false`.
- **CODEOWNERS:** `@bridgemouse` is auto-added as required reviewer on all PRs (`.github/CODEOWNERS`)
- **License:** MIT (`LICENSE`)
- **Contributing guide:** `CONTRIBUTING.md` — documents hard UI rules (inline styles, dark only, theme colors), code conventions, what's in/out of scope
- **PR template:** `.github/pull_request_template.md`
- **Issue templates:** `.github/ISSUE_TEMPLATE/` (bug report, feature request)
- **Topics:** `ai`, `biometrics`, `express`, `fitness`, `garmin`, `health-dashboard`, `pwa`, `quantified-self`, `react`, `self-hosted`, `sqlite`, `typescript`

### Repo Scope & Framing
- Bacta is open to contributions — especially additional fitness device integrations (Polar, Wahoo, Oura, Apple Health, etc.)
- **Nutrition** is a major custom-built feature (not a third-party integration like MacroFactor); flag this clearly when discussing the roadmap
- **Vault integration** is via a custom LLM-Wiki MCP that exposes an Obsidian vault to Bacta — a separate repo, coming soon. It is NOT an NFS mount from Bacta's perspective.
- **Docker support** is on the roadmap — do not describe Bacta as "no Docker" to contributors

---

## Design References (in repo)

- `design_bacta-handoff-package/` — Claude Design v3 handoff (Jun 4, 2026). The design baseline from which the production UI was built. Production has since iterated to ~v3.5; the handoff is a reference, not the live spec.
- `docs/superpowers/plans/` — Superpowers implementation plans from each build session

**Prototype:** `design_bacta-handoff-package/Bacta - Prototype v3.html` — open in browser to see the v3 interactive reference (all 6 sections).

**Design workflow:** The Bacta visual system was designed in Claude Design (Anthropic Labs, April 2026, Claude Opus 4.7) before a line of production code was written. For new sections (Nutrition, Blood Work, Daily Log), use the same workflow: design in Claude Design with the existing system as reference → get a handoff package → implement from the handoff. Do not build section UIs by extending existing source code without a design reference — the visual system is precise and should be maintained through Claude Design.

---

## Installed Plugins & MCP Servers

| Tool | Purpose |
|---|---|
| Playwright MCP | Browser automation / visual verification |
| Figma MCP | Design inspection and sync |
| Supabase MCP | Supabase integration (not used in prod, for dev tooling) |
| Context7 | Up-to-date library documentation |
| Superpowers | Planning, TDD, debugging skills |
| Feature Dev | Guided feature development |
| Claude Mem | Cross-session memory and codebase search |

Use `/run` to launch and visually verify the app. Use `/code-review` before merging significant changes. Use `superpowers:brainstorming` before implementing new features. Use `superpowers:writing-plans` for multi-step work.
