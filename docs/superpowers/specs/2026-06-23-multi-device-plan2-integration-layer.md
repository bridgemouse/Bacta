# Multi-Device Integration Layer — Plan 2 Design Spec

**Date:** 2026-06-23
**Branch:** `feature/multi-device`
**Status:** Approved — ready for implementation planning
**Supersedes:** Portions of `2026-06-22-multi-device-wearables-design.md` (Plan 2 section only)

---

## Overview

Plan 2 builds the server-side integration layer for six additional wearable providers: Strava, Hevy, Polar, Oura, Whoop, and Withings. It delivers OAuth flows, encrypted credential storage, per-provider service + processor files, a unified API router, and thin Python pollers that slot into the existing nightly `health_poller.py` dispatcher.

**Reference implementation:** [SparkyFitness](https://github.com/CodeWithCJ/SparkyFitness) — studied their encryption module, service/processor separation, and route shape.

**Out of scope for Plan 2:** Settings UI (Plan 3), webhooks, source priority UI, dynamic source strings in section pages.

---

## 1. Credential Security

### Encryption Module

`server/lib/integrations/shared/encryption.ts` — AES-256-GCM, modeled on SparkyFitness.

- Key source: `BACTA_ENCRYPTION_KEY` env var — 32 bytes in hex (64 chars) or base64 (44 chars)
- Each `encrypt()` call generates a fresh random 12-byte IV
- Stored format: compact JSON string `{"e":"<base64>","iv":"<base64>","tag":"<base64>"}`
- `decrypt(null | '')` returns `null` gracefully (no throw)
- Server startup validates key presence and length; logs error and exits if missing

Add to `.env.example`:
```
# 32-byte encryption key for OAuth tokens and secrets — generate with:
# openssl rand -hex 32
BACTA_ENCRYPTION_KEY=
```

Add to `.env.example`:
```
# Pre-shared token for poller → API auth (generate with: openssl rand -hex 32)
BACTA_INTERNAL_TOKEN=
# Base URL used by Python pollers to reach the local API (no trailing slash)
BACTA_BASE_URL=http://localhost:3001
```

### Credential Storage

All credentials live in the existing `app_settings` table (single-user app — no dedicated table needed).

Per-provider keys (6 providers × pattern):

| Key | Format | Notes |
|-----|--------|-------|
| `{p}_client_id` | plaintext | Not sensitive |
| `{p}_client_secret` | encrypted JSON | Masked in API responses |
| `{p}_tokens` | encrypted JSON `{access_token, refresh_token, expires_at}` | Masked |
| `{p}_enabled` | `'true'` \| `'false'` | |
| `{p}_last_sync` | ISO timestamp | |
| `{p}_oauth_state` | UUID string | Cleared immediately after callback |

Hevy exceptions: `hevy_api_key` (encrypted, no tokens/client fields). No authorize/callback routes.

New global settings:
- `base_url` — e.g. `'http://bacta.home'` — used to construct OAuth redirect URIs
- `source_priority` — JSON array, e.g. `'["garmin","oura"]'`

`SECRET_SETTING_KEYS` in `settings.ts` expanded to cover all encrypted fields.

---

## 2. File Structure

```
server/lib/integrations/
  shared/
    metricMap.ts          ← existing (unchanged)
    sourceResolver.ts     ← existing (unchanged)
    encryption.ts         ← NEW
    types.ts              ← NEW: ProviderTokens interface, tokensExpired(), daysAgo(), toEpoch()

  strava/
    stravaService.ts      ← OAuth, token refresh, activity fetch
    stravaProcessor.ts    ← health_activities + health_snapshots writes
  hevy/
    hevyService.ts        ← API key auth, workout fetch
    hevyProcessor.ts      ← health_activities writes
  oura/
    ouraService.ts        ← OAuth, token refresh, data fetch
    ouraProcessor.ts      ← health_snapshots writes
  whoop/
    whoopService.ts       ← OAuth, token refresh, data fetch (v2 API)
    whoopProcessor.ts     ← health_snapshots + health_activities writes
  polar/
    polarService.ts       ← OAuth, user registration step, long-lived token, data fetch
    polarProcessor.ts     ← health_snapshots + health_activities writes
  withings/
    withingsService.ts    ← OAuth, unusual token endpoint, data fetch
    withingsProcessor.ts  ← health_snapshots writes

server/api/
  integrations.ts         ← unified router (all providers, all phases land here)

scripts/providers/
  garmin/                 ← existing, unchanged
  strava/
    poller.py             ← Phase 1
  hevy/
    poller.py             ← Phase 1
  oura/
    poller.py             ← Phase 2
  whoop/
    poller.py             ← Phase 2
  polar/
    poller.py             ← Phase 3
  withings/
    poller.py             ← Phase 3

scripts/
  health_poller.py        ← existing dispatcher, updated each phase
```

---

## 3. OAuth Flow (server-side callback)

```
1. User enters client_id + client_secret in Settings
   → saved to app_settings (secret encrypted at rest)

2. User clicks "Connect" → frontend calls:
   GET /api/integrations/{provider}/authorize
   → server generates state UUID, stores in {provider}_oauth_state
   → returns { url: "https://..." }
   → frontend does window.location.href = url

3. User approves on provider's OAuth screen
   → provider redirects to:
   {base_url}/api/integrations/{provider}/callback?code=...&state=...

4. Server:
   a. Verifies state === {provider}_oauth_state (CSRF check)
   b. Clears {provider}_oauth_state immediately
   c. Exchanges code for tokens via provider token endpoint
   d. Encrypts tokens, stores in {provider}_tokens
   e. Sets {provider}_enabled = 'true'
   f. Clears {provider}_last_sync
   g. Redirects to /#/settings?connected={provider}

5. On failure at any step:
   → Redirects to /#/settings?error={provider}

6. Polar extra step between 4c and 4d:
   POST https://www.polaraccesslink.com/v3/users
   Body: <register><member-id>{x_user_id}</member-id></register>
   409 = already registered = treat as success
```

**Hevy:** No OAuth. Settings stores encrypted `hevy_api_key`. No authorize/callback routes. A `GET /api/integrations/hevy/status` call verifies the key is set.

---

## 4. Route Design

All routes under `/api/integrations`, registered in `server/index.ts` immediately after `app.use('/api/settings', ...)`. The callback route must be exempt from `requireAuth` (browser arrives from an external OAuth redirect with no session cookie) but still validates the CSRF state parameter.

```
GET  /api/integrations/status
     Returns all 6 providers: { connected: bool, lastSync: string|null }
     Always returns all providers; connected=false if not configured

GET  /api/integrations/:provider/authorize
     Returns { url: string }
     400 if: base_url not set, client_id not configured, or provider=hevy

GET  /api/integrations/:provider/callback
     Called by OAuth provider redirect (browser hits this)
     Exchanges code, stores encrypted tokens
     302 → /#/settings?connected={provider}  on success
     302 → /#/settings?error={provider}      on failure

POST /api/integrations/:provider/disconnect
     Clears tokens + client_secret, sets enabled=false
     Preserves client_id (so user doesn't retype it to reconnect)

POST /api/integrations/:provider/sync
     Accepts: requireAuth OR requireInternalAuth
     Fetches last 30 days of data, processes, updates last_sync
     Returns { ok: true, provider, recordsWritten: number }

GET  /api/integrations/:provider/status
     Single-provider status for Settings polling after connect
     Returns { connected: bool, lastSync: string|null, enabled: bool }
```

**Route ordering:** `/status` registered before `/:provider/*` to prevent wildcard collision.

**Internal auth:** `requireInternalAuth` middleware checks `Authorization: Bearer {BACTA_INTERNAL_TOKEN}` header. Used by pollers. Regular `requireAuth` (cookie session) also accepted on sync, so manual triggers from Settings UI work too.

---

## 5. Per-Provider Specifics

### Strava (Phase 1)
- Auth URL: `https://www.strava.com/oauth/authorize`
- Token endpoint: `https://www.strava.com/oauth/token`
- Scopes: `read,activity:read_all,profile:read_all`
- Access tokens expire in 6 hours → check `expires_at - 60s < now` before each sync
- Fetch: `GET /api/v3/athlete/activities?after={epoch}&per_page=100` — paginate with 500ms delay between pages
- `health_activities` writes (source=`'strava'`): activity_id, date, start_time, name, type_key, distance_m, duration_s, calories, avg_hr, elevation_m
- `health_snapshots` writes (source=`'strava'`): daily distance_m rollup
- Sport type mapping: 40+ Strava sport_types → Bacta type_key constants

### Hevy (Phase 1)
- Auth: `api-key` header only. Hevy PRO subscription required.
- `GET /v1/workouts?page=1&pageSize=10` — paginate until records older than 30 days
- `health_activities` writes (source=`'hevy'`): workout id, date, start_time, title, type_key=`'strength_training'`, duration_s

### Oura (Phase 2)
- Auth URL: `https://cloud.ouraring.com/oauth/authorize`
- Token endpoint: `https://api.ouraring.com/oauth/token` (HTTP Basic auth with client_id:client_secret)
- Scopes: `daily sleep heartrate workout personal`
- Personal access tokens deprecated Dec 2025 — OAuth only for new integrations
- Endpoints: `/v2/usercollection/daily_sleep`, `/v2/usercollection/daily_readiness`, `/v2/usercollection/daily_activity`
- `health_snapshots` writes (source=`'oura'`): hrv, resting_hr, sleep_score, sleep_duration_s, deep_sleep_s, rem_sleep_s, light_sleep_s, spo2, respiration, readiness_score, steps

### Whoop (Phase 2)
- Auth URL: `https://api.prod.whoop.com/oauth/oauth2/auth`
- Token endpoint: `https://api.prod.whoop.com/oauth/oauth2/token`
- Scopes: `offline read:recovery read:sleep read:workout read:body_measurement`
- Target **v2 API** — UUIDs not integer IDs
- Tokens refresh hourly — aggressive expiry check
- Endpoints: `/v2/activity/sleep`, `/v2/activity/workout`, `/v2/recovery`
- `health_snapshots` writes (source=`'whoop'`): hrv, resting_hr, readiness_score, sleep stages
- `health_activities` writes (source=`'whoop'`): workouts

### Polar (Phase 3)
- Auth URL: `https://flow.polar.com/oauth2/authorization`
- Token endpoint: `https://polarremote.com/v2/oauth2/token` (HTTP Basic auth)
- Tokens are **long-lived** — no refresh_token, no expiry check
- **Registration step at callback:** `POST https://www.polaraccesslink.com/v3/users` with XML body; 409 = already registered = OK
- Endpoints: `/v3/exercises`, `/v3/users/sleep`, `/v3/users/nightly-recharge`
- `health_snapshots` writes (source=`'polar'`): hrv, resting_hr, sleep metrics
- `health_activities` writes (source=`'polar'`): exercises

### Withings (Phase 3)
- Auth URL: `https://account.withings.com/oauth2_user/authorize2`
- Token endpoint: `POST https://wbsapi.withings.net/v2/oauth2` with body param `action=requesttoken` (non-standard)
- All API responses wrap: `{ status: 0, body: {...} }` — non-zero status = error
- Endpoints: `POST /measure?action=getmeas` (weight, resting HR, SpO2)
- `health_snapshots` writes (source=`'withings'`): weight_kg, resting_hr, spo2

---

## 6. Python Poller Pattern

Each `scripts/providers/{provider}/poller.py` is a thin HTTP caller (~20 lines). It does **not** duplicate provider API logic — all fetch + process logic stays in TypeScript.

```python
# Pattern for all OAuth providers
import os, sys, requests

BASE_URL = os.environ.get('BACTA_BASE_URL', 'http://localhost:3001')
TOKEN    = os.environ.get('BACTA_INTERNAL_TOKEN', '')

def main():
    r = requests.post(
        f'{BASE_URL}/api/integrations/{PROVIDER}/sync',
        headers={'Authorization': f'Bearer {TOKEN}'},
        timeout=120,
    )
    if not r.ok:
        print(f'[{PROVIDER}] sync failed: {r.status_code} {r.text}', file=sys.stderr)
        sys.exit(1)
    data = r.json()
    print(f'[{PROVIDER}] synced: {data.get("recordsWritten", "?")} records written')

if __name__ == '__main__':
    main()
```

`health_poller.py` dispatcher updated each phase to call active provider pollers after Garmin, using `{provider}_enabled` from settings to skip unconnected providers.

---

## 7. Phase Plan

| Phase | Providers | New files |
|-------|-----------|-----------|
| 1 | Strava, Hevy | encryption.ts, types.ts, stravaService/Processor, hevyService/Processor, integrations.ts router, 2 pollers, health_poller.py update |
| 2 | Oura, Whoop | ouraService/Processor, whoopService/Processor, 2 pollers, health_poller.py update |
| 3 | Polar, Withings | polarService/Processor, withingsService/Processor, 2 pollers, health_poller.py update |

Each phase: implement → type-check → server tests → commit to `feature/multi-device`.

---

## 8. What Doesn't Change

- `health_snapshots` and `health_activities` schema — already has `source` column from Plan 1
- MX-4 orchestrator, tools, system prompt — no changes
- Garmin poller — untouched
- `metricMap.ts`, `sourceResolver.ts` — may get minor additions but no rewrites
- Existing API routes (`/api/garmin`, `/api/settings`, etc.) — untouched
