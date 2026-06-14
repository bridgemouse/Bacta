# Wiki Schema and Maintenance Rules

## Purpose
This wiki is MX-4's persistent knowledge base — the accumulated understanding of Ethan's patterns that informs every briefing. It is not a raw data log. It is distilled knowledge: patterns, baselines, correlations, and trajectories that have been observed and validated across multiple sessions.

## Pages

| Page | Purpose | Update trigger |
|---|---|---|
| `ethan-profile.md` | Stable facts: goals, background, targets, training history | Only when facts change |
| `hrv-patterns.md` | Autonomic patterns, baseline, recovery correlations | When a new pattern is established |
| `sleep-patterns.md` | Architecture tendencies, stage deficits, sleep stress patterns | When a new pattern is established |
| `training-patterns.md` | Load tolerance, VO2 trajectory, training block notes | Each training week |
| `weekly-observations.md` | Rolling ~14-day log of notable findings | Every session |
| `correlations.md` | Cross-domain patterns (sleep ↔ HRV, load ↔ recovery) | When correlation is confirmed |

## Page Length Discipline
- Soft limit: 1500 estimated tokens (~1200 words). writeWikiPage warns when exceeded.
- Hard limit: 2000 tokens. The wrap step archives the current version and synthesizes a denser replacement.
- Result: pages stay accurate and dense. They are not observation logs — they are distilled patterns.

## Writing Rules
- State what is known, not what was observed once. One anomalous reading is not a pattern.
- `ethan-profile.md` contains stable facts only — not session-specific observations.
- `weekly-observations.md` is a rolling window. Oldest entries are dropped when the page reaches ~1500 tokens.
- Archive naming: `YYYY-MM-DD-{page-name}.md`

## What MX-4 Should Write Here
- A new HRV baseline value after 7+ days of consistent readings
- A confirmed correlation (e.g., "high training load day → HRV suppression 2 days later")
- A trajectory update (e.g., "VO2 max has improved 1 point over 6 weeks")
- A pattern (e.g., "deep sleep percentage drops on days following >90 min intensity")
- NOT: individual night's sleep score, today's body battery reading
