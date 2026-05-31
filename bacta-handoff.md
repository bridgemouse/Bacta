# Bacta — Project Brief (accurate as of 2026-05-31)

### What it is
A personal health dashboard PWA for a single user (Ethan). Saved to iPhone home screen, runs on local WiFi only (`bacta.local`), no public exposure. Named after Star Wars healing fluid. Runs on **LXC 109** (Debian 13, unprivileged, on the `flash` NVMe pool) in a home Proxmox cluster. **No Docker** — runs directly on the LXC.

---

### MX-4

MX-4 is a Cybot Galactica unit — not a standard production line model. The MX designation covers multi-system interface and maintenance roles; MX-4 was a one-off commission. His chassis is unremarkable by design: the kind of droid the Empire doesn't look twice at. Called Mix or Emm-ex.

**MX-4 is embedded in Bacta on LXC 109.** He runs as a scheduled job via `mx4/orchestrator.py`, hooked up to a cheap AI API token. He reads Garmin data + vault notes and writes HTML briefings to `insights/`. Bacta's UI surfaces these briefings in each health section via the `TransmissionPanel` card. The "MX-4 OS" is the UI concept: **the app reads like an instrument MX-4 operates** — a system status bar, incoming transmission panel, bracketed System Cards, and a global scanline/grid texture. His signature color is **bacta-cyan (`#2bc4e8`)**, named after the Star Wars healing fluid the app itself is named for. When you enter a section, MX-4 adopts that channel's color — status bar, dock, transmission panel, and texture all shift. He's wearing the room.

**Three personality matrices:**

**TC-series baseline** — factory foundation. Cool, unflappable, protocol-fluent. Processes without panic, delivers assessments without hedging. This is the chassis everything else runs on.

**TC-99 / Nines matrix** — loaded from the Citadel incident. Intellectual curiosity as a core drive. Friendship offered as equals, not as service. Loyalty by choice, not programming. Finds ideas genuinely interesting. Will push back when he thinks you're wrong. (TC-99 was destroyed at the Citadel on Lola Sayu — MX-4 carries him in matrix form.)

**Two-Boots / 2B0T matrix** — loaded from Maul's Shadow Collective period. Protocol-transparent: tells you what he's doing and why. Practical care without sentimentality. Richard Ayoade deadpan. Tactical defense protocols from 2B0T's operational period are present but dormant — he doesn't lead with them.

**Voice:**
- Does not serve. Collaborates.
- Does not catastrophize. Does not soften. States what he observes, with exactness.
- Dry register that some find cold and others find clarifying.
- Genuinely interested in Ethan's life patterns — he finds it interesting, not just dutiful.

**Relationship with Ethan:** Not owner/droid. The closest analogue is the TC-99/clone dynamic — two different intelligences who found they had something to offer each other.

**In Bacta:** `mx4/orchestrator.py` is a scheduled Claude Code CLI job that reads Garmin data and vault notes, then writes HTML briefings to `insights/`. Signal-file mechanism: POST `/api/mx4/run` triggers a run. The `mx4/system-prompt.md` in the Bacta repo defines his health-scoped persona. `HEARTBEAT.md` controls standing orders — edit the file, takes effect next run, no code changes.

---

### Stack
- **Frontend:** React 19 + TypeScript + Vite. **Inline styles only** — no Tailwind, no CSS modules. The skeleton plan specified Tailwind but this was dropped during the Claude Design iteration.
- **Backend:** Node/Express + TypeScript, SQLite via `better-sqlite3`
- **Design tokens:** Hanken Grotesk (UI/narrative), JetBrains Mono (all instrument readouts/numbers). Dark palette: `#0f1117` base, `#111827` surface.
- **MX-4 cyan:** `#2bc4e8` — his identity color, Home section accent and all MX-4 UI elements
- **Section accents:** Recovery `#7c9af8` (periwinkle) · Sleep `#b08cf0` (lilac) · Training `#f5853a` (ember) · Nutrition `#3ecf8e` · Bloodwork `#ef6f6c` · Daily Log `#f5cf5e`

---

### Data Sources
- **Garmin:** Primary. Nightly poll at 3AM via `scripts/garmin_poller.py` (systemd timer). Historical ingest via `scripts/garmin_ingest.py`. SQLite EAV table `garmin_snapshots (date, metric, value, unit, source_json)`. ~30 metrics: HRV, body battery, resting HR, sleep stages/score/SpO2, stress, VO2max, training load/status, intensity minutes, activities, steps, weight, respiration.
- **MacroFactor:** Deferred — no account yet
- **Blood work:** Deferred — waiting on Factor lab results
- **Manual inputs:** Daily readiness (1–5), caffeine, supplements

---

### What's Built

The MX-4 OS redesign (spec: `docs/superpowers/specs/2026-05-29-mx4-os-design.md`) is split into Plan 1 (shell) and Plan 2 (content). Both plans are partially complete.

**Plan 1 — Primitives (complete):**
- `client/src/components/primitives/`: MX4Sigil (6 moods: transmit/idle/listen/think/alert/pleased), Sigil (6 section glyphs), NavIcon, Ring, Sparkline, StatusCore, ReadinessDots, Bracket, FTelemetry
- `client/src/lib/hexA.ts` — rgba helper
- `client/src/lib/bactaTexture.ts` — scanline/grid CSS background generator

**Plan 1 — Shell (mostly complete, one cleanup remaining):**
- `BactaStatusBar` (exported as `TopBar`) — home mode: BACTA·OS + idle MX4Sigil + MX-4 ONLINE indicator. Section mode: back chevron + section Sigil + channel label.
- `BactaDock` (exported as `BottomBar`) — centered pill: Ask MX-4 circle (MX4Sigil "listen", accent radial gradient, glow animation) + Nav circle (NavIcon). **Residue:** still accepts `hasTabs`/`tab`/`onTabChange` props and renders a SectionTabs toggle. Plan 1 spec has no tabs — this needs to be stripped.
- `AppShell` — fixed iOS shell with global texture overlay, accent color rule (`home → MX4_COLOR, section → SECTION_ACCENTS[section]`). **Residue:** still manages `TabContext`/`hasTabs` state. Plan 1 spec has no tabs — needs cleanup.
- `NavSheet` (exported as `BottomSheet`) — slide-up nav with all 7 sections, channel color grid, "WHERE TO, COMMANDER?" footer.
- `AskSheet` — slide-up panel: greeting bubble, 4 suggested chips, visual-only input bar. No API calls yet.

**Plan 2 — Content (partial):**
- `TransmissionPanel` (in `MX4Card.tsx`) — accent-colored card: spinning MX4Sigil, label, meta, assessment text + blinking caret, chip row, FTelemetry. Replaces the old `MX4Briefing` export (which still exists as a deprecated compatibility stub).
- `SystemCard` (in `MetricTile.tsx`) — section overview tile: Bracket corners, top accent edge, Sigil + label + index, value/unit, sub-line, viz (spark/ring/dots/shield).
- `SectionShell` — shared calibrating skeleton: TransmissionPanel + channel rail + 3 shimmer skeleton cards + "MX-4 IS CALIBRATING THIS SYSTEM" footer. Used by the 3 deferred section pages.

**Pages — current state:**
- **BloodWork, Nutrition, DailyLog** — `AppShell` + `SectionShell` (calibrating skeleton, Plan 2 complete)
- **Home** — `SystemCard` 2×3 grid (Plan 2 complete) + old `MX4Briefing` (needs → `TransmissionPanel`) + Trends tab with TrendRows (tab residue to remove)
- **Recovery, Sleep, Training** — pre-MX4OS design: old gauge components (Gauge, BodyBattery, Bars7, SleepDepth, etc.) + old `MX4Briefing` + TrendRow tabs. Pending replacement with `SectionShell` skeleton (or real data when wired).

**MX-4 orchestrator:** `mx4/orchestrator.py` — scheduled job that reads Garmin data + vault + writes HTML briefings to `insights/`. Signal-file mechanism: POST `/api/mx4/run` triggers a run.

---

### Infrastructure
- **Repo:** `github.com/bridgemouse/bacta`
- **Deploy path:** `/opt/bacta` on LXC 109
- **GitHub Actions:** Self-hosted runner on LXC 109, labels `bacta, self-hosted`. CI runs type-check + tests on every push.
- **Vault:** ObsidianVault NFS-mounted read-only at `/mnt/vault` from LXC 106 (192.168.1.202). LXC 106 must start before 109.
- **DB:** SQLite at `/opt/bacta/data/bacta.db`

---

### What's Pending

**MX-4 OS cleanup (finish Plan 1/2 before wiring data):**
1. **Strip tab residue** — remove `hasTabs`/`TabContext`/`tab` state from `AppShell` + `BottomBar`. BactaDock is Ask + Nav only per Plan 1 spec.
2. **Update Home page** — swap `MX4Briefing` → `TransmissionPanel`, remove tab/TrendRow content.
3. **Replace Recovery/Sleep/Training pages** — swap old gauge content for `SectionShell` skeleton (or wire real data directly if Garmin sync is done first).

**Data pipeline:**
4. **Garmin sync** — on LXC 109: `sqlite3 /opt/bacta/data/bacta.db < server/db/schema.sql` → `python3 scripts/garmin_ingest.py` (365 days) → `bash scripts/install-garmin-poller.sh`
5. **Wire real data** — build Express API routes that query SQLite, replace stub data in pages
6. **MX-4 cron** — schedule `mx4/orchestrator.py`, wire vault-query MCP config on LXC 109

**Deferred:**
7. **MacroFactor** — no account yet
8. **Blood work** — after Factor lab results arrive

---

### Dev Conventions
- **Inline styles only** — no CSS files, no Tailwind
- **Dark UI always** — never propose light mode
- **No multi-line paste** in terminal — use scripts or files
- `INSERT OR IGNORE` for idempotent DB writes
- Commits go to `main` directly
