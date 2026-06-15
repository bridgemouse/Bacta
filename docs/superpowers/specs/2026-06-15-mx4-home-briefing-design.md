# MX-4 Home Briefing — Design Spec

**Date:** 2026-06-15  
**Status:** Approved  
**Scope:** Add `home` section to the MX-4 orchestrator so the Home page shows a live cross-channel briefing instead of the server-side stub.

---

## Problem

`sections.ts` defines three sections: `recovery`, `sleep`, `training`. The orchestrator loops over `SECTIONS` and writes a briefing for each to `mx4_briefings`. There is no `home` entry, so `mx4_briefings` never contains a row for `section = 'home'`. The `/api/insights/home` endpoint falls back to `STUB_BRIEFINGS.home`. `useBriefing('home')` returns the stub text. The `MX4Briefing` card on the Home page never shows live data.

Everything else is already wired: `HomePage.tsx` calls `useBriefing('home')`, passes `liveData` to `MX4Briefing`, and `MX4Briefing` renders live content when `liveData` is present.

---

## Design

### Approach

MX-4 queries his own completed section briefings from `mx4_briefings` (via `queryDb`) and synthesizes a cross-channel read. This preserves MX-4 as one continuous intelligence commenting on his own analysis, rather than re-deriving from raw metrics a second time.

The `home` section runs **last** in `SECTIONS` so recovery, sleep, and training briefings are already written when home executes.

`queryDb`'s execute function already allows any SELECT against any table — no code change needed there. The description just needs `mx4_briefings` added so MX-4 knows the table exists.

### File Changes

**1. `server/lib/ai/tools.ts`**

Add `mx4_briefings` to the schema block in `QUERY_DB_DESCRIPTION`:

```
mx4_briefings(section TEXT, content_json TEXT, generated_at TEXT, model TEXT)
  — section values: 'recovery', 'sleep', 'training', 'home'
  — content_json is a JSON string with fields: tone, headline, summary, body, recommendation, flags
  — Query example: SELECT section, content_json FROM mx4_briefings WHERE section IN ('recovery','sleep','training')
```

**2. `server/lib/ai/sections.ts`**

Add `home` as the last entry in `SECTIONS`:

```ts
{
  id: 'home',
  name: 'Home',
  metrics: [],
  includeManual: false,
  promptAddendum: `Query your three completed section analyses:
SELECT section, content_json FROM mx4_briefings WHERE section IN ('recovery', 'sleep', 'training')

Parse the summary field from each content_json result. You have already run three independent analyses — this briefing is your integrated read across all channels.

Do not restate each section in sequence. Synthesize: what is the dominant signal across the system today? Where do the channels agree, and where do they create tension? A strong recovery reading means little if sleep architecture was poor — surface the interaction.

Lead with the cross-channel verdict: primed, nominal, or under strain. Then the most significant tension or confirmation across domains. Close with one directive that accounts for all three channels.

Do not attempt readVault — vault is inaccessible per standing orders.

summary: 3–5 sentences. Cross-channel verdict, the most significant interaction between domains, the directive. No headers.
body: Use ## SYSTEM STATE, ## CHANNEL SYNTHESIS, ## TENSIONS & CONFIRMATIONS, ## DIRECTIVE. Bold all metric values referenced. Bullets for multi-point cross-channel findings.

After writing: no wiki update — home synthesis does not generate new standing knowledge.`,
}
```

### After Implementation

Trigger `POST /api/mx4/run` to generate all four briefings. Verify the home row appears in `mx4_briefings` and the Home page card switches from stub to live content.

---

## Pre-v1.0 Note

The home prompt contains `Do not attempt readVault — vault is inaccessible per standing orders.` This line (and its counterparts in `sections.ts` training prompt, `HEARTBEAT.md`, and `system-prompt.md`) must be removed once the NFS mount is configured. See memory: `project_vault_hardcoding.md`.

---

## Out of Scope

- No new tools
- No changes to the orchestrator loop logic
- No frontend changes (all wiring already in place)
- E2E QA sweep is a separate feature session
