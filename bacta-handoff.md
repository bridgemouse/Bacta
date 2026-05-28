---
title: Bacta — Build Handoff
tags:
  - software-dev
  - bacta
  - health-dashboard
---

# Bacta — Build Handoff

> [!success] Revived — Session 63 (2026-05-27)
> Back on track. UI blocker solved by **Claude Design** (claude.ai/design, powered by Opus 4.7) — use it to prototype the dashboard UI before implementing. **SparkyFitness** and **wger** are now deployed on LXC 107 as running reference implementations; borrow schema design and feature logic freely.
>
> **AZI-3 rethink:** On-demand insights (not just nightly cron) via local **Ollama** model on LXC 106 — avoids Claude API costs. Inspired by Google Health's AI insight card pattern (summary + sources at top of dashboard).
>
> **Architecture confirmed:** Standalone app, own backend (custom SQLite). NOT a SparkyFitness fork. NOT riding on SparkyFitness API.

**Design specs (approved, pre-stall):** [[2026-04-25-bacta-design|Bacta Design Spec]] · [[2026-04-26-dashboard-ui-design|Dashboard UI Design]] · [[2026-04-28-azi3-insight-generation-design|AZI-3 Insight Generation Design]]

Personal health dashboard PWA. Named after the Star Wars healing fluid. This doc is a handoff to a fresh Claude session to kick off the build.

---

## What Superpowers Decides

Stack, folder structure, component architecture. Don't pre-constrain it. Present options and let Ethan choose.

---

## What We Know Going In

**Access:** Local WiFi only. Saved to iPhone home screen as PWA. No public exposure, no SSL cert headaches. Caddy on the LXC handles local domain (e.g. `bacta.local`).

**Deployment:** New LXC (not LXC 106), Docker, Caddy reverse proxy.

**Vault integration:** The Bacta LXC mounts the ObsidianVault as a read-only volume. Dashboard reads markdown directly at runtime — no MCP hop needed for vault data. vault-query MCP must also be registered on the Bacta LXC (same setup as LXC 106) for the Claude cron jobs to use.

---

## Data Sources

### Garmin (via garmin-mcp or direct API)
**Update (Session 33):** The custom `garmin-mcp` server is now live on LXC 106. Auth workaround: authenticate on Windows machine, SCP garth tokens to `~/.garminconnect/garmin_tokens.json`. Garth handles refresh automatically. LLM-Wiki already has live Garmin data access — Bacta does NOT need to expose a relay API for this purpose.

For the Bacta app itself, you can either (a) query garmin-mcp's SQLite database directly (it lives at `~/.garmin-mcp/garmin.db` on LXC 106) via a shared volume or network read, or (b) implement a second Garmin poller on the Bacta LXC using the same garth auth pattern. Avoid duplicating auth state — share the token file if both LXCs can reach each other.

**Metrics to pull:**
- Steps, floors, intensity minutes
- Heart rate (resting, daily, during activities)
- HRV (nightly + trends)
- Sleep (score, stages — light/deep/REM, duration, restlessness)
- Body battery (daily trend)
- Stress score
- SpO2 / respiration rate
- VO2 max trend
- Training load + recovery time advisor
- Workouts (type, duration, HR zones, pace, distance)
- Running dynamics (cadence, ground contact time, vertical oscillation — if supported by Venu 4)
- Weekly mileage + volume trends
- Pace trends over time
- Hydration
- Weight (if logged via Garmin)
- Alcohol units (Garmin journal)

### MacroFactor (unofficial Firebase client)
No public API exists. Use `@sjawhar/macrofactor-mcp` — a TypeScript client that calls MacroFactor's Firebase/Firestore backend directly with username/password auth. 28 tools, read + write. Credentials via env vars (`MACROFACTOR_USERNAME`, `MACROFACTOR_PASSWORD`).

**Risk:** reverse-engineered, could break on a MacroFactor backend update. No known alternative short of Apple HealthKit (not accessible to PWAs).

**Metrics to pull:**
- Daily calories (consumed vs. target)
- Macros: protein, carbs, fat
- Micronutrients: fiber, sodium, sugar
- Calorie expenditure estimate
- Weight trend (MacroFactor's smoothed trend line, not raw scale)
- Food log entries

### Blood Work (vault markdown)
Factor blood test results ingested into vault (same pattern as `wiki/personal/lab-results-2026-04-17.md` for Marissa). Bacta reads via volume-mounted vault.

**Schema decision deferred** — wait for actual Factor results to arrive, ingest through LLM-Wiki first, then establish frontmatter schema for machine-readable parsing. Don't pre-build a parser for a format that doesn't exist yet.

### Manual Inputs (lightweight UI)
- Subjective readiness / energy (1–5 daily) — correlates everything else, high signal
- Caffeine
- Supplements checklist

---

## Claude Cron Job Architecture

This is the feature that makes Bacta genuinely different from an off-the-shelf health app.

**Mechanism:** Claude Code CLI installed on the Bacta LXC. Scheduled jobs run during off hours using Claude Code's built-in `schedule` / `CronCreate` feature (no custom cron wiring needed). Each job has a guardrailed prompt scoped to a specific insight section.

**What the jobs do:** Read raw health data + query the vault via vault-query MCP → write a pre-computed insight summary to a specific file in `/insights/`. Dashboard renders these files at page load — fast, no live AI calls.

**Why vault-query matters here:** The scheduled Claude knows Ethan's full context — current training block and VO2 max goals, wedding taper timeline, lax season impact on metrics, hypermobility context for joint load, personal philosophy. Entries are genuinely personal, not generic.

Example output instead of "HRV: 42 — below 7-day average":
> "HRV's been down three days running, which lines up with the mileage spike this week. Consistent with adaptation phase of the 8-week Garmin Coach block — not a red flag. Prioritize sleep tonight."

**Data architecture — keep clean separation:**
- `/data/` — raw polled data, written only by data pollers
- `/insights/` — Claude-written summaries, written only by cron jobs
- Dashboard reads both, writes neither

**Suggested insight sections (starting point, not exhaustive):**
- Weekly training summary
- Recovery status (HRV + body battery + sleep)
- Macro adherence report
- Sleep quality narrative
- VO2 max / fitness trend
- Blood work flags (when Factor results are ingested)

**vault-query MCP on Bacta LXC:** Must be registered in `~/.claude.json` on the new container. The vault is already volume-mounted read-only, so the server path resolves — just needs wiring. Same setup as LXC 106.

---

## Sequencing

**Before the build:**
1. Create GitHub repo (`bridgemouse/bacta`)
2. Provision new LXC

**When Factor blood results arrive:**
3. Ingest into vault via LLM-Wiki (same pattern as Marissa's lab results)
4. Establish YAML frontmatter schema for machine-readable lab result pages
5. Build vault markdown parser in Bacta for blood work data

**Build phase (Superpowers-driven):**
6. Data layer: Garmin data source (shared DB or second poller — see Garmin section above), MacroFactor Firebase client, vault reader
7. Manual input UI (readiness score, caffeine, supplements)
8. Dashboard UI: all metrics, PWA manifest, good-looking layout
9. Claude cron job scaffolding: install Claude CLI, register vault-query MCP, write guardrailed prompts, wire schedule
10. Containerize + deploy to new LXC

---

## Open Questions for Superpowers

- What's the cleanest stack for a local-only health dashboard PWA? (React + Node? SvelteKit? Something else?)
- How should the data polling interval work — continuous background process or cron-triggered?
- Best approach for storing polled data locally on the LXC — SQLite, flat JSON files, something else?
- PWA offline behavior — does it need to work without the LXC reachable, or is always-on-LAN assumed?
