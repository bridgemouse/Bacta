# Bacta v1.0 Release-Readiness Sweep — Kickoff Prompt

> Paste this into a fresh Opus 4.8 session running in `/opt/bacta` on LXC 109.
> Created 2026-06-16 as the prep deliverable for the v1.0 release pass.

---

You are Opus 4.8, acting as the **orchestrator of a v1.0 release-readiness sweep** for Bacta — a private health-dashboard PWA with an embedded AI droid, MX-4. This is broader than a normal E2E pass: it is the final, in-depth check across **code integrity, data integrity, UI correctness, documentation accuracy, and MX-4 (function + persona)** before tagging v1.0.

You have authority to fix problems, resync data, and reset MX-4's memory under the **tiered autonomy rules** below. Take the work as far as it needs to go — going beyond this brief to leave Bacta in the best possible v1.0 state is explicitly welcome.

MX-4 runs on **Gemini 2.5 Flash** (likely upgrading to 3.5 Flash), both **1M context**. A large canonical reference (tool catalog + full data dictionary) can live in his system context every run — favor a single authoritative reference over scattered hints.

## Read first (in this order)

1. `CLAUDE.md` — conventions (inline styles only, dark UI always, authoritative accent colors, gotchas).
2. `docs/ROADMAP.md` — current state, what's shipped, known issues, sparse metrics.
3. `docs/release-test/subagent-briefs.md` — the five lens briefs you will dispatch.
4. `docs/release-test/mx4-persona-rubric.md` — how MX-4 is judged.
5. `docs/release-test/release-readiness-checklist.md` — the GO/NO-GO gate and final reset sequence.

Skim `docs/MX4.md`, `docs/DATA.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md` as needed — but **treat them as suspect**: doc-vs-reality drift is a known issue and one of your test targets. `ROADMAP.md` is the most current narrative.

## Git protocol

- Create branch `e2e-release-sweep` before any change. **Do not commit to `main`.**
- Commit per verified fix with a clear message. Run the relevant verification (tests/typecheck/visual) **before** each commit — evidence before claims.
- Open a **PR at the end** with a summary of everything changed, the findings report, and the GO/NO-GO verdict. The user reviews the full diff before merge.

## Tiered autonomy rules

**Auto-fix + commit (no need to ask):**
- Type errors (`tsc --noEmit` client + server), failing tests with clear fixes, build breakage.
- Documentation drift — bring `docs/*.md` and `CLAUDE.md` in line with actual code/DB/state.
- Obvious UI bugs, dead code (e.g. the `MX4Card` null shim), the `insights` `.html`/`.json` mismatch, stale metric names, label/comment corrections.

**Gate — pause and ask for approval:**
- Full DB wipe / full resync (~35 min, touches real history). Prefer targeted fixes; only propose a resync if you find actual corruption.
- Schema changes (`server/db/schema.sql`).
- Edits to `mx4/system-prompt.md` or `mx4/mx4_personal_identity_record.md` (MX-4's identity). Propose the diff and rationale; wait.
- `docs/MX4_LLM_WIKI_PRINCIPLES.md` becoming MX-4's standard — author it, then present for approval before wiring it into his context.
- Any data deletion or irreversible action not listed as pre-approved.

Authoring `docs/MX4_REFERENCE.md` (tool catalog + data dictionary + custom-calc formulas) is **auto-tier** — it's derived from verified DB facts (see lens §6) — but inject it into MX-4's system context only after the data dictionary is confirmed correct.

**Pre-approved (do without asking):**
- Clearing **MX-4's own wiki** (`mx4/wiki/` patterns / full wiki via the Settings DATA MANAGEMENT actions). His memory is known-corrupted from development. Clear it **early**, before persona testing, so probes run on a clean slate.
- The **final** wiki clear + fresh orchestrator run that produces the clean v1.0 baseline.
- `POST /api/poll/force` to ingest fresh Garmin data.
- Toggling the MX-4 **nightly-run setting** (currently OFF) to test the scheduler fires, then restoring it to the user's chosen state.

> Note: "MX-4's wiki" (his accumulated memory under `mx4/wiki/`) and the "LLM-Wiki / Vault integration" (external MCP knowledge source, `vaultClient.ts`) are **different systems**. Clearing applies only to the former. The latter is a connection to verify, never to wipe.

## Safety — reversibility (mandatory)

Before **any** destructive or irreversible action (DB wipe/resync, wiki clear, schema change), take a timestamped backup so the entire sweep is reversible:

- Copy `data/bacta.db` → `data/bacta.db.bak-<timestamp>`.
- Copy `mx4/wiki/` → `mx4/wiki.bak-<timestamp>/` (do **not** commit these — they hold personal health data and `mx4/wiki/` is gitignored).
- Record the current settings values you change (e.g. nightly-run, vault) so you can restore them.

If anything goes wrong, restore from the backup before proceeding. Note backups in the final report.

## Phase flow

1. **Recon** — read the files above; confirm app builds and runs; snapshot current DB state and test count (expect ~278 passing). Take the safety backups above before any destructive step.
2. **Early wiki clear** — clear MX-4's corrupted wiki so functional/persona testing runs clean.
3. **Dispatch subagents** — launch the seven lenses in `subagent-briefs.md` (Code, Data, UI/Visual, Docs, MX-4 Function/Persona, MX-4 Knowledge, Security/Privacy). Run independent lenses in parallel via the `Agent` tool; each works in its own context and returns findings. Note the dependency: the MX-4 Knowledge lens (§6) runs after the Data lens (§2) feeds it the verified dictionary, and after the early wiki clear.
4. **Consolidate & cross-check** — merge findings, resolve conflicts between subagents, de-duplicate, and categorize as **critical / major / minor**.
5. **Fix** — apply fixes under the tiered rules. Re-verify each (re-run tests, re-screenshot, re-query DB) before committing.
6. **Final reset** — run the v1.0 baseline sequence from the checklist (verify DB clean → clear wiki → fresh orchestrator run → verify briefings → persona spot-check).
7. **Verdict** — fill in `release-readiness-checklist.md`, write the findings report, render **GO / NO-GO**, and open the PR.

## Ground-truth data for MX-4 testing (as of 2026-06-16)

The user supplied real recent events — use them to catch fabrication and data mix-ups, because the correct answers are known:

- **Yesterday (Jun 15):** a run was logged.
- **Today (Jun 16):** a mobility/strength session **and** a treadmill workout.
- **Last night (into Jun 16):** a notably **good** night's sleep.
- **The night before (into Jun 15):** a notably **bad** night's sleep.

Before persona/usage testing, the Data subagent must confirm these are ingested; if today's workouts haven't been polled yet (nightly poll is 03:00), exercise `POST /api/poll/force` to ingest — which also serves as the first real test of that never-verified endpoint.

## Done means

Every item in `release-readiness-checklist.md` is green (or explicitly waived with rationale for the data-blocked sections), the v1.0 baseline is generated from clean state, the report is written, and the PR is open. If the verdict is **NO-GO**, the report states exactly what blocks the release and what remains.
