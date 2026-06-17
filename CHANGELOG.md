# Changelog

## v1.0.0 — 2026-06-17

First tagged release. Private health-dashboard PWA for one user, with the MX-4
AI companion. Sealed by the v1.0 release-readiness sweep.

### Security
- App authentication: numeric PIN (scrypt-hashed) → HMAC session token; auth gate
  on all data/AI/settings routes (health + auth exempt); login rate limiting.
- `queryDb` (LLM-driven SQL) hard-locked read-only (engine-level read-only
  connection + statement guards).
- Prompt-injection defense: retrieved wiki/vault/research content framed as
  untrusted data; write tools cannot be steered by retrieved text.
- helmet + CSP, input validation/whitelisting on settings, request size limit,
  rate limiting, generic error responses (no stack/SQL leakage).
- PHI untracked from git (`mx4/wiki/`, `HEARTBEAT.md`); DB/backups perms `600`.

### MX-4
- Provider-agnostic `research` tool (keyless OpenAlex scholarly + optional
  Tavily/Exa web), wired into briefings and chat.
- Canonical `docs/MX4_REFERENCE.md` (tool catalog + data dictionary + custom
  calcs) injected into MX-4's system context.

### Data & reliability
- Fixed `recovery_time_h` unit (stored in minutes, was labeled hours).
- Removed legacy EAV activity metrics; NULLed corrupt negative historical rows;
  backfilled multi-sport activity legs.
- DB backup script with restore verification + rotation; failure notifications
  for the nightly poll and MX-4 run; `busy_timeout` on all DB connections;
  in-flight lock on orchestrator runs.

See `docs/release-test/findings-*.md` for the full sweep report.
