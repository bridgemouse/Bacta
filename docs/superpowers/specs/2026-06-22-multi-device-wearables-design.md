# Multi-Device Wearables Integration — Design Spec

**Date:** 2026-06-22  
**Branch:** `feature/multi-device`  
**Status:** Approved — ready for implementation planning

---

## Overview

Bacta currently only works with Garmin. This feature expands the data pipeline to support six additional wearable providers (Polar, Oura, Whoop, Withings, Strava, Hevy) using direct per-provider integrations — the same pattern used by SparkyFitness. Garmin remains unchanged. All providers write to a shared normalized schema. MX-4 requires no changes.

**Out of scope:**
- Fitbit — legacy Web API deprecated September 2026, no viable web successor
- Google Health Connect — Android SDK only, not accessible from a web app
- Apple Health — iOS SDK only; deferred to native app
- Open Wearables — deferred as an optional power-user path, not a v1 dependency

---

## 1. Data Layer

### Schema Migration

`garmin_snapshots` → `health_snapshots`. Migration runs on server startup via the existing `initSettings()` pattern. All existing data gets `source = 'garmin'` via the column DEFAULT. No data loss, no manual steps.

```sql
-- health_snapshots (was garmin_snapshots)
CREATE TABLE health_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  metric      TEXT NOT NULL,
  value       REAL,
  unit        TEXT,
  source      TEXT NOT NULL DEFAULT 'garmin',
  source_json TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, metric, source)
);
```

`UNIQUE(date, metric, source)` allows multiple providers to report the same metric on the same day without collision. The source priority layer (see Section 8) selects which value consumers see.

### Activities Tables

```sql
-- health_activities (was garmin_activities)
-- activity_id becomes TEXT to accommodate non-integer provider IDs
-- source column added, defaults to 'garmin'
ALTER TABLE garmin_activities RENAME TO health_activities;
ALTER TABLE health_activities ADD COLUMN source TEXT NOT NULL DEFAULT 'garmin';

-- health_activity_legs (was garmin_activity_legs)
ALTER TABLE garmin_activity_legs RENAME TO health_activity_legs;
```

### Backward Compatibility

Every existing query, API endpoint, MX-4 tool call, and hook continues to work without modification. The `source` column is additive. `SELECT DISTINCT metric FROM health_snapshots` still works for discovery. MX-4 never needs to know which device provided a value unless explicitly asked.

---

## 2. File Structure

All providers live under a unified directory tree. Garmin is relocated (code unchanged, paths updated).

```
scripts/
  providers/
    garmin/
      poller.py         ← was scripts/garmin_poller.py (moved only)
      ingest.py         ← was scripts/garmin_ingest.py (moved only)
    polar/
      poller.py
    oura/
      poller.py
    whoop/
      poller.py
    withings/
      poller.py
    strava/
      poller.py
    hevy/
      poller.py
  health_poller.py      ← dispatcher: reads active providers from app_settings, calls each

server/lib/integrations/
  garmin/
    garminService.ts    ← existing garmin server code relocated
    garminProcessor.ts  ← normalization (formalizes existing implicit mapping)
  polar/
    polarService.ts     ← OAuth flow, token refresh
    polarProcessor.ts   ← normalize Polar API response → health_snapshots metric names
  oura/
    ouraService.ts
    ouraProcessor.ts
  whoop/
    whoopService.ts
    whoopProcessor.ts
  withings/
    withingsService.ts
    withingsProcessor.ts
  strava/
    stravaService.ts
    stravaProcessor.ts
  hevy/
    hevyService.ts
    hevyProcessor.ts
  shared/
    metricMap.ts        ← canonical metric names, per-provider method descriptions, PROVIDER_LABELS
    sourceResolver.ts   ← resolveSource() utility used by all API routes
```

### Systemd Timer

`bacta-garmin.timer` → `bacta-health.timer` (operator step). `ExecStart` updated to call `scripts/health_poller.py`, which dispatches to each active provider's poller. The nightly schedule (3AM) is unchanged.

---

## 3. Provider Abstraction Pattern

Each provider is two files following the SparkyFitness pattern:

**`XxxService.ts`** — handles OAuth authorization URL construction, token exchange, token refresh, and raw API calls. Reads/writes credentials from `app_settings`.

**`XxxProcessor.ts`** — receives raw API response, maps fields to canonical Bacta metric names, and writes to `health_snapshots` via the DB. Uses `metricMap.ts` for canonical names.

**`XxxPoller.py`** — Python script that authenticates with the provider, fetches data for the configured date range, and POSTs normalized data to a local Bacta API endpoint for processing.

### Metric Name Registry (`metricMap.ts`)

All providers map to the same canonical metric names that MX-4 already knows:

```ts
export const METRICS = {
  hrv:              { unit: 'ms',    description: 'HRV (RMSSD)' },
  resting_hr:       { unit: 'bpm',   description: 'Resting heart rate' },
  sleep_score:      { unit: 'score', description: 'Sleep quality score (0–100)' },
  sleep_duration_s: { unit: 's',     description: 'Total sleep duration' },
  deep_sleep_s:     { unit: 's',     description: 'Deep sleep duration' },
  rem_sleep_s:      { unit: 's',     description: 'REM sleep duration' },
  light_sleep_s:    { unit: 's',     description: 'Light sleep duration' },
  spo2:             { unit: '%',     description: 'Blood oxygen saturation' },
  respiration:      { unit: 'brpm',  description: 'Breathing rate' },
  stress:           { unit: 'score', description: 'Stress score' },
  steps:            { unit: 'count', description: 'Daily steps' },
  vo2max:           { unit: 'ml/kg/min', description: 'VO2 max estimate' },
  body_battery_charged: { unit: 'points', description: 'Body battery charged' },
  readiness_score:  { unit: 'score', description: 'Readiness score (Oura/Whoop)' },
  strain_score:     { unit: 'score', description: 'Strain score (Whoop)' },
  // ... extended as new providers are onboarded
}

// Per-provider method descriptions for InfoOverlay source strings
export const METRIC_SOURCES: Record<string, Record<string, string>> = {
  garmin:   { hrv: 'overnight RMSSD', resting_hr: 'sleep detection', sleep_score: 'accelerometer + HRV', spo2: 'optical sensor' },
  oura:     { hrv: 'infrared PPG', resting_hr: 'sleep detection', sleep_score: 'sleep algorithm', spo2: 'infrared + red LED' },
  polar:    { hrv: 'overnight RMSSD', resting_hr: 'sleep detection', sleep_score: 'sleep algorithm' },
  whoop:    { hrv: 'overnight RMSSD', resting_hr: 'sleep detection', strain_score: 'HR + exertion model' },
  withings: { resting_hr: 'optical HR', spo2: 'optical sensor' },
  strava:   { steps: 'GPS + accelerometer' },
  hevy:     { /* strength metrics */ },
}

export const PROVIDER_LABELS: Record<string, string> = {
  garmin:   'Garmin',
  oura:     'Oura Ring',
  polar:    'Polar',
  whoop:    'Whoop',
  withings: 'Withings',
  strava:   'Strava',
  hevy:     'Hevy',
}
```

---

## 4. OAuth Flow & Credential Storage

### Auth Patterns

| Provider | Auth Method |
|----------|-------------|
| Garmin   | Email/password via `~/.garminconnect` (unchanged) |
| Polar    | OAuth 2.0 — user registers free developer app at flow.polar.com |
| Oura     | OAuth 2.0 — user registers free developer app at cloud.ouraring.com |
| Whoop    | OAuth 2.0 — user registers at developer.whoop.com |
| Withings | OAuth 2.0 — user registers at developer.withings.com |
| Strava   | OAuth 2.0 — user registers at strava.com/settings/api |
| Hevy     | API key — user generates in Hevy app settings |

### OAuth Flow

```
User enters client_id + client_secret in Settings → CONNECTED DEVICES
  ↓
[Connect] → GET /api/integrations/:provider/authorize
  ↓
Server builds authorization URL with PKCE state, stores state in app_settings
  ↓
Browser redirects to provider OAuth screen
  ↓
User approves → provider redirects to {base_url}/api/integrations/:provider/callback
  ↓
Server exchanges code for access_token + refresh_token
  ↓
Tokens stored encrypted in app_settings
  ↓
Settings card shows "Connected ✓" + last-sync timestamp
```

Token refresh happens automatically at poll time. Refresh tokens are written back to `app_settings` after each refresh.

### Credential Storage Keys

All per-provider entries in `app_settings`:

```
{provider}_client_id      TEXT    — plaintext (not sensitive)
{provider}_client_secret  TEXT    — encrypted (AES-256, same as AI API keys)
{provider}_tokens         TEXT    — encrypted JSON { access_token, refresh_token, expires_at }
{provider}_enabled        TEXT    — 'true' | 'false'
{provider}_last_sync      TEXT    — ISO timestamp of last successful sync

base_url                  TEXT    — e.g. 'http://bacta.home' — used for OAuth redirect URIs
source_priority           TEXT    — JSON array e.g. '["garmin","oura","polar"]'
```

### New API Routes

```
GET  /api/integrations/:provider/authorize    → build OAuth URL, redirect
GET  /api/integrations/:provider/callback     → exchange code, store tokens
POST /api/integrations/:provider/disconnect   → clear tokens, set enabled=false
POST /api/integrations/:provider/sync         → manual sync trigger
GET  /api/integrations/status                 → { provider: { connected, lastSync } } for all providers
```

---

## 5. Settings UI

### Collapsible Rails (All of SettingsPage)

All existing and new rails in `SettingsPage.tsx` become collapsible. Tap the rail label to toggle. State persists in `localStorage`. Collapsed state shows a one-line summary (e.g., `CONNECTED DEVICES  •  Garmin, Oura`).

### New Rails

**INSTANCE** (above MX-4 INTELLIGENCE):
```
INSTANCE
  Base URL    [ http://bacta.home ]
```
Used to construct OAuth redirect URIs. Displayed in the connect flow to help users know what to register in their provider's developer portal.

**CONNECTED DEVICES** (below INSTANCE):

Each provider renders a card. Two states:

*Disconnected state:*
```
┌─ Polar ────────────────────────────────────────┐
│  Client ID      [ __________________ ]         │
│  Client Secret  [ ***************** ]          │
│  [ Connect Polar → ]                           │
└────────────────────────────────────────────────┘
```

*Connected state:*
```
┌─ Polar ──────────────────────────────── ✓ ────┐
│  Connected                                     │
│  Last sync: today 03:16                        │
│  [ Sync Now ]  [ Disconnect ]                  │
└────────────────────────────────────────────────┘
```

Garmin's card is read-only (managed via the existing credentials file) and shows connected/last-sync status only.

Hevy shows an API key field instead of client_id/client_secret.

**DATA PRIORITY** (below CONNECTED DEVICES):
```
DATA PRIORITY
  When multiple devices report the same metric, prefer:
  ↑↓ Garmin   ↑↓ Oura   ↑↓ Polar   ↑↓ Whoop
  Reorder with arrows — top source wins per metric
```

Only connected providers appear in the priority list. Stored as `source_priority` in `app_settings`. The query layer uses this when `health_snapshots` has multiple sources for the same `(date, metric)`.

---

## 6. Source String Sweep

### What Changes

The hardcoded `source` strings in page-level constant objects across `RecoveryPage.tsx`, `SleepPage.tsx`, `TrainingPage.tsx`, and `LogEntry.tsx` (e.g., `'Garmin Venu 4 · overnight RMSSD'`) are replaced with dynamic values derived from the data.

### What Does NOT Change

`InfoOverlay` and `useCardInfoOverlay` in `InfoCardContext.tsx` are unchanged. The `CardInfo` interface in `theme.ts` is unchanged. The card standardization is already complete — this is a data-wiring job only.

### Implementation Pattern

Each data hook (`useRecoveryData`, `useSleepData`, `useTrainingData`) already fetches metric values from the API. API responses are extended to include the `source` column alongside each value. Page components derive the source string at render time:

```ts
// was: source: 'Garmin Venu 4 · overnight RMSSD'
// becomes:
const sourceLabel = (metric: string, src: string) =>
  `${PROVIDER_LABELS[src] ?? src} · ${METRIC_SOURCES[src]?.[metric] ?? ''}`

// Usage in info card definition:
source: sourceLabel('hrv', hrvData.source)
```

Falls back to just the provider label if a method description isn't mapped yet for that provider/metric combination.

---

## 7. MX-4 Impact

Minimal by design.

- `queryDb` tool: unchanged. Queries `health_snapshots` by metric name. The source priority layer resolves which row wins before MX-4 sees the data.
- `MX4_REFERENCE.md`: Add note that metrics may come from multiple sources; active source is user-configurable. Add new metric names introduced by non-Garmin providers (`readiness_score`, `strain_score`, etc.).
- System prompt, tools, orchestrator, chat: no changes.

---

## 8. Source Priority Query Layer

A small utility function used by all API routes that return metric data:

```ts
// server/lib/integrations/shared/sourceResolver.ts
export function resolveSource(
  rows: { source: string; value: number }[],
  priority: string[]   // from app_settings source_priority
): { source: string; value: number } {
  for (const src of priority) {
    const match = rows.find(r => r.source === src)
    if (match) return match
  }
  return rows[0] // fallback: first available
}
```

Used wherever `health_snapshots` is queried for a single canonical value. Raw multi-source data remains accessible for future power-user features.

---

## 9. Provider Support Matrix

| Provider  | Auth       | Key Data                                    | Status    |
|-----------|------------|---------------------------------------------|-----------|
| Garmin    | Credentials| HRV, body battery, sleep, training, all     | Existing  |
| Polar     | OAuth 2.0  | Sleep, HRV, RHR, VO2max, activities         | v1        |
| Oura      | OAuth 2.0  | Sleep stages, HRV, readiness, SpO2, 50+     | v1        |
| Whoop     | OAuth 2.0  | Recovery, strain, sleep, HRV                | v1        |
| Withings  | OAuth 2.0  | Weight, RHR, SpO2, sleep                    | v1        |
| Strava    | OAuth 2.0  | Activities, distance, HR zones              | v1        |
| Hevy      | API key    | Strength training activities                | v1        |
| Fitbit    | —          | Deprecated Sept 2026                        | Skipped   |
| Google Health Connect | — | Android SDK only                    | Skipped   |
| Apple Health | —       | iOS SDK only (deferred to native app)       | Deferred  |
| Open Wearables | —    | Optional upstream adapter                   | Deferred  |

---

## 10. Implementation Notes

- Migration script must be idempotent — safe to run on an already-migrated DB
- All new `app_settings` keys follow the `{provider}_*` naming convention
- Provider OAuth client credentials are the deployer's own — Bacta does not use shared app keys
- The `base_url` setting must be set before any OAuth flow is initiated; Settings UI should warn if unset when user clicks Connect
- Garmin poller move is a path-only change; systemd timer update is an operator step documented in `docs/OPERATIONS.md`
- Each processor should log `source` alongside metric name on ingest for observability
- `health_poller.py` dispatcher skips providers where `{provider}_enabled != 'true'`
