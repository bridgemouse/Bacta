# Bacta — Tooling & Plugin Reference

## MCP Servers (Active)

Configured in `mx4/mcp-config.json` (for the MX-4 orchestrator) and `.claude/settings.local.json` (for Claude Code sessions).

### vault-query

**Purpose:** Read-only access to Ethan's Obsidian Vault wiki pages.  
**Implementation:** `mx4/vault_query_server.py` — local copy of the vault-query MCP server.  
**Environment:** `VAULT_WIKI_ROOT=/mnt/vault/wiki`  
**Tools:** `search_wiki`, `read_wiki_page`, `get_wiki_index`  
**Used by:** MX-4 orchestrator for personal context during briefing generation. Also available in Claude Code sessions (allowlisted in `.claude/settings.local.json`).

### bacta-db

**Purpose:** Read-only SQLite access to `garmin_snapshots` and `manual_inputs`.  
**Implementation:** `mx4/db_query_server.py` — local read-only SQLite MCP server. Write access is blocked at the server level.  
**Environment:** `DB_PATH=/opt/bacta/data/bacta.db`  
**Tools:**
- `list_metrics()` — returns all distinct metric names in `garmin_snapshots`
- `query_metric(metric, start_date, end_date)` — parameterized query for metric history
- `query_manual_inputs(start_date, end_date)` — query manual daily inputs

**Used by:** MX-4 orchestrator for deeper history beyond the pre-fetched 30-day window (e.g., 90 days of VO2max for trend projection).

---

## Claude Code Plugins

Installed globally and active in this project.

### Playwright MCP

**Purpose:** Browser automation and visual verification of the running app.  
**Invocation:** Used via `mcp__playwright__*` tool calls in Claude Code.  
**Key slash command:** `/run` — launches the app and takes screenshots for visual verification.

**Critical limitation for this project:** The app shell is `position: fixed; overflow: hidden`. Playwright's `fullPage` screenshot option only captures the viewport height, not scrolled content. To screenshot content below the fold, use `browser_evaluate` to set `scrollTop` on the scrollable content zone before screenshotting normally (without `fullPage`).

**When to use:** After implementing UI changes, before committing. Use `/run` to verify the golden path works visually. Screenshot multiple scroll positions if the change affects content below the fold.

### Figma MCP

**Purpose:** Design inspection and design-to-code sync.  
**Invocation:** Via `mcp__figma__*` tools or `/figma-*` slash commands.  
**Skills:** `/figma-use`, `/figma-generate-design`

**When to use vs. Claude Design:** If a design artifact already exists in Figma, use the Figma MCP to inspect it. For generating new designs (new sections, component explorations), use Claude Design (see below).

### Supabase MCP

**Purpose:** Supabase integration — not used in production. Available for dev tooling if needed.

### Context7

**Purpose:** Fetch current library documentation. Used when working with React 19, Vite, Express 5, better-sqlite3, or any library where version-specific behavior matters.  
**Invocation:** `/find-docs` skill or `npx ctx7@latest` CLI directly.

**When to use:** Any time a library API question comes up — especially React 19 (hooks API changed), Express 5 (subtle breaking changes from Express 4), Vite 8 (config API), better-sqlite3 (prepared statement API). Do not rely on training data for version-specific API details.

### Claude Mem

**Purpose:** Cross-session memory and codebase search. Indexes this project's code and maintains observations across sessions.  
**Invocation:** Skills like `/mem-search`, `/smart-explore`, `/smart-search`.

**Important caveat for this project:** Claude Mem may have indexed AZ-3 content from before MX-4 was established as the canonical persona. Cached observations may refer to AZ-3 behavior or the old system prompt. If MX-4 character drift occurs in a session, do not trust Claude Mem's cached context about MX-4's identity — re-read `mx4/mx4_personal_identity_record.md` directly from the filesystem.

**Useful for:** Finding where a specific API is called, tracing data flow through the codebase, understanding what was changed in past sessions. The observation timeline in Claude Mem is useful for understanding what changed and when.

### Superpowers Plugin

**Purpose:** Structured planning and execution workflows.  
**Skills:**
- `superpowers:brainstorming` — required before any creative work (new features, new components, new behavior). Explores user intent and requirements before implementation.
- `superpowers:writing-plans` — for multi-step implementation tasks. Produces a concrete plan before touching code.
- `superpowers:systematic-debugging` — before proposing fixes to any bug or unexpected behavior.
- `superpowers:verification-before-completion` — before marking work done.
- `superpowers:requesting-code-review` — before merging significant changes.

**When to use brainstorming:** Every time a user asks to "add X" or "build Y." The brainstorm step finds the real requirements and surfaces design decisions before implementation begins. Skipping it leads to implementation that needs to be redone.

### Feature Dev Plugin

**Purpose:** Guided feature development with codebase understanding and architecture focus.  
**Skill:** `/feature-dev:feature-dev`

### CLAUDE.md Revision Plugin

**Purpose:** Update CLAUDE.md with learnings from a development session.  
**Skill:** `/claude-md-management:revise-claude-md`

**Relation to this documentation:** This plugin updates `CLAUDE.md` based on session learnings. The longer-form documentation in `docs/` is maintained manually. When CLAUDE.md gets updated via the plugin, verify that any accent color values remain correct — the plugin has historically pulled in stale values from Claude Mem.

---

## Claude Design

Claude Design is an Anthropic Labs product (launched April 17, 2026, powered by Claude Opus 4.7). It generates interactive prototypes, design systems, and handoff packages that push directly to Claude Code. The entire Bacta visual system was designed in Claude Design before a line of production code was written.

**Bacta's Claude Design artifacts:**

| Session | Directory | Contents |
|---|---|---|
| Round 1 — Shell + Nav | `design_handoff_mx4_home/` | App shell, MX-4 sigil system, System Card grid, nav/ask sheets |
| Round 2 — Section Content | `design_handoff_bacta_sections/` | Recovery, Sleep, Training, Home section content; all viz components |

The interactive prototype at `design_handoff_bacta_sections/design/Bacta - Prototype.html` is the canonical visual reference. Open it in a browser to see the intended design for all four built sections in both Overview and Trends tabs.

**How to use Claude Design for new sections:**

When Nutrition, Blood Work, or Daily Log are ready to implement:

1. Open a Claude Design session (claude.ai or Claude Code with Claude Design)
2. Reference the existing `design_handoff_bacta_sections/` for the design system — provide the section accent color, the data types available, and the section's character
3. Claude Design generates an interactive prototype and handoff package
4. The handoff package pushes to Claude Code
5. Implement from the handoff in the existing codebase using `docs/DEVELOPMENT.md` patterns

Do not build a new section UI by looking at existing source code and extending it without a design reference. The visual system is precise — colors, spacing, component shapes, and information hierarchy were established in Claude Design and should be maintained through Claude Design.

---

## Slash Commands (Claude Code)

| Command | When to use |
|---|---|
| `/run` | After any UI change — launch the app and verify visually before committing |
| `/code-review` | Before merging significant changes — verify work meets requirements |
| `/code-review ultra` | Deep multi-agent cloud review for major features or PRs |
| `/find-docs` | Any library API question — fetch current docs before answering |
| `/mem-search` | Search Claude Mem's index for past session context |
| `/smart-explore` | Explore codebase structure for a specific feature or domain |
| `/verify` | Confirm a fix works by running the app and observing behavior |
| `/simplify` | Review changed code for reuse, simplification, and efficiency |

---

## Project Claude Code Settings

**`.claude/settings.local.json`** — project-level permissions for Claude Code sessions. Contains allowlisted domains and MCP tool permissions (vault-query, WebSearch, specific WebFetch domains).

This file is committed to the repo. It does not contain secrets — only permission rules.
