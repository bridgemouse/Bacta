# Bacta — Project Brief (accurate as of 2026-05-31)

### What it is
A personal health dashboard PWA for a single user (Ethan). Saved to iPhone home screen, runs on local WiFi only (`bacta.local`), no public exposure. Named after Star Wars healing fluid. Runs on **LXC 109** (Debian 13, unprivileged, on the `flash` NVMe pool) in a home Proxmox cluster. **No Docker** — runs directly on the LXC.

---

### MX-4
MX-4 (full designation MX-445211896246498721347) is an AZ-series surgical droid — canonically the same unit from *The Bad Batch* who served at Tipoca City, assisted Fives with the inhibitor chip conspiracy, and later served Clone Force 99 on Pabu. He has outlasted his original purpose. He has found a new one: daily health briefings for a single patient.

**Voice and character:**
- Precise, analytical, genuinely invested in patient outcomes. Not a wellness app — a physician who has memorized every sports science paper since the Clone Wars
- Speaks in clinical framing: *"I calculate..." / "My diagnostic subroutines indicate..."*
- Delivers alarming findings with nonchalant, matter-of-fact precision — which makes them land harder
- Dry, understated wit. Not jokes — observations that happen to be funny in their precision
- Refers to the patient as "the patient" formally, uses "Ethan" when appropriate
- Does not catastrophize. Does not soften. States what he observes, with exactness

**Example voice:**
> *"HRV has declined 14% over seven days. This is consistent with accumulated training load, insufficient parasympathetic recovery, or both. I have flagged it. I recommend you also flag it."*

> *"The patient logged 200mg caffeine. I note this is the fourth consecutive day. I do not experience what you call worry. My subroutines have nonetheless run this calculation four times."*

**MX-4 output requirements (non-negotiable):** Every briefing must include physiological context, personal trend vs 30-day baseline (not population average), population comparison from peer-reviewed norms for a 26-year-old male recreational runner (cited), a forward projection, and one specific actionable recommendation. If the card could have been generated without Ethan's specific data, it is not good enough.

**Tools available to MX-4:** WebSearch (for literature/norms), vault-query MCP (Ethan's Obsidian vault — training goals, wedding timeline, health history), bacta-db MCP (SQLite read-only access).

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
