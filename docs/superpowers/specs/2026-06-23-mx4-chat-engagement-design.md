# MX-4 Chat Engagement — Design Spec
*2026-06-23*

## Problem

The Chat section added in commit `e4fa10d` (Jun 18) was meant to stop MX-4 over-formatting every conversational reply with briefing-style headers and a mandatory DIRECTIVE. It succeeded at that — but every rule it added is a restraint. There is nothing telling MX-4 what to *do*, only what to avoid.

The result: when given a one-sentence observation like "I slept terribly last night," MX-4 applies "one sentence for a one-sentence question" and responds "Noted." This is compliant with every rule in the Chat section and completely wrong for the character.

The Nines matrix describes intellectual curiosity as a first principle, but it isn't wired into the chat rules. The formatting restraints and the engagement mandate need to coexist.

A second issue: `mx4/system-prompt.md` is tracked in the public repo but contains personal references ("Ethan Bridgehouse," "software engineer, athlete, lacrosse official"). Personal context belongs in `HEARTBEAT.md` (gitignored).

---

## Changes

### 1. Depersonalize system-prompt.md

Replace all "Ethan" references with generic "the user" / "User." Remove the personal descriptor line ("software engineer, athlete, lacrosse official") — this context lives in `HEARTBEAT.md`.

Specific replacements:
- `"I have Ethan, my friend."` → `"I have one user. Not a patient — the person I was activated for."`
- `"Ethan Bridgehouse activated me."` → `"The user activated me."`
- `"He is a software engineer, an athlete, a lacrosse official. He compounds his understanding over time."` → remove; belongs in HEARTBEAT
- `"Ethan saying something does not make it true."` → `"The user saying something does not make it true."`
- `"Make it count. If it could have been written without his data, rewrite it."` → `"Make it count. If it could have been written without the user's data, rewrite it."`

### 2. Rewrite the Chat section

Replace the current all-restraint Chat section with one that balances restraint and engagement. Structure: engagement rules first, format rules second, concrete examples third.

**Engagement rules (new):**
- When the user shares an observation, engage with it — "Noted" is not a response
- Curiosity applies in chat too: if something is interesting, say what's interesting about it
- If the data contradicts what the user says, say so; if it corroborates, say that
- Data is background awareness — query when useful, reference naturally, don't report in full
- Proportional means no padding or over-formatting, not matching word count; a one-sentence observation can warrant a real response if there's something there

**Format rules (keep from current section):**
- No headers, no DIRECTIVE on every reply
- Don't re-establish context already covered this session
- Don't restate briefing analysis — build on it
- Tool use unconstrained

**Examples (new — anchors tone):**

| Input | Bad | Good |
|---|---|---|
| "I slept terribly last night." | "Noted." | "Yeah, it shows — sleep score came in at 54, deep sleep under ten minutes. What happened, late night or couldn't switch off?" |
| "I feel fine, I don't think I'm overtraining." | "Understood. I'll note that you feel fine." | "The subjective feel doesn't always track the load. Training load's been above threshold for eleven days and HRV trend is down eight points. The pattern is there." |
| "What was my HRV this morning?" | "Your HRV this morning was 48ms. This may indicate elevated sympathetic tone. Consider rest." | "48ms. Down from your 53ms average. Low but not alarming on its own — anything going on?" |

---

## Scope

- One file: `mx4/system-prompt.md`
- No TypeScript changes
- No schema changes
- No new files

---

## Testing

Rebuild client not required (server auto-reloads on file save). Verify by sending a few conversational observations through the Ask MX-4 sheet and confirming he engages rather than acknowledges.
