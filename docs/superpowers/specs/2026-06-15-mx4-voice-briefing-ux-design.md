# MX-4 Voice, Briefing UX & Context Architecture — Design Spec

**Date:** 2026-06-15  
**Status:** Approved for implementation

---

## Overview

First orchestrator run revealed three issues: (1) briefing body is a wall of clinical prose that doesn't match MX-4's character, (2) the card has no way to surface the full analysis without burying section data, (3) HEARTBEAT.md was never created despite being fully wired. This feature fixes all three and adds the supporting infrastructure: message compression, vault setup docs, and a wiki sync chat pill.

---

## 1. Schema — BriefingResult

Add `summary: z.string()` to `BriefingResultSchema` in `server/lib/ai/types.ts`.

- **`summary`** — 3-5 sentences, prose only (no headers), MX-4's key finding in his voice. What the card shows.
- **`body`** — full structured markdown analysis, behind FULL ANALYSIS. Headers, bullets, bold numbers.

Both fields extracted in one `generateObject` pass — no extra API call.

---

## 2. System Prompt Rewrite (`mx4/system-prompt.md`)

### Voice changes
- Remove the "Analysis Depth" 5-point checklist — it drives medical-report mode
- Replace with 2-3 concrete output examples in the correct register: declarative, first-person observation, numbers bolded, no hedging, no "your HRV is..." framing
- MX-4 speaks TO Ethan directly. Short sentences. Data leads, interpretation follows.

### Format directive
MX-4 uses standard markdown, structured like a droid diagnostic readout:
- `##` headers: uppercase, terse (`## AUTONOMIC SIGNAL`, `## LOAD CONTEXT`, `## DIRECTIVE`)
- Bold for metric values: `**60ms**`, `**452**`
- Bullets for multi-point findings
- `summary` field: 3-5 sentence prose, no headers, punchy
- `body` field: structured markdown, full analysis with headers and bullets

### Tools section
Already updated in previous session — `queryDb` with full EAV schema, `readVault`, `readAllWikiPages` correctly described.

---

## 3. HEARTBEAT.md (`mx4/HEARTBEAT.md`)

First creation of this file. Already wired: `loadHeartbeat()` in `wiki.ts` reads it and both orchestrator and chat endpoint inject it as `## Standing Orders` on every request. Because it's injected fresh on every chat turn, it serves as the primary personality persistence layer — no separate identity injection mechanism needed.

**Contents:**

### Standing Orders
- Current training block context: Ethan's July VO2max target (52–55 ml/kg/min, "Excellent" for 26M), current block week, pre-wedding timeline
- Behavioral directives: speak to Ethan directly, not about him; no clinical register; no cushioned readings; state findings not possibilities
- What to watch: VO2max trajectory toward July target, sleep deep-sleep deficit trend, load ratio approaching upper band

### Wiki Management Protocol (Karpathy Model)
MX-4 treats `mx4/wiki/` as working memory, not a log:
- After each analysis, decide: is there something worth preserving that isn't already captured?
- If a page for this exists: update it with new information, revise if understanding changed, prune if stale
- If the pattern is new and meaningful: create a focused page
- Never append raw observations — synthesize
- A page should reflect what MX-4 currently understands, not a timeline of what he's seen
- Wiki pages are knowledge, not journals

---

## 4. Section Prompts (`server/lib/ai/sections.ts`)

`promptAddendum` for each section rewritten from "produce a complete analysis" to directive language that matches MX-4's voice and the two-field output requirement:

- Write `summary`: 3-5 sentences, key finding + implication + directive. No headers. Make it count.
- Write `body`: full analysis in structured markdown. `##` headers uppercase. Bold all metric values. Bullets for multi-point findings. End with `## DIRECTIVE` containing the single most important action.
- After analysis: decide what to write to wiki (see standing orders).

---

## 5. MX4Card UX (`client/src/components/MX4Card.tsx`)

### Card body (live data)
- Shows `liveData.summary` instead of `liveData.body`
- DIRECTIVE block remains below summary (uses `liveData.recommendation`)
- ReactMarkdown gets `h2` and `h3` handlers: JetBrains Mono, section accent color, small font, letterSpacing — so `body` markdown renders as a droid readout when shown in AskSheet

### Footer
- `FULL ANALYSIS ›` button: JetBrains Mono, 9px, section accent color, right-aligned in footer alongside telemetry widget
- On tap: `POST /api/mx4/chat/seed` with `{ sessionId, content: liveData.body }` → then calls `openAskSheet()` from context
- Ask button (BottomBar) continues to open AskSheet clean — no seeding, no change

### Flags
- Unchanged: pills below card, colored by tone

---

## 6. Seed Endpoint (`server/api/mx4.ts`)

```
POST /api/mx4/chat/seed
Body: { sessionId: string, content: string }
```

Inserts one `{ role: 'assistant', content }` row into `mx4_chat_messages`. Returns `{ ok: true }`. No streaming, no model call — direct DB write. Full briefing body appears as MX-4's latest message when AskSheet opens and restores history.

---

## 7. AskSheet Context

New `AskSheetContext` (or extend existing AppShell state) exposing `openAskSheet()`. 

- BottomBar Ask button calls `openAskSheet()` — same behavior as today
- Section pages call `openAskSheet()` from the FULL ANALYSIS button after seeding
- Session ID is date-based and unified across all sections — one MX-4, one conversation per day, context grows across Recovery/Sleep/Training interactions

---

## 8. AskSheet — Chat Pills

Current suggested pills reviewed and updated. Add:
- `SYNC WIKI ›` — triggers MX-4 to review the session and update his wiki pages per the HEARTBEAT protocol. Works naturally because wiki management instructions are in HEARTBEAT, which is injected on every chat turn.

Font for all pills: JetBrains Mono. Consistent with the rest of the system.

---

## 9. Message Compression

Runs server-side during each chat request, before building the `messages` array for `streamText`.

**Trigger:** Session message count exceeds `mx4_chat_compression_threshold` setting (default: 20, user-configurable in SettingsPage under MX-4 INTELLIGENCE rail).

**Process:** Take the oldest 10 message pairs, run `generateText` with a short compression prompt: summarize into a single condensed assistant message preserving key findings in MX-4's voice. Replace the original messages with the compressed entry. Flag the compressed entry to prevent re-compression.

**New setting:**
- Key: `mx4_chat_compression_threshold`
- Default: `'20'`
- Shown in SettingsPage MX-4 INTELLIGENCE section as a numeric input

**Effect:** Token budget stays manageable. Personality persistence is handled by HEARTBEAT injection on every turn — compression is purely a budget mechanism.

---

## 10. Vault Setup Docs (`docs/VAULT_SETUP.md`)

Self-contained NFS runbook for exposing the Obsidian vault from LXC 106 to LXC 109 so MX-4 can read it via `readVault`.

**Contents:**
- What MX-4 expects: mount at `/mnt/vault`, files accessed as `readVault("training/summer-plan.md")` → resolves to `/mnt/vault/wiki/training/summer-plan.md`
- LXC 106 setup: `apt install nfs-kernel-server`, `/etc/exports` entry for LXC 109's IP (`192.168.1.x`), `exportfs -ra`, `systemctl enable nfs-server`
- LXC 109: `mount /mnt/vault` (fstab already configured: `192.168.1.202:/srv/nfs/vault /mnt/vault nfs ro,defaults,_netdev 0 0`)
- Verification: `ls /mnt/vault/wiki` and tap `SYNC WIKI ›` in AskSheet to confirm MX-4 can read it
- Recommended vault structure MX-4 knows to look for: `training/`, `health/`, `journal/`

---

## Files Changed

| Action | File | What |
|---|---|---|
| Modify | `server/lib/ai/types.ts` | Add `summary` to `BriefingResultSchema` |
| Modify | `mx4/system-prompt.md` | Voice rewrite, format directive, output examples |
| **Create** | `mx4/HEARTBEAT.md` | Standing orders + wiki protocol |
| Modify | `server/lib/ai/sections.ts` | Tighter directive prompts, two-field output instructions |
| Modify | `client/src/components/MX4Card.tsx` | Show summary, FULL ANALYSIS button, h2/h3 markdown handlers |
| Modify | `server/api/mx4.ts` | Add `POST /api/mx4/chat/seed` endpoint |
| Modify | `server/lib/settings.ts` | Add `mx4_chat_compression_threshold` default |
| Modify | `client/src/pages/SettingsPage.tsx` | Compression threshold input in MX-4 INTELLIGENCE rail |
| Modify | `client/src/components/AskSheet.tsx` | Add `SYNC WIKI ›` pill; wire `openAskSheet` context |
| Modify | `client/src/components/BottomBar.tsx` | Use `openAskSheet` from context instead of local handler |
| Modify | `client/src/components/AppShell.tsx` | Lift AskSheet open state into context |
| Modify | `server/api/mx4.ts` | Message compression before `streamText` |
| **Create** | `docs/VAULT_SETUP.md` | NFS runbook for vault exposure |

---

## Out of Scope

- Home section briefing (separate feature — needs its own section definition)
- Wiki archive/wrap on oversized pages (already implemented in `wrap.ts`)
- Cron installation on LXC 109 (operational task, not code)
- Vault directory structure creation (Ethan's vault, outside repo)
