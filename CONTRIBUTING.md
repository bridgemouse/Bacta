# Contributing to Bacta

Contributions are welcome, especially around additional fitness device integrations and the two pending sections (Blood Work, Daily Log). Nutrition has shipped as a full custom-built tracker — polish and follow-on contributions there are still welcome, check open issues first.

## Before You Start

Open an issue first to discuss what you want to build. This avoids duplicate effort and lets us align on approach before you write code.

## Ground Rules

**UI conventions (non-negotiable):**
- Inline styles only — no CSS files, no Tailwind, no CSS modules in components
- Dark UI always — never propose or implement light mode
- Numbers and labels use `JetBrains Mono`; prose uses `Hanken Grotesk`
- Colors come from `client/src/theme.ts` — do not hardcode hex values

**Code conventions:**
- No comments unless the WHY is genuinely non-obvious
- No light wrappers, helpers, or abstractions beyond what the task requires
- `INSERT OR REPLACE` for idempotent `health_snapshots`/`health_activities` writes
- Validate only at system boundaries (user input, external APIs)

## Process

1. Fork the repo and create a branch from `main`
2. Write tests for any new behavior — the test suite must stay green
3. Run `npm test` and `npx tsc --noEmit` (client) and `npx tsc -p tsconfig.server.json --noEmit` (server) before pushing
4. Open a PR — all PRs require maintainer review and CI passing before merge

## What's in Scope

- New fitness data integrations (Wahoo, Apple Health, Google Health Connect, etc. — Garmin, Strava, Hevy, Oura, Whoop, Polar, and Withings are already integrated)
- Blood Work and Daily Log sections (coordinate on data model first)
- Nutrition polish and follow-on work — the core tracker (custom food/variant model, USDA import, logging UI) has shipped; check open issues before contributing here
- Performance, accessibility, or reliability improvements
- Bug fixes

## What's Out of Scope

- Light mode
- Cloud deployment or SaaS features — Bacta is intentionally self-hosted
- Removing or replacing MX-4 — he's the product. If you want a different persona, edit `mx4/system-prompt.md` and `mx4/mx4_personal_identity_record.md` in your own fork; that's the intended customization path
