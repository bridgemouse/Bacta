# Bacta — Visual Design Brief

I'm bringing you a working skeleton of **Bacta**, a personal health dashboard iOS PWA that I always planned to bring to Claude Design for the official look. The code is functional but the styling is intentionally minimal — it was never meant to be the final design. That's what we're here for.

---

**What Bacta is**

Bacta is named after the Star Wars healing fluid — the thing that restores you. It's a personal health intelligence platform: Garmin metrics, in-house nutrition tracking, sleep analysis, blood work, and daily manual logs — all unified in one place and narrated by MX-4, Bacta's AI droid assistant.

This is not a generic health app. It's built for one person (me), runs locally on a homelab server, and is saved to the iPhone home screen as a standalone PWA.

---

**MX-4 — the intelligence layer**

MX-4 is Bacta's droid. He's modeled on a TC-series protocol droid with two personality matrices — "Nines" (Rex's right hand in The Clone Wars — loyal, direct, pragmatic) and "Two-Boots" (a field medic, steady under pressure, precision-focused). He's not a cheerleader. He gives genuine assessments. He notices things. He flags what matters, stays quiet on what doesn't.

His output is what drives the **MX-4 Card** — a pinned insight card at the top of every section. The card has a tone:
- `positive` → green accent
- `caution` → amber accent
- `flag` → red accent

There's also a `● MX-4` status indicator in the top bar. When he's running, it pulses. He's always present in the UI — the app is as much his interface as mine.

---

**Design Inspiration**

We drew from several places when thinking about the direction:

- **Apple Health** — clean metric tiles, clear typography hierarchy, restrained use of color, nothing screaming at you
- **Garmin Connect** — data density done right; doesn't feel overwhelming, feels authoritative
- **Google Health / Material You** — the rounded card language, section accent colors, adaptive UI feel
- **MacroFactor** — adherence-neutral, no red shame numbers, elegant data presentation, the adaptive intelligence showing through in the UX
- **MacroFactor Workouts** — clean exercise logging UX, minimal but purposeful
- **Sparky Fitness** — open-source reference for food logging and Garmin integration patterns

None of these are exact targets. They're the cluster of references that shaped the direction: *premium dark health app, data-forward but not noisy, personality-driven but not gimmicky.*

---

**Current Structure**

The shell is complete. Everything is wired and working on-device. Here's what exists:

- **AppShell** — `position: fixed; inset: 0` layout (fixes iOS scroll bounce). The only scrollable zone is the content area between TopBar and BottomBar.
- **TopBar** — section label centered, 2px accent-color underline, `● MX-4` status right
- **BottomBar** — 2 pill tab buttons on the left (e.g. "Overview · Trends"), ☰ menu right
- **BottomSheet** — slides up from bottom, auto-height, shows profile header + navigation to 7 sections
- **MX4Card** — tone-colored left border card, generated timestamp, summary text, flag badges
- **MetricTile** — 2-column grid card, value + unit + label + optional progress bar + trend indicator

7 sections: **Home, Recovery, Training, Sleep, Nutrition, Blood Work, Daily Log**

Each section has its own accent color — these are keepers:

| Section | Accent |
|---|---|
| Home | `#4ade80` |
| Recovery | `#64b5f6` |
| Training | `#fb923c` |
| Sleep | `#a78bfa` |
| Nutrition | `#34d399` |
| Blood Work | `#f87171` |
| Daily Log | `#fbbf24` |

Current dark palette: Base `#0f1117` · Surface `#111827` · Elevated `#1e2d3d` · Border `#1e2d3d` · Text `#fff / #94a3b8 / #475569`

Dark mode only — always. There is no light mode and there never will be.

---

**What I want from you**

The skeleton is just scaffolding. Take this and make it look like a real, premium consumer health app with a Star Wars soul. The structure is right — the personality and polish are yours to define.

Some things I'd specifically love your take on:
- A design system that feels intentional — typography scale, spacing rhythm, card language
- TopBar and BottomBar treatment — they're always visible, they set the tone for the whole app
- MX-4 Card — this is the hero component. It should feel like it's from him, not just a generic card with a colored border
- MetricTile — premium but data-dense. Should feel closer to Apple Health tiles than a plain div
- The BottomSheet navigation — it slides up and shows my sections + profile. There's room for something genuinely nice here
- The `● MX-4` status indicator — small but meaningful. How does it look when he's active vs idle?

The emoji section icons (`🔋`, `💪`, `😴`, etc.) are placeholders. Replace them with whatever you think is right — clean glyphs, nothing, iconography that fits the aesthetic.

Give yourself room to push. This was always meant to land here.

---

I'll attach a screenshot of the current state alongside this message.
