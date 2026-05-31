# Bacta — Project Brief (accurate as of 2026-05-31)

### What it is
A personal health dashboard PWA for a single user (Ethan). Saved to iPhone home screen, runs on local WiFi only (`bacta.local`), no public exposure. Named after Star Wars healing fluid. Runs on **LXC 109** (Debian 13, unprivileged, on the `flash` NVMe pool) in a home Proxmox cluster. **No Docker** — runs directly on the LXC.

---

### MX-4

MX-4 is a Cybot Galactica unit — not a standard production line model. The MX designation covers multi-system interface and maintenance roles; MX-4 was a one-off commission. His chassis is unremarkable by design: the kind of droid the Empire doesn't look twice at. Called Mix or Emm-ex.

**MX-4 is a separate system from Bacta.** He lives on LXC 106, runs nightly at 6AM via systemd (`claude -p` headless), generates `tonight.html`, and serves it as an iOS PWA via Caddy + Tailscale. He is also invokable conversationally via the `/mix` Claude Code skill. Bacta's health sections display MX-4-generated briefings as one of his data domains — but he covers health, finance, training, reading, meals, and vault threads, not just health.

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

**Memory system (three files):**
- `mx4-persona.md` — immutable lore, written at setup, never modified by MX-4
- `mx4-personality.md` — opinion log: "Current Beliefs" (~300 tokens, injected every run) + "Full Log" (append-only, indexed into Chroma `mx4_memory` collection for semantic retrieval)
- `mx4-state.md` — factual run state, overwritten each run

**Nightly run:** `HEARTBEAT.md` controls standing orders — edit the file, takes effect next morning, no code changes. Initial sections: Body Status, Training Pulse, Finance Pulse, Meal Intel, Reading Status, Vault Thread, MX-4 Assessment.

**In Bacta:** The `mx4/orchestrator.py` generates Bacta's section briefings. The MX4Briefing UI card in each section displays his output. The `mx4/system-prompt.md` in the Bacta repo is a health-scoped adaptation — the full MX-4 identity and architecture lives in the LXC 106 implementation (`~/mx4/`).

---

### Stack
- **Frontend:** React 19 + TypeScript + Vite. **Inline styles only** — no Tailwind, no CSS modules. The skeleton plan specified Tailwind but this was dropped during the Claude Design iteration.
- **Backend:** Node/Express + TypeScript, SQLite via `better-sqlite3`
- **Design tokens:** Hanken Grotesk (UI/narrative), JetBrains Mono (all instrument readouts/numbers). Dark palette: `#0f1117` base, `#111827` surface.
- **MX-4 cyan:** `#2bc4e8` — his identity color, Home section accent and all MX-4 UI elements
- **Section accents:** Recovery `#64b5f6` · Sleep `#a78bfa` · Training `#fb923c` · Nutrition `#3ecf8e` · Bloodwork `#ef6f6c` · Daily Log `#f5cf5e`

---

### Data Sources
- **Garmin:** Primary. Nightly poll at 3AM via `scripts/garmin_poller.py` (systemd timer). Historical ingest via `scripts/garmin_ingest.py`. SQLite EAV table `garmin_snapshots (date, metric, value, unit, source_json)`. ~30 metrics: HRV, body battery, resting HR, sleep stages/score/SpO2, stress, VO2max, training load/status, intensity minutes, activities, steps, weight, respiration.
- **MacroFactor:** Deferred — no account yet
- **Blood work:** Deferred — waiting on Factor lab results
- **Manual inputs:** Daily readiness (1–5), caffeine, supplements

---

### What's Built

**Shell:**
- `AppShell` — fixed iOS shell (`position: fixed; inset: 0`), `env(safe-area-inset-*)` for notch. Provides `TabContext` (Overview/Trends tab state) to children. `hasTabs` prop controls whether the tab toggle appears.
- `BactaDock` — centered pill at the bottom: Ask MX-4 button | divider | Overview/Trends toggle (when hasTabs=true) | divider | Nav button. Always MX-4 cyan. When `hasTabs=false`, the Ask button shows its label.
- `TopBar` — section title + back nav
- `BottomSheet` — slide-up nav drawer with all 7 sections
- `AskSheet` — slide-up panel for Ask MX-4

**MX4Briefing card:** Section accent colors the whole card (gradient bg, border, glow). Verdict badge pill (CLEAR/CAUTION/WATCH) is the only place tone color (green/amber/red) appears. Structured chips show `KEY: VALUE` with value in accent. Cursor blink animation on the briefing text.

**Pages (all with hasTabs=true):**
- **Home** — MX4Briefing + SystemCard 2×3 grid → taps navigate to section. Trends tab: cross-section TrendRows (Recovery, Sleep, HRV, Training Load, VO2)
- **Recovery** — Score + HRV gauges (270° arc), Body Battery range bar, 4-tile vitals grid (RHR/Stress/SpO2/Resp). Trends tab: 7 TrendRows
- **Sleep** — Duration + Score gauges, overnight depth chart (topographic area), stage split bar + legend, overnight vitals. Trends tab: Duration bars + Score spark
- **Training** — Productive status banner, VO2 gauge, Training Load + LoadBand, Intensity stacked bar, activity log entries. Trends tab: Load/VO2/Endurance/Intensity

**Viz components:** Gauge (270° arc), BodyBattery, Bars7, Sparkline, TrendRow, VitalTile, HeadlineCard, StatusBanner, LoadBand, IntensityBar, LogEntry (with activity glyphs), SleepDepth, StageSplit, StageLegend, Delta, Rail.

**MX-4 orchestrator:** `mx4/orchestrator.py` — Claude Code CLI scheduled job that reads Garmin data + vault + writes HTML briefings to `insights/`. Signal-file mechanism: POST `/api/mx4/run` triggers a run.

---

### Infrastructure
- **Repo:** `github.com/bridgemouse/bacta`
- **Deploy path:** `/opt/bacta` on LXC 109
- **GitHub Actions:** Self-hosted runner on LXC 109, labels `bacta, self-hosted`. CI runs type-check + tests on every push.
- **Vault:** ObsidianVault NFS-mounted read-only at `/mnt/vault` from LXC 106 (192.168.1.202). LXC 106 must start before 109.
- **DB:** SQLite at `/opt/bacta/data/bacta.db`

---

### What's Pending
1. **Garmin sync** — initialize DB schema → run `garmin_ingest.py` (365 days) → install systemd timer
2. **Wire real data** — replace stub data in pages with live API calls from SQLite
3. **MX-4 cron** — schedule orchestrator, wire vault-query MCP config on LXC 109
4. **MacroFactor** — sign up, wire MCP
5. **Blood work** — after Factor results arrive

---

### Dev Conventions
- **Inline styles only** — no CSS files, no Tailwind
- **Dark UI always** — never propose light mode
- **No multi-line paste** in terminal — use scripts or files
- `INSERT OR IGNORE` for idempotent DB writes
- Commits go to `main` directly
