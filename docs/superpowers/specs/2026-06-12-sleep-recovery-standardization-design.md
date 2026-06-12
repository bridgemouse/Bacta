# Sleep & Recovery Page Standardization

**Date:** 2026-06-12  
**Template:** `TrainingPage.tsx` (polished reference implementation)  
**Scope:** `SleepPage.tsx`, `RecoveryPage.tsx`

---

## Goal

Bring Sleep and Recovery pages to full structural parity with Training. Same code organization, same trends format, same bespoke-card pattern for top metrics, uniform info cards throughout.

---

## Standard scaffold (both pages must match this)

```
import type { CSSProperties }                     // Training has it; Sleep missing it
const A = SECTION_ACCENTS.<section>

// Named CardInfo constants for every metric (no inline objects anywhere)
const FOO_INFO: CardInfo = { title, description, source }

// Trend metadata record
type TrendSection = { railLabel: string; period: string; subtext: string; info: CardInfo }
const TREND_SECTIONS: Record<string, TrendSection> = { ... }

// Shared style constants
const BESPOKE_CARD: CSSProperties = {
  position: 'relative', background: COLORS.surface,
  border: `1px solid ${COLORS.line}`, borderRadius: 10,   // always 10
  padding: '13px 14px 11px', overflow: 'hidden', cursor: 'pointer',
}
const SUBTEXT: CSSProperties = {
  fontFamily: FONT_MONO, fontSize: 7.5, color: COLORS.textMuted, padding: '0 4px',
}

// XxxOverview()  — tab === 'overview'
// XxxTrends()    — tab === 'trends'
// XxxContent()   — InfoCardProvider wrapping tab switch
// export XxxPage() — AppShell with hasTabs
```

---

## Sleep Page changes

### New top-level CardInfo constants

All inline `info` objects must be hoisted to named constants. New constants needed:

| Constant | Used by |
|---|---|
| `SCORE_INFO` | Trends — Sleep Score bespoke card |
| `DURATION_INFO` | Trends — Sleep Duration bespoke card |
| `EFFICIENCY_INFO` | Overview — Efficiency pair card |
| `DEBT_INFO` | Overview — Sleep Debt pair card |
| `SLEEP_HR_INFO` | Overview tile + Trends TrendRow |
| `RESP_INFO` | Overview tile + Trends TrendRow |
| `SLEEP_STRESS_INFO` | Overview tile + Trends TrendRow |
| `SPO2_INFO` | Overview tile |

`HERO_INFO` and `ARCH_INFO` already exist — keep them.

### TREND_SECTIONS record (new)

```ts
const TREND_SECTIONS: Record<string, TrendSection> = {
  score:    { railLabel: 'SLEEP SCORE',      period: '7 DAYS', subtext: '85+ excellent · 70–84 good · 60–69 fair · below 60 = address recovery deficits', info: SCORE_INFO },
  duration: { railLabel: 'SLEEP DURATION',   period: '7 DAYS', subtext: 'target 7–9 hours · under 7h for 3+ nights compounds cognitive and metabolic debt', info: DURATION_INFO },
  hr:       { railLabel: 'SLEEP HEART RATE', period: '7 DAYS', subtext: 'lower = better · elevation above your norm often flags alcohol, illness, or overtraining', info: SLEEP_HR_INFO },
  resp:     { railLabel: 'RESPIRATION',      period: '7 DAYS', subtext: '12–20 br/m normal · a rise of 1–2 above baseline often precedes illness by 12–24h', info: RESP_INFO },
  stress:   { railLabel: 'SLEEP STRESS',     period: '7 DAYS', subtext: 'below 26 = rest zone · consistently low = strongest overnight recovery signal', info: SLEEP_STRESS_INFO },
}
```

### Overview changes

**Efficiency + Debt pair cards:** Refactor from `borderLeft: 3px solid` pattern to standard card pattern: `COLORS.surface` background, `COLORS.line` border, `Bracket` component, top accent gradient `span`. Content (efficiency bar, debt display) unchanged.

**First Rail:** Add `right` label — `"SYNTHESIZED"`.

### Trends tab rewrite

Pattern: `Rail` → bespoke card or `TrendRow` → `SUBTEXT` div, for each metric.

**Bespoke cards (new):**

1. **Sleep Duration** — `Bars7`, `h` format, header shows `slp.duration.h}h {slp.duration.m}m` + period label. Matches Training's Weekly Volume card structure.

2. **Sleep Score** — `Sparkline`, header shows current score + state badge (`IMPROVING ↑` / `DECLINING ↓` based on comparing first vs last value in trend). Matches Training's Fitness Age card structure.

**TrendRow entries (with added `info` props):**
- Respiration · lowerBetter
- Sleep Heart Rate · lowerBetter
- Sleep Stress · lowerBetter

All wrapped with `Rail` above and `SUBTEXT` below.

---

## Recovery Page changes

### Overview — no changes

Overview is already well-structured. Body Battery and Recovery Time cards are implemented. No changes needed.

### BESPOKE_CARD fix

`borderRadius: 11` → `borderRadius: 10` to match Training.

### Trends tab — promote two metrics to bespoke

**Bespoke cards (new):**

1. **Recovery Score** — `Bars7`, header shows current score + state badge. Matches Training's Acute Load trend card structure. Replace the existing `TrendRow` for Score.

2. **HRV** — `Sparkline`, header shows current value + `vs {avg}ms week avg` + delta. Bottom legend: `baseline {low}–{high}ms` and `7d avg {avg}ms` lines (reuse the same legend markup from the Overview HRV card). Replace the existing `TrendRow` for HRV.

**Remaining TrendRows** — unchanged (battery, rhr, stress, sleepStress, recovTime, resp). All already have `info` props and subtexts.

---

## Implementation sequence

1. **Sleep Page** — all changes in one pass
   - Add `CSSProperties` import
   - Hoist all inline CardInfo to named constants
   - Add `TREND_SECTIONS`, `BESPOKE_CARD`, `SUBTEXT`
   - Refactor Efficiency/Debt pair cards
   - Add `right` to first Rail
   - Rewrite `SleepTrends` with bespoke + TrendRow pattern

2. **Recovery Page** — all changes in one pass
   - Fix `borderRadius` in `BESPOKE_CARD`
   - Add Score + HRV bespoke cards to `RecoveryTrends`

3. **Visual verification** — Playwright screenshot both pages (Overview + Trends) after each page

4. **Type check** — `npx tsc --noEmit`

---

## Hard constraints (no exceptions)

- Inline styles only — no CSS files, no Tailwind
- Colors from `theme.ts` only — no hardcoded hex
- `hexA()` for all rgba values
- `minHeight` not `height` on cards
- `FONT_MONO` for all numbers/labels
