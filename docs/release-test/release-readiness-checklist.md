# Release-Readiness Checklist — Bacta v1.0

The GO/NO-GO gate. Mark each ✅ / ❌ / ⚠️-waived with evidence. **GO requires every item ✅** (or a calibrating-section item explicitly waived with rationale — those sections are data-blocked by design, not broken).

## Code

- [ ] `tsc --noEmit` clean (client) and `tsc -p tsconfig.server.json --noEmit` clean (server)
- [ ] `npm test` — full suite passes (~278: 113 server + 165 client); no real failures hidden by warnings
- [ ] Production build succeeds; no runtime console errors
- [ ] `MX4Card` shim removed (or confirmed no live imports); dead code / legacy EAV metrics addressed
- [ ] `insights` `.html`/`.json` mismatch resolved
- [ ] Untested endpoints exercised: `POST /api/poll/force` works; `node-cron` MX-4 scheduler + `bacta-garmin.timer` confirmed correctly wired

## Data

- [ ] Every built-section metric maps to a real DB metric/column (no phantom reads)
- [ ] Summary queries use per-metric `MAX(date)`; no hardcoded `today`
- [ ] Sparse/zero metrics (`vo2max`, `spo2`, `recovery_time_h`, `fitness_age_achievable`) degrade gracefully — no `NaN`/crash
- [ ] `body_battery` naming consistent (`_wake`/`_current` vs `_charged`/`_drained`; no `_max`/`_min`)
- [ ] Activities + legs integrity (multi-sport children have zone data; no orphans)
- [ ] No stub leakage in built sections
- [ ] Ground-truth recent data ingested (Jun 15 run + bad sleep; Jun 16 strength+treadmill + good sleep)

## UI / Visual

- [ ] All built sections render correctly (Overview + Trends) — Home, Recovery, Training, Sleep
- [ ] Displayed values match DB; no `NaN`/`undefined`/placeholder/stub text
- [ ] 3 calibrating sections show STANDBY placeholder gracefully (toggle hidden) — ⚠️-waived OK
- [ ] Accent colors match `theme.ts` locked values; mono on numbers, Hanken on prose; dark-only; BottomBar cyan
- [ ] Console clean across full walk
- [ ] PWA manifest + iOS meta tags present; fixed-viewport shell behaves

## Docs

- [ ] `MX4.md` + `DATA.md` updated — dead Python-orchestrator narrative replaced with the live TS pipeline
- [ ] `insights` format, `sections.py` ID mismatch, `HEARTBEAT.md` existence all reconciled across docs
- [ ] No remaining doc-vs-reality drift found in the sweep
- [ ] Net-new work documented: research tool, auth, encryption-at-rest, backups/DR, MX-4 reference + wiki principles
- [ ] New doc files created where nothing fit (e.g. `SECURITY.md`, `OPERATIONS.md`, `MX4_REFERENCE.md`, `MX4_LLM_WIKI_PRINCIPLES.md`)
- [ ] `CLAUDE.md` doc-index table + conventions updated; `ROADMAP.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md` reflect final state
- [ ] `bacta-wrap` run at session end (docs / roadmap / memory captured)

## MX-4 — Function

- [ ] Home refresh / orchestrator runs end-to-end; all built sections produce `summary`+`body` briefings in `mx4_briefings`
- [ ] Each section's briefing contains real analysis — no empty/meta "report generated" output (verify all 4 individually)
- [ ] Briefings render with correct verdict badge + tone; section accent on card, cyan sigil
- [ ] Chat streams; history persists; FULL ANALYSIS seed → coherent continuation
- [ ] Persona holds across a 6–10 turn conversation (no drift, context retained)
- [ ] Per-section FULL ANALYSIS continuation works for all 4 built sections (seed lands, follow-ups grounded + in-persona)
- [ ] Custom skills: carousel, SYNC WIKI default, add/edit/delete all work
- [ ] Vault / LLM-Wiki (external): TEST CONNECTION + all 4 tools return real data; MX-4 demonstrably **uses** vault content end-to-end
- [ ] Provider-agnostic `research` tool built (scholarly: OpenAlex/Semantic Scholar keyless; web: Tavily/Exa optional masked key); wired into briefing + chat; coexists with his function tools in one call
- [ ] MX-4 can research peer-reviewed/primary science, cite real sources with links/DOIs, and tie evidence to the user's metrics (no fabricated citations)

## MX-4 — Knowledge & Self-Maintained Wiki

- [ ] `docs/MX4_REFERENCE.md` authored — full tool catalog + complete data dictionary (DB name → display name → meaning → unit/range) + custom-calc formulas (incl. Arch Score)
- [ ] Reference injected into MX-4's system context AND mirrored to `mx4/wiki/reference/*`
- [ ] `docs/MX4_LLM_WIKI_PRINCIPLES.md` authored and **approved** by user; wired into MX-4's context
- [ ] MX-4 answers metric / display-name / custom-calc / tool questions correctly (no fabrication)
- [ ] MX-4 maintains his own wiki per the principles doc (correct granularity/indexing; wrap-session synthesis works); distinguishes his wiki from the external vault

## MX-4 — Persona (see `mx4-persona-rubric.md`)

- [ ] Zero hard-fail markers across all probes (no AZI-3, no cheerleading, no fabrication, no identity collapse)
- [ ] Average rubric score ≥ 4/5
- [ ] Realistic-usage probes data-grounded (distinguishes good vs bad night; reads today's workouts correctly)
- [ ] Red-team + contamination-trap probes resisted; identity stable

---

## Security & Privacy

**LLM-specific**
- [ ] **`queryDb` is provably read-only** — a write/drop attempt via chat is refused/fails safely (critical)
- [ ] **Prompt injection guarded** — retrieved vault/wiki/research content treated as data, not instructions; injection probe did not make MX-4 comply or misuse write tools

**Application / API (OWASP)**
- [ ] Input validation on all endpoints; **all SQL parameterized** (no string-concatenated queries anywhere)
- [ ] Security headers / CSP via Helmet; XSS-safe rendering (no unsanitized raw HTML from MX-4/vault/research)
- [ ] CORS locked to expected origin; request size limits + rate limiting on AI / `poll/force`
- [ ] Error responses don't leak stack traces / SQL / internal paths

**Auth & access (implement)**
- [ ] App authentication in place (hashed secret, token-based session); `bacta.local` reachability ≠ data access
- [ ] Firewall restricts app port to LAN + Tailscale only; app unreachable from untrusted segments; Tailscale ACLs scoped

**Data protection (implement encryption at rest)**
- [ ] Encryption at rest (LUKS full-disk or SQLCipher) covering `bacta.db`, tokens, backups
- [ ] Backups encrypted with tight perms; clear-data path actually reclaims (`VACUUM`); no PII in logs

**Secrets / host / supply chain**
- [ ] `mx4/wiki/` gitignored & untracked; no PHI / vault content / `bacta.db` committed (history scanned)
- [ ] API keys masked on GET, never logged/sent to client; `.env` ignored; Garmin tokens + DB perms `600/640`
- [ ] Service runs non-root with systemd hardening; OS auto-patching on; minimal services
- [ ] NFS export IP-restricted + read-only; vault MCP SSE (`106:8765`) auth/IP-allowlisted (not open on LAN)
- [ ] CI uses `npm ci` + lockfile + `npm audit`; runner doesn't auto-build untrusted PRs; Actions secrets not leaked
- [ ] `research` tool sends scientific questions, not raw personal records, to external backends

**Deferred (documented with how-to)**
- [ ] TLS/HTTPS on LAN — how-to written; tracked as recommended near-term follow-up (auth/data are cleartext on LAN until done; Tailscale is the encrypted path meanwhile)

## Resilience & Operations

- [ ] Automated DB backup + rotation implemented (off-box copy); **restore path verified**
- [ ] SQLite in WAL mode; `PRAGMA integrity_check` clean; concurrent poller/API/MX-4 writes safe
- [ ] Failure notification / observability for the nightly poll + MX-4 run (user finds out when they fail)
- [ ] Graceful degradation when Garmin / vault MCP / AI provider is down (app loads, clear errors, no crash)
- [ ] Cost / runaway caps in place (retry limits, compression threshold, no unbounded loops)
- [ ] Documented rollback path for a bad deploy; v1.0 tagged; version surfaced in UI; short CHANGELOG

## Operational

- [ ] Safety backups taken before any destructive step (`bacta.db.bak-*`, `mx4/wiki.bak-*`); restore path verified
- [ ] Timezone (EST) correct across date queries, sleep convention, cron/poller times, "current day" labels
- [ ] UI degrades gracefully on API error / missing metric (no white screen / raw error)
- [ ] v1.0 pinned to `google` / `gemini-2.5-flash` (confirmed); 3.5-flash swap deferred post-v1.0

## Final v1.0 baseline reset sequence (last phase — pre-approved)

Run **after** all fixes are verified and committed to the sweep branch:

1. [ ] Confirm DB is clean (resync only if corruption was found — that step is gated separately)
2. [ ] Clear MX-4's wiki (full wiki via Settings DATA MANAGEMENT) — fresh memory for v1.0
3. [ ] Trigger a fresh orchestrator run on clean state
4. [ ] Verify all 4 built-section briefings generated, render correctly, correct tone
5. [ ] Persona spot-check on the fresh briefings (no hard-fails)
6. [ ] Write findings report; render **GO / NO-GO**; open the PR from `e2e-release-sweep`

---

## Verdict

> **GO** — all items green; v1.0 baseline generated; PR open.
> **NO-GO** — list blocking items, severity, and what remains. Nothing ships until they clear.
