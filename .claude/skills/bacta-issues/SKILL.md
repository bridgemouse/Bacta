---
name: bacta-issues
description: Use when the user invokes /bacta-issues to turn a freeform list of bugs/tweaks/observations into well-formed, triage-gated GitHub issues ready for autonomous pickup by bacta-headless
---

# Bacta Issue Intake

## Overview

The user notices things while actually using the app — a stale widget, a
missing animation, an idea for a setting — and jots them down raw (Apple
Notes, a rambling paragraph, a quick numbered list). This skill turns that
raw dump into clean GitHub issues in one pass: **parse → dedup → classify →
draft → gate → confirm → file.**

The output is consumed later by `/bacta-headless`, which works the queue
unattended. That skill's triage gate requires (1) stated acceptance criteria
and (2) a plausible failing test before it will attempt an issue — anything
else gets skipped with a comment, silently wasting a session slot. **This
skill's job is to do that gating at filing time, not leave it for headless
to discover at 3am.** A vague note becomes either a sharpened issue or an
explicitly pre-gated one — never a bare restatement of what the user typed.

Never invoked unattended. This is always a live conversation with the user
present to answer clarifying questions and approve the batch before filing.

---

## Phase 0 — Ensure gating labels exist

`bacta-headless` already removes `blocked`, `needs-design`, and
`needs-human-decision` issues from its queue without comment — but only
`wontfix` currently exists as a real label in the repo. Check and create the
other three (idempotent, safe to run every invocation):

```bash
gh label list --repo bridgemouse/bacta --json name -q '.[].name'
```

For any missing, create with:
```bash
gh label create "blocked" --repo bridgemouse/bacta --color "b60205" \
  --description "Waiting on an external dependency (data source, account, credential) not yet available"
gh label create "needs-design" --repo bridgemouse/bacta --color "5319e7" \
  --description "New section/major UI surface — needs a Claude Design handoff before implementation"
gh label create "needs-human-decision" --repo bridgemouse/bacta --color "e99695" \
  --description "Acceptance criteria genuinely ambiguous — needs product judgment before it's actionable"
```

---

## Phase 1 — Intake

Ask the user for their raw list if they invoked `/bacta-issues` with no
input attached. Accept whatever form it comes in — numbered list, bullets,
a wall of prose, half-sentences. Do not ask them to reformat it first.

## Phase 2 — Parse into candidates

Split the raw input into discrete candidate issues. Rules of thumb:

- One numbered/bulleted item or one clearly separated observation = one
  candidate.
- Merge fragments that are obviously the same underlying issue (e.g. "sleep
  page dial looks off" + "also the number is missing on it" a few lines
  later = one candidate).
- If a single line bundles two unrelated complaints ("nav bar sometimes
  flickers and also I want a dark-mode toggle" — note: dark-mode-only is a
  hard rule, so that second half would get rejected anyway, see Phase 4),
  split it into two candidates.

## Phase 3 — Dedup against existing issues

```bash
gh issue list --repo bridgemouse/bacta --state all --json number,title,state,labels --limit 100
```

For each candidate, check for title/keyword overlap with existing issues
(open or closed — a closed issue that sounds identical may mean the bug
regressed, which is worth surfacing to the user, not silently refiling).

Classify each candidate's dedup status:
- **NEW** — no meaningful overlap
- **DUPLICATE-OPEN #N** — an open issue already covers this; do not refile,
  optionally comment with new details if the user's note adds information
- **REOPEN-CANDIDATE #N** — a closed issue looks like the same bug —
  surface this explicitly, it may mean a regression
- **RELATES-TO #N** — adjacent but distinct; file as new, cross-reference

## Phase 4 — Classify

For each NEW candidate, assign a primary label:

| Label | When |
|---|---|
| `bug` | Actual behavior diverges from expected/working behavior |
| `enhancement` | New capability that doesn't exist yet |
| `polish` | Visual/UX refinement — nothing is broken, just rough |
| `documentation` | Docs-only |

Reject (don't file, tell the user directly) anything that conflicts with a
hard project constraint — check `CLAUDE.md`'s "CRITICAL CONVENTIONS" section
(inline styles only, dark UI always, no Docker-is-required framing, etc.)
before drafting. A request for light mode doesn't become an issue; it
becomes a one-line "can't do that, here's why" back to the user.

## Phase 5 — Draft

Write each issue in the repo's established structure (matches issues
#7–#21, not the generic `.github/ISSUE_TEMPLATE/` stub — the templates are
a floor for outside contributors, this skill can do better because it has
full app context):

**Bugs:**
```markdown
## Description
<1-2 sentences: what's wrong>

## Steps to reproduce
1. ...
2. ...

## Expected behavior
<...>

## Actual behavior
<...>

## Acceptance criteria
<Concrete, checkable statement of "done." This is the field bacta-headless's
triage gate reads for first. If you can't write this crisply, the issue
isn't ready — go to Phase 6.>
```

**Enhancements / polish:**
```markdown
## Description
<what and why>

## Proposed behavior
<concrete target state>

## Acceptance criteria
<same bar as above>
```

Title convention: `Area: concise description` (e.g. `Sleep: cumulative
debt widget shows single-night deficit`), under 70 chars, matching existing
issue titles — not the raw phrasing the user used.

**Do not invent acceptance criteria that overreach the user's actual
complaint.** If they said "the dial looks off," the acceptance criteria is
about the dial rendering correctly, not a redesign of the sleep page.

## Phase 6 — Headless-readiness gate

Apply `bacta-headless`'s own triage gate to your draft, before the user
ever sees it:

1. **Can you state acceptance criteria?** (You just tried in Phase 5.)
2. **Can you imagine a plausible failing test for it?**

| Both yes | File normally with the Phase 4 label. |
|---|---|
| Acceptance criteria genuinely unclear (needs a product call, not more investigation) | Add `needs-human-decision`. State in the issue body what decision is needed. |
| Requires a new section/major UI surface | Add `needs-design`, note in the body that a Claude Design handoff is the prerequisite (per `CLAUDE.md`'s section-design workflow). |
| Depends on something not available yet (no MacroFactor account, no lab results, external API/device not integrated) | Add `blocked`, state what would unblock it. |
| Nothing testable even after real effort (pure config, nondeterministic, nothing but CSS with no logic) | File normally but note `NOT_TESTABLE` risk in the body so headless doesn't burn an attempt discovering it — headless's own Phase 1b will still make the final call. |

This mirrors `bacta-headless` Phase 1b and its `NOT_TESTABLE` codes
(`CONFIG_ONLY`, `EXTERNAL_DEP`, `NONDETERMINISTIC`, `VISUAL_ONLY`) — reuse
those exact terms in the issue body so the eventual headless run recognizes
the same vocabulary.

## Phase 7 — Batch review with the user

Before filing anything, show the full batch as a compact table:

```
# | Title | Label(s) | Dedup status
1 | Sleep: cumulative debt widget shows... | enhancement | NEW
2 | ... | bug, needs-human-decision | NEW
3 | ... | — | DUPLICATE-OPEN #21 (skip)
```

Ask for confirmation once for the whole batch (not per-issue) — call out
anything unusual: rejected items (Phase 4), reopen-candidates, and any
`needs-human-decision`/`needs-design`/`blocked` gating so the user can
correct your read before anything goes live. Let the user edit, drop, or
re-classify any row before proceeding.

## Phase 8 — File

For each confirmed NEW candidate, write the body to a temp file (avoid
multi-line heredoc pitfalls) and file:

```bash
gh issue create --repo bridgemouse/bacta \
  --title "<title>" \
  --label "<label1>,<label2>" \
  --body-file /tmp/claude-1000/-opt-bacta/*/scratchpad/issue-body-N.md
```

For DUPLICATE-OPEN items the user chose to enrich rather than skip, comment
instead:
```bash
gh issue comment <N> --repo bridgemouse/bacta --body-file <path>
```

For REOPEN-CANDIDATE items the user confirms are regressions:
```bash
gh issue reopen <N> --repo bridgemouse/bacta
gh issue comment <N> --repo bridgemouse/bacta --body "Reopened — reported again $(date +%Y-%m-%d): <detail>"
```

## Phase 9 — Report back

List what happened, plain and short:

```
Filed: #N <title> [labels]
Filed: #N <title> [labels]
Commented: #N (enriched existing report)
Reopened: #N (regression)
Skipped (duplicate, no new info): <original note>
Rejected (violates hard constraint): <original note> — <why>
```

No ROADMAP.md update — GitHub Issues is the system of record for discrete
items; ROADMAP.md covers milestones only (established Jun 29, 2026).

---

## Quick Reference

| Situation | Action |
|---|---|
| User pastes a wall of unstructured text | Parse it anyway — don't push formatting work back on them |
| A note sounds like an existing open issue | Don't refile — offer to comment with new detail instead |
| A note sounds like a closed issue | Flag as possible regression, ask before reopening |
| Acceptance criteria would require guessing scope | `needs-human-decision`, don't invent scope to force it through |
| Note violates a hard CLAUDE.md constraint (light mode, etc.) | Reject, explain why, don't file |
| New section-level UI work | `needs-design` — Claude Design handoff is the prerequisite, not implementation |
| Batch ready | One confirmation for the whole batch, not per-issue |

## Common Mistakes

| Mistake | Consequence |
|---|---|
| Filing issues without acceptance criteria | `bacta-headless` will skip it later, wasting a queue slot to discover what was knowable now |
| Treating the raw user note as the issue body | Loses structure; future headless runs and human reviewers both need the standard shape |
| Refiling a duplicate | Splits history across two issues, headless may attempt both independently |
| Skipping the batch review step | User's own notes get misclassified or over-scoped without a chance to correct |
| Forgetting the three gating labels don't exist yet | `bacta-headless`'s queue-filtering logic silently never fires |
