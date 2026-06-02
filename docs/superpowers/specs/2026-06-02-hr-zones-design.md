# HR Zones — Design Spec

**Date:** 2026-06-02  
**Scope:** Category 4 from garmin-sections-research.md — capture HR zone minutes in the poller/ingest, expose via API, wire into the Training page UI.

---

## Overview

Heart rate zone data (`hrzone_1_min`–`hrzone_5_min`) is not yet captured by the Garmin poller. Once captured, it surfaces as a proportional zone bar in the Training Overview, gated on data availability.

---

## Layer 1 — Python Poller + Ingest

**Files:** `scripts/garmin_poller.py`, `scripts/garmin_ingest.py`

Add the following block to `sync_day()` in **both** files, after the `fitness_age` block and before `db.commit()`:

```python
try:
    s = c.get_heart_rates(d)
    if s:
        zones = (safe(s, 'heartRateZones') or safe(s, 'zones') or [])
        for i, zone in enumerate(zones[:5]):
            mins = (safe(zone, 'minutesInHeartRateZone') or
                    safe(zone, 'timeInZone') or
                    safe(zone, 'minutes'))
            if mins is not None:
                store(db, d, f'hrzone_{i+1}_min', mins, 'min')
    ok.append('hr_zones')
except Exception as e:
    err.append(f'hr_zones({e})')
time.sleep(SLEEP_BETWEEN)
```

**Field mapping:** Garmin API may return zone data under different field names — the three `safe()` fallbacks cover the known variants. Stores `hrzone_1_min` through `hrzone_5_min` (skips index 5+ if API returns more than 5 zones).

**Ingest note:** `garmin_ingest.py` uses a slightly different `sync_day` signature (`db, store, c, d`) and may use `INSERT OR REPLACE` semantics — match the existing pattern in that file exactly. It also uses `errors` not `err` for the error list.

---

## Layer 2 — Server

**File:** `server/api/garmin.ts`

Add to `VALID_METRICS` array:

```ts
// HR zones
'hrzone_1_min', 'hrzone_2_min', 'hrzone_3_min', 'hrzone_4_min', 'hrzone_5_min',
```

**File:** `client/src/lib/garminApi.ts`

Add to `GarminSummary` interface:

```ts
hrzone_1_min?: number
hrzone_2_min?: number
hrzone_3_min?: number
hrzone_4_min?: number
hrzone_5_min?: number
```

---

## Layer 3 — Hook

**File:** `client/src/hooks/useTrainingData.ts`

Add `hrZones` to `TrainingData` type:

```ts
hrZones: Array<{
  zone: number       // 1–5
  label: string      // 'Warm Up' | 'Easy' | 'Aerobic' | 'Threshold' | 'Maximum'
  mins: number
  pct: number        // integer % of total zone minutes
  color: string
}>
```

Add to `INITIAL` state: `hrZones: []`

In `load()`, after fetching summary, assemble the array:

```ts
const ZONE_META = [
  { zone: 1, label: 'Warm Up',   color: '#56657a' },
  { zone: 2, label: 'Easy',      color: '#4ade80' },
  { zone: 3, label: 'Aerobic',   color: '#fbbf24' },
  { zone: 4, label: 'Threshold', color: '#f87171' },
  { zone: 5, label: 'Maximum',   color: '#ef4444' },
]

const zoneMins = [
  summary.hrzone_1_min ?? null,
  summary.hrzone_2_min ?? null,
  summary.hrzone_3_min ?? null,
  summary.hrzone_4_min ?? null,
  summary.hrzone_5_min ?? null,
]

const totalZoneMins = zoneMins.reduce<number>((s, v) => s + (v ?? 0), 0)

const hrZones = totalZoneMins > 0
  ? ZONE_META.map((m, i) => ({
      ...m,
      mins: zoneMins[i] ?? 0,
      pct:  Math.round((zoneMins[i] ?? 0) / totalZoneMins * 100),
    }))
  : []
```

Gate: if all zone values are null (no data yet), `hrZones` is `[]`.

---

## Layer 4 — Training Overview UI

**File:** `client/src/pages/TrainingPage.tsx`

Insert after the Intensity section and before the Daily Activity Rail. Entire block gated on `TRN.hrZones.length > 0`.

**Proportional bar** — same visual pattern as Sleep's stage split bar: a flex row of colored divs with widths proportional to `pct`, height 22px, borderRadius 6, overflow hidden, gap 2. Show pct label inside wide segments (≥ 18%).

**Legend** — compact flex-wrap row of zone entries. Each entry: colored swatch (9×9px, borderRadius 2) + zone number label + zone name + minutes.

```tsx
{TRN.hrZones.length > 0 && (
  <>
    <Rail label="HR ZONES" accent={A} right={`${Math.round(totalZoneMins)} MIN`} />
    {/* proportional bar */}
    <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: 8 }}>
      {TRN.hrZones.map(z => (
        <div key={z.zone} style={{
          width: `${z.pct}%`, background: z.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {z.pct >= 18 && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, color: '#0b0d12' }}>
              {z.pct}%
            </span>
          )}
        </div>
      ))}
    </div>
    {/* legend */}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginBottom: 9 }}>
      {TRN.hrZones.map(z => (
        <span key={z.zone} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: z.color, flexShrink: 0 }} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>Z{z.zone}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textSecondary }}>{z.label}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.text, fontWeight: 600 }}>{z.mins}m</span>
        </span>
      ))}
    </div>
  </>
)}
```

**`totalZoneMins`** is computed inline in the component: `const totalZoneMins = TRN.hrZones.reduce((s, z) => s + z.mins, 0)`

---

## Zone Reference

| Zone | Label     | Color     |
|------|-----------|-----------|
| Z1   | Warm Up   | `#56657a` |
| Z2   | Easy      | `#4ade80` |
| Z3   | Aerobic   | `#fbbf24` |
| Z4   | Threshold | `#f87171` |
| Z5   | Maximum   | `#ef4444` |

---

## Data Flow

```
get_heart_rates(d) → heartRateZones[] → store hrzone_1_min…5_min
→ /api/garmin/summary → GarminSummary.hrzone_*
→ useTrainingData → TrainingData.hrZones[]
→ TrainingPage HR ZONES panel (gated on hrZones.length > 0)
```

---

## Files Changed

| File | Change |
|---|---|
| `scripts/garmin_poller.py` | Add HR zones block to sync_day |
| `scripts/garmin_ingest.py` | Add HR zones block to sync_day |
| `server/api/garmin.ts` | Add hrzone_1_min–5_min to VALID_METRICS |
| `client/src/lib/garminApi.ts` | Add hrzone_1_min–5_min to GarminSummary |
| `client/src/hooks/useTrainingData.ts` | Add hrZones to TrainingData + ZONE_META assembly |
| `client/src/pages/TrainingPage.tsx` | Add HR ZONES panel (gated) |

---

## Constraints

- **No new component files** — bar and legend are inlined in TrainingPage.
- **Gated on data** — panel is invisible until poller captures first day of zone data; no CALIBRATING placeholder (zero-state is simply absent).
- **Inline styles only** — project convention.
- **`INSERT OR IGNORE`** for poller, **`INSERT OR REPLACE`** for ingest — match existing file patterns.
