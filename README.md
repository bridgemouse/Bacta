# Bacta

A self-hosted health dashboard and AI companion. Pulls biometrics nightly from your fitness tracker. An AI droid named **MX-4** narrates the data, writes briefings, and is available for live chat.

Built as a dark sci-fi instrument console — not a health app, not a wellness product. Installable as a PWA on mobile.

Currently wired for **Garmin Connect**. Built to expand to other fitness integrations.

---

## MX-4

MX-4 is a Star Wars-themed AI companion — specifically a Cybot Galactica MX-series multi-system interface droid *(yes, Cybot Galactica makes protocol droids in canon — we took liberties)*, built to see across domains and surface what matters. He runs a nightly briefing pipeline, maintains a structured health wiki, and is available via live chat with real-time tool visibility.

He does not serve. He collaborates.

The AI backend is provider-agnostic (Google, Anthropic, OpenAI) — configured in settings.

**Changing the persona:** MX-4's character is defined in two markdown files: `mx4/system-prompt.md` (voice, output format, behavior rules) and `mx4/mx4_personal_identity_record.md` (canonical identity). Edit those to swap in a different character without touching any code. `mx4/HEARTBEAT.md` (gitignored, template at `mx4/HEARTBEAT.md.example`) holds standing orders injected on every run — use it for user-specific behavioral overrides.

---

## Sections

| Section | Status |
|---|---|
| Home | Live — cross-channel synthesis briefing + trend overview |
| Recovery | Live — HRV, body battery, RHR, stress, SpO2, respiration |
| Sleep | Live — sleep score, stage depth, SpO2, sleep stress |
| Training | Live — training load, VO2max, fitness age, zones, activity log |
| Nutrition | Roadmap — custom nutrition tracking (in development) |
| Blood Work | Roadmap — lab result import planned |
| Daily Log | Roadmap — manual input UI planned |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Database | SQLite via `better-sqlite3` |
| AI | Vercel AI SDK (Google, Anthropic, OpenAI) |
| Tests | Vitest + Testing Library |
| CI | GitHub Actions |
| Data | Garmin Connect nightly poller via `garth` |

---

## Self-Hosting

Bacta runs on a single Linux host (tested on Debian 13). Docker support is on the roadmap — for now, setup is manual.

Requirements:
- Node.js 20+
- Python 3.10+ (for the Garmin poller)
- A Garmin Connect account
- An API key for at least one AI provider (Google Gemini, Anthropic, or OpenAI)

Setup guide coming soon. The poller and ingest scripts are in `scripts/`, the data schema is in `server/db/schema.sql`, and the AI provider is configured in the app's Settings page at runtime.

---

## Roadmap

The next milestones are the three placeholder sections. Nutrition is the largest — a custom-built nutrition tracker, not a third-party integration. Blood Work and Daily Log follow. Contributions expanding device support beyond Garmin are welcome.
