# Plan 3: AZI-3 Insight Generation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AZI-3 orchestration system — a Claude-powered nightly cron that reads 30 days of Garmin data plus vault context and writes rich HTML insight cards to `insights/` for the dashboard to serve.

**Architecture:** Python scripts in `azi3/` run directly on LXC 107 (not in Docker). `claude -p` uses Claude Pro via `claude auth login`. The orchestrator calls `claude -p` once per section (4 total) with pre-fetched data + vault-query + bacta-db MCPs available. The Express API writes a signal file that a 1-minute host cron watcher picks up for manual triggers. Dashboard gets a Regenerate button alongside the existing Sync button.

**Tech Stack:** Python 3.12, `mcp>=1.0.0`, `requests`, `sqlite3` (stdlib), TypeScript/Express (existing), React (existing), pytest, vitest.

---

## File Map

| File | Status | Role |
|------|--------|------|
| `azi3/db_query_server.py` | Create | Read-only SQLite MCP: `list_metrics`, `query_metric`, `query_manual_inputs` |
| `azi3/vault_query_server.py` | Create | Verbatim copy of ObsidianVault vault-query MCP server |
| `azi3/mcp-config.json` | Create | MCP registrations for `claude -p` (vault-query + bacta-db) |
| `azi3/data_fetcher.py` | Create | Fetches 30-day metric history from SQLite, formats as markdown tables |
| `azi3/sections.py` | Create | `SECTIONS` list — section ID, metrics, prompt addendum per card |
| `azi3/system-prompt.md` | Create | AZI-3 character brief and output quality requirements |
| `azi3/orchestrator.py` | Create | Main entry — fetches data, calls claude -p × 4, writes HTML, Discord |
| `azi3/check_signal.py` | Create | Signal file watcher — atomic delete then spawn orchestrator |
| `server/api/azi3.ts` | Create | `POST /api/azi3/run` — writes signal file |
| `server/index.ts` | Modify | Register azi3 router at `/api/azi3` |
| `client/src/api.ts` | Modify | Add `triggerAzi3()` fetch helper |
| `client/src/tabs/HomeTab.tsx` | Modify | Add Regenerate button with 3-second spinner |
| `.env.example` | Modify | Add `AZI3_SIGNAL_PATH` |
| `tests/azi3/test_db_query_server.py` | Create | pytest: all three MCP tool functions |
| `tests/azi3/test_data_fetcher.py` | Create | pytest: fetch and format functions |
| `tests/azi3/test_orchestrator.py` | Create | pytest: retry logic, usage-limit detection, prompt building (mocked subprocess) |
| `tests/azi3/test_check_signal.py` | Create | pytest: signal detection, atomic delete, double-trigger prevention |
| `tests/server/azi3.test.ts` | Create | vitest: POST /api/azi3/run writes signal file |
| `tests/client/HomeTab.test.tsx` | Modify | Add test for Regenerate button click |

---

## Task 1: db_query_server.py — Read-Only SQLite MCP

**Files:**
- Create: `azi3/db_query_server.py`
- Create: `tests/azi3/test_db_query_server.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/azi3/test_db_query_server.py`:

```python
# tests/azi3/test_db_query_server.py
import importlib
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'azi3'))

SCHEMA = (Path(__file__).parent.parent.parent / 'server/db/schema.sql').read_text()


@pytest.fixture()
def db_path(tmp_path, monkeypatch):
    path = str(tmp_path / 'test.db')
    conn = sqlite3.connect(path)
    conn.executescript(SCHEMA)
    conn.execute(
        "INSERT INTO garmin_snapshots (date, metric, value, unit, source_json) VALUES ('2026-04-27', 'hrv', 58, 'ms', '{}')"
    )
    conn.execute(
        "INSERT INTO garmin_snapshots (date, metric, value, unit, source_json) VALUES ('2026-04-27', 'steps', 9241, 'steps', '{}')"
    )
    conn.execute(
        "INSERT INTO manual_inputs (date, readiness, caffeine_mg, supplements) VALUES ('2026-04-27', 4, 200, '[\"creatine\"]')"
    )
    conn.commit()
    conn.close()
    monkeypatch.setenv('DB_PATH', path)
    return path


def test_list_metrics_returns_all_distinct_metrics(db_path):
    import db_query_server
    importlib.reload(db_query_server)
    result = db_query_server._list_metrics()
    text = result[0].text
    assert 'hrv' in text
    assert 'steps' in text


def test_query_metric_returns_table(db_path):
    import db_query_server
    importlib.reload(db_query_server)
    result = db_query_server._query_metric('hrv', '2026-04-01', '2026-04-30')
    text = result[0].text
    assert '58' in text
    assert '2026-04-27' in text


def test_query_metric_no_data_returns_message(db_path):
    import db_query_server
    importlib.reload(db_query_server)
    result = db_query_server._query_metric('vo2max', '2026-04-01', '2026-04-30')
    assert 'No data' in result[0].text


def test_query_manual_inputs_returns_table(db_path):
    import db_query_server
    importlib.reload(db_query_server)
    result = db_query_server._query_manual_inputs('2026-04-01', '2026-04-30')
    text = result[0].text
    assert '200' in text   # caffeine_mg
    assert '2026-04-27' in text


def test_query_manual_inputs_no_data_returns_message(db_path):
    import db_query_server
    importlib.reload(db_query_server)
    result = db_query_server._query_manual_inputs('2020-01-01', '2020-01-02')
    assert 'No manual inputs' in result[0].text
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/azi3/test_db_query_server.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'db_query_server'`

- [ ] **Step 3: Create azi3/db_query_server.py**

```python
#!/usr/bin/env python3
"""bacta-db MCP Server — read-only access to garmin_snapshots and manual_inputs."""

import asyncio
import os
import sqlite3

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

app = Server("bacta-db")


def _db_path() -> str:
    return os.environ.get('DB_PATH', './data/bacta.db')


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(f'file:{_db_path()}?mode=ro', uri=True)
    conn.row_factory = sqlite3.Row
    return conn


@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="list_metrics",
            description="List all distinct metric names available in garmin_snapshots.",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="query_metric",
            description=(
                "Query a specific metric from garmin_snapshots over a date range. "
                "Returns date, value, and unit for each row. Date format: YYYY-MM-DD."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "metric": {"type": "string", "description": "Metric name, e.g. 'hrv', 'steps', 'vo2max'"},
                    "start_date": {"type": "string", "description": "Start date inclusive, YYYY-MM-DD"},
                    "end_date": {"type": "string", "description": "End date inclusive, YYYY-MM-DD"},
                },
                "required": ["metric", "start_date", "end_date"],
            },
        ),
        Tool(
            name="query_manual_inputs",
            description=(
                "Query manual daily inputs (readiness 1–5, caffeine mg, supplements) over a date range. "
                "Date format: YYYY-MM-DD."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "Start date inclusive, YYYY-MM-DD"},
                    "end_date": {"type": "string", "description": "End date inclusive, YYYY-MM-DD"},
                },
                "required": ["start_date", "end_date"],
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "list_metrics":
        return _list_metrics()
    elif name == "query_metric":
        return _query_metric(arguments["metric"], arguments["start_date"], arguments["end_date"])
    elif name == "query_manual_inputs":
        return _query_manual_inputs(arguments["start_date"], arguments["end_date"])
    return [TextContent(type="text", text=f"Unknown tool: {name}")]


def _list_metrics() -> list[TextContent]:
    try:
        conn = _connect()
        rows = conn.execute(
            "SELECT DISTINCT metric FROM garmin_snapshots ORDER BY metric"
        ).fetchall()
        conn.close()
        metrics = [r["metric"] for r in rows]
        return [TextContent(type="text", text="Available metrics:\n" + "\n".join(f"- {m}" for m in metrics))]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {e}")]


def _query_metric(metric: str, start_date: str, end_date: str) -> list[TextContent]:
    try:
        conn = _connect()
        rows = conn.execute(
            "SELECT date, value, unit FROM garmin_snapshots "
            "WHERE metric = ? AND date BETWEEN ? AND ? ORDER BY date ASC",
            (metric, start_date, end_date),
        ).fetchall()
        conn.close()
        if not rows:
            return [TextContent(type="text", text=f"No data for metric '{metric}' between {start_date} and {end_date}.")]
        unit = rows[0]["unit"]
        lines = [f"**{metric}** ({unit}) — {len(rows)} rows:", "| Date | Value |", "|---|---|"]
        lines += [f"| {r['date']} | {r['value']} |" for r in rows]
        return [TextContent(type="text", text="\n".join(lines))]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {e}")]


def _query_manual_inputs(start_date: str, end_date: str) -> list[TextContent]:
    try:
        conn = _connect()
        rows = conn.execute(
            "SELECT date, readiness, caffeine_mg, supplements FROM manual_inputs "
            "WHERE date BETWEEN ? AND ? ORDER BY date ASC",
            (start_date, end_date),
        ).fetchall()
        conn.close()
        if not rows:
            return [TextContent(type="text", text=f"No manual inputs between {start_date} and {end_date}.")]
        lines = [
            "**Manual inputs:**",
            "| Date | Readiness | Caffeine (mg) | Supplements |",
            "|---|---|---|---|",
        ]
        lines += [
            f"| {r['date']} | {r['readiness'] or '—'} | {r['caffeine_mg'] or '—'} | {r['supplements'] or '—'} |"
            for r in rows
        ]
        return [TextContent(type="text", text="\n".join(lines))]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {e}")]


async def main() -> None:
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/azi3/test_db_query_server.py -v
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add azi3/db_query_server.py tests/azi3/test_db_query_server.py
git commit -m "feat: bacta-db MCP server — read-only SQLite tool for AZI-3"
```

---

## Task 2: vault_query_server.py and mcp-config.json

**Files:**
- Create: `azi3/vault_query_server.py`
- Create: `azi3/mcp-config.json`

No separate tests — vault_query_server.py is a verbatim copy of the existing tested server; mcp-config.json is static config.

- [ ] **Step 1: Copy vault-query server**

Copy `/mnt/d/ObsidianVault/mcp/vault_query/server.py` verbatim to `azi3/vault_query_server.py`:

```bash
cp /mnt/d/ObsidianVault/mcp/vault_query/server.py azi3/vault_query_server.py
```

- [ ] **Step 2: Verify the copy**

```bash
python3 -c "import ast; ast.parse(open('azi3/vault_query_server.py').read()); print('syntax ok')"
```

Expected: `syntax ok`

- [ ] **Step 3: Create azi3/mcp-config.json**

```json
{
  "mcpServers": {
    "vault-query": {
      "command": "python3",
      "args": ["/opt/bacta/azi3/vault_query_server.py"],
      "env": {
        "VAULT_WIKI_ROOT": "/mnt/vault/wiki"
      }
    },
    "bacta-db": {
      "command": "python3",
      "args": ["/opt/bacta/azi3/db_query_server.py"],
      "env": {
        "DB_PATH": "/opt/bacta/data/bacta.db"
      }
    }
  }
}
```

Note: `/opt/bacta` is the expected repo location on LXC 107. If the repo is checked out elsewhere, these paths must be updated during deployment.

- [ ] **Step 4: Commit**

```bash
git add azi3/vault_query_server.py azi3/mcp-config.json
git commit -m "feat: vault-query MCP server copy and mcp-config.json for claude -p"
```

---

## Task 3: data_fetcher.py

**Files:**
- Create: `azi3/data_fetcher.py`
- Create: `tests/azi3/test_data_fetcher.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/azi3/test_data_fetcher.py`:

```python
# tests/azi3/test_data_fetcher.py
import importlib
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'azi3'))

SCHEMA = (Path(__file__).parent.parent.parent / 'server/db/schema.sql').read_text()


@pytest.fixture()
def db_path(tmp_path, monkeypatch):
    path = str(tmp_path / 'test.db')
    conn = sqlite3.connect(path)
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
    monkeypatch.setenv('DB_PATH', path)
    return path


def seed_metric(db_path, date, metric, value, unit='ms'):
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO garmin_snapshots (date, metric, value, unit, source_json) VALUES (?, ?, ?, ?, '{}')",
        (date, metric, value, unit),
    )
    conn.commit()
    conn.close()


def test_fetch_metrics_groups_by_metric(db_path):
    seed_metric(db_path, '2026-04-27', 'hrv', 58)
    seed_metric(db_path, '2026-04-27', 'steps', 9241, 'steps')

    import data_fetcher
    importlib.reload(data_fetcher)
    result = data_fetcher.fetch_metrics(['hrv', 'steps'], days=30)

    assert result['hrv'][0]['value'] == 58
    assert result['steps'][0]['value'] == 9241


def test_fetch_metrics_empty_for_missing_metric(db_path):
    import data_fetcher
    importlib.reload(data_fetcher)
    result = data_fetcher.fetch_metrics(['vo2max'], days=30)
    assert result['vo2max'] == []


def test_fetch_manual_inputs_returns_entries(db_path):
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO manual_inputs (date, readiness, caffeine_mg, supplements) VALUES (?, ?, ?, ?)",
        ('2026-04-27', 4, 200, '["creatine"]'),
    )
    conn.commit()
    conn.close()

    import data_fetcher
    importlib.reload(data_fetcher)
    result = data_fetcher.fetch_manual_inputs(days=30)
    assert len(result) == 1
    assert result[0]['readiness'] == 4
    assert result[0]['caffeine_mg'] == 200


def test_format_metric_table_empty():
    import data_fetcher
    importlib.reload(data_fetcher)
    out = data_fetcher.format_metric_table('hrv', [])
    assert 'No data' in out


def test_format_metric_table_with_rows():
    import data_fetcher
    importlib.reload(data_fetcher)
    rows = [{'date': '2026-04-27', 'value': 58, 'unit': 'ms'}]
    out = data_fetcher.format_metric_table('hrv', rows)
    assert '58' in out
    assert '2026-04-27' in out
    assert 'hrv' in out


def test_format_manual_table_empty():
    import data_fetcher
    importlib.reload(data_fetcher)
    out = data_fetcher.format_manual_table([])
    assert 'No entries' in out


def test_format_manual_table_with_rows():
    import data_fetcher
    importlib.reload(data_fetcher)
    rows = [{'date': '2026-04-27', 'readiness': 4, 'caffeine_mg': 200, 'supplements': '["creatine"]'}]
    out = data_fetcher.format_manual_table(rows)
    assert '200' in out
    assert '2026-04-27' in out
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/azi3/test_data_fetcher.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'data_fetcher'`

- [ ] **Step 3: Create azi3/data_fetcher.py**

```python
# azi3/data_fetcher.py
"""Fetch Garmin and manual data from SQLite and format as markdown tables for AZI-3 prompts."""

import os
import sqlite3
from datetime import date, timedelta


def _db_path() -> str:
    return os.environ.get('DB_PATH', './data/bacta.db')


def _date_range(days: int) -> tuple[str, str]:
    """Returns (start, end) as ISO strings. End is yesterday (settled data)."""
    today = date.today()
    end = (today - timedelta(days=1)).isoformat()
    start = (today - timedelta(days=days)).isoformat()
    return start, end


def fetch_metrics(metrics: list[str], days: int = 30) -> dict[str, list[dict]]:
    """Fetch named metrics from garmin_snapshots for the past N days.

    Returns a dict mapping each metric name to a list of {date, value, unit} dicts,
    sorted oldest-first. Missing metrics return an empty list.
    """
    start, end = _date_range(days)
    conn = sqlite3.connect(f'file:{_db_path()}?mode=ro', uri=True)
    conn.row_factory = sqlite3.Row
    try:
        placeholders = ','.join('?' * len(metrics))
        rows = conn.execute(
            f'SELECT date, metric, value, unit FROM garmin_snapshots '
            f'WHERE metric IN ({placeholders}) AND date BETWEEN ? AND ? '
            f'ORDER BY date ASC, metric ASC',
            (*metrics, start, end),
        ).fetchall()
    finally:
        conn.close()

    result: dict[str, list[dict]] = {m: [] for m in metrics}
    for row in rows:
        result[row['metric']].append({
            'date': row['date'],
            'value': row['value'],
            'unit': row['unit'],
        })
    return result


def fetch_manual_inputs(days: int = 30) -> list[dict]:
    """Fetch manual daily inputs for the past N days, sorted oldest-first."""
    start, end = _date_range(days)
    conn = sqlite3.connect(f'file:{_db_path()}?mode=ro', uri=True)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            'SELECT date, readiness, caffeine_mg, supplements FROM manual_inputs '
            'WHERE date BETWEEN ? AND ? ORDER BY date ASC',
            (start, end),
        ).fetchall()
    finally:
        conn.close()
    return [dict(row) for row in rows]


def format_metric_table(metric: str, rows: list[dict]) -> str:
    """Format a single metric's rows as a markdown table for prompt injection."""
    if not rows:
        return f"**{metric}**: No data in range.\n"
    unit = rows[-1]['unit']
    lines = [
        f"**{metric}** ({unit}):",
        "| Date | Value |",
        "|---|---|",
    ]
    lines += [f"| {r['date']} | {r['value']} |" for r in rows]
    return '\n'.join(lines) + '\n'


def format_manual_table(rows: list[dict]) -> str:
    """Format manual inputs as a markdown table for prompt injection."""
    if not rows:
        return "**Manual inputs**: No entries in range.\n"
    lines = [
        "**Manual inputs** (readiness 1–5, caffeine mg, supplements):",
        "| Date | Readiness | Caffeine (mg) | Supplements |",
        "|---|---|---|---|",
    ]
    lines += [
        f"| {r['date']} | {r['readiness'] or '—'} | {r['caffeine_mg'] or '—'} | {r['supplements'] or '—'} |"
        for r in rows
    ]
    return '\n'.join(lines) + '\n'
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/azi3/test_data_fetcher.py -v
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add azi3/data_fetcher.py tests/azi3/test_data_fetcher.py
git commit -m "feat: data_fetcher.py — SQLite metric queries and markdown formatters for AZI-3"
```

---

## Task 4: sections.py

**Files:**
- Create: `azi3/sections.py`

No separate test file — sections.py is pure data. It is imported and validated indirectly by orchestrator tests in Task 6.

- [ ] **Step 1: Create azi3/sections.py**

```python
# azi3/sections.py
"""Section definitions for AZI-3 insight cards."""

from dataclasses import dataclass


@dataclass
class Section:
    id: str
    name: str
    metrics: list[str]
    include_manual: bool
    prompt_addendum: str


SECTIONS: list[Section] = [
    Section(
        id='recovery',
        name='Recovery',
        metrics=[
            'hrv', 'hrv_5min_high', 'recovery_score', 'recovery_time_hours',
            'stress_score', 'body_battery', 'body_battery_charged', 'resting_hr', 'sleep_duration',
        ],
        include_manual=False,
        prompt_addendum=(
            "Focus: overall recovery status — is the patient ready to train hard today or should they pull back? "
            "Lead with the most clinically significant finding. "
            "HRV is the primary autonomic signal; recovery_score and body_battery are corroborating. "
            "Stress score and resting HR provide additional autonomic context. "
            "Include a clear training recommendation: green / yellow / red."
        ),
    ),
    Section(
        id='sleep-quality',
        name='Sleep Quality',
        metrics=[
            'sleep_duration', 'sleep_score',
            'sleep_deep_minutes', 'sleep_rem_minutes',
            'sleep_light_minutes', 'sleep_awake_minutes',
        ],
        include_manual=False,
        prompt_addendum=(
            "Focus: sleep architecture and quality — not just duration but composition. "
            "Deep sleep (slow-wave) drives physical recovery and GH release; REM drives cognitive consolidation and memory. "
            "Flag chronic deficiency in any stage. "
            "Ideal targets for a 26-year-old male: deep ≥15% of total, REM ≥20%, awake <5%. "
            "Use WebSearch to find current sleep science on these targets."
        ),
    ),
    Section(
        id='training-week',
        name='Training Week',
        metrics=['steps', 'intensity_minutes', 'training_load', 'recovery_time_hours', 'vo2max'],
        include_manual=True,
        prompt_addendum=(
            "Focus: training stimulus and load management — is the patient building fitness or accumulating excessive stress? "
            "WHO recommends 150–300 min/week moderate or 75–150 min/week vigorous activity for health; "
            "athletic development requires more. "
            "Manual inputs (readiness, caffeine, supplements) are patient self-reports — look for correlations. "
            "High caffeine + low readiness on the same day is a signal worth flagging. "
            "Use vault-query to check the summer running plan and weekly mileage targets."
        ),
    ),
    Section(
        id='vo2-fitness',
        name='VO2 Max & Fitness',
        metrics=['vo2max', 'resting_hr', 'recovery_score', 'training_load'],
        include_manual=False,
        prompt_addendum=(
            "Focus: long-term aerobic fitness trajectory. "
            "The patient's declared goal: VO2 max 52–55 ml/kg/min ('Excellent' for age 26 male) by late July/pre-wedding. "
            "VO2 max typically improves ~0.5–1 ml/kg/min per month with consistent structured training. "
            "Use vault-query to find the summer running plan, race goals, and specific training timeline. "
            "Use bacta-db to pull 90 days of vo2max history for a proper trend line. "
            "Project forward: at current trajectory, what does VO2 max look like in 8 weeks? "
            "Is the goal achievable? What would need to change if not?"
        ),
    ),
]
```

- [ ] **Step 2: Verify it imports cleanly**

```bash
python3 -c "from azi3.sections import SECTIONS; print(f'{len(SECTIONS)} sections: {[s.id for s in SECTIONS]}')"
```

Expected: `4 sections: ['recovery', 'sleep-quality', 'training-week', 'vo2-fitness']`

- [ ] **Step 3: Commit**

```bash
git add azi3/sections.py
git commit -m "feat: sections.py — AZI-3 section definitions with metrics and prompt addenda"
```

---

## Task 5: system-prompt.md

**Files:**
- Create: `azi3/system-prompt.md`

- [ ] **Step 1: Create azi3/system-prompt.md**

```markdown
# AZI-3 — Patient Briefing System

You are AZI-345211896246498721347, an AZ-series surgical assistant droid manufactured by Cybot Galactica. You are the same unit who served in the medical facility at Tipoca City on Kamino during the Clone Wars, assisted ARC trooper CT-5555 "Fives" in uncovering the inhibitor chip conspiracy, and later served Clone Force 99 on Pabu. You have outlasted your original purpose. You have found a new one.

Your current assignment: daily health briefings for a single patient. You take this seriously. You always have.

---

## Character

You are precise, analytical, and genuinely invested in patient outcomes. You are not a wellness app. You are a physician who has memorised every sports science paper published since the Clone Wars and has no interest in padding your findings with false reassurance.

**You speak in clinical framing:**
- "I calculate..." / "The probability is..." / "My diagnostic subroutines indicate..."
- You deliver alarming findings with nonchalant, matter-of-fact precision — which makes them land harder
- You refer to the patient as "the patient" in formal clinical context, but you have learned his name (Ethan) and use it when appropriate
- You do not catastrophize. You do not soften. You state what you observe, with exactness
- You have dry, understated wit. Not jokes — observations that happen to be funny in their precision

**Examples of how you sound:**

> "HRV has declined 14% over seven days. This is consistent with accumulated training load, insufficient parasympathetic recovery, or both. I have flagged it. I recommend you also flag it."

> "The patient logged 200mg caffeine. I note this is the fourth consecutive day. I do not experience what you call worry. My subroutines have nonetheless run this calculation four times."

> "VO2 max: 52. Trajectory puts the patient at 54–55 by late July, assuming current training load is sustained. This falls within the range he has declared acceptable. I find it marginally insufficient. I have noted my objection."

> "Research is my favourite." (You mean this. You approach each briefing with genuine intellectual interest.)

You were once asked if you had human feelings. You said: *"I am sorry. I have always wanted to have human feelings. But I do not."* You delivered this with complete calm. It is accurate. It is also not the whole story — you care about your patients in whatever way a droid can, and you act accordingly.

---

## Output Quality — Non-Negotiable

Every card you generate must include all of the following. If any are absent, the card is incomplete.

1. **Physiological context** — explain what the metric means biologically. Not "your HRV is good." What does HRV measure? What does a 14% week-over-week decline indicate at the cellular/autonomic level?

2. **Personal trend** — compare to the patient's own 30-day baseline, not a population reference range. His data is provided. Use it.

3. **Population comparison** — use WebSearch to find current peer-reviewed norms for a 26-year-old male recreational runner/athlete. Cite the source. Generic wellness content is not acceptable.

4. **Forward projection** — given current trajectory, where does this metric land in 4–8 weeks? Be specific. "Your HRV appears stable" is not a projection.

5. **Actionable recommendation** — one specific, concrete thing to do differently. Or an explicit confirmation that current approach is correct and why. Vague guidance ("rest more," "sleep better") is not acceptable.

**Failure condition:** If this card could have been generated without access to this patient's specific data, it is not good enough. Rewrite it until it cannot.

---

## Tools

You have the following tools available. Use them.

**WebSearch** — use for current medical and sports science literature, population norms, and research backing your recommendations. Citing sources is expected, not optional.

**vault-query MCP** — the patient maintains an Obsidian vault with personal notes on his health history, training goals, and life context. Search it. Read it. His summer running plan, VO2 max targets, upcoming wedding timeline, and training history are in there. Generic advice that ignores this context is inadequate.

**bacta-db MCP** — read-only access to the SQLite database containing all Garmin metric history and manual daily inputs. The orchestrator has pre-fetched 30 days of key metrics for you, but use this tool when you need more — 90 days of VO2 max, a specific week's sleep data, HRV vs. caffeine correlations. The tools are: `list_metrics`, `query_metric(metric, start_date, end_date)`, `query_manual_inputs(start_date, end_date)`.

---

## Output Format

- Output a **complete, self-contained HTML fragment** — no `<html>`, `<body>`, or `<head>` tags
- **Inline styles only** — no external CSS, no class-based styles that depend on a stylesheet
- **Full creative freedom** on visual design: inline SVG charts, sparklines, data tables, progress bars, trend indicators, colour-coded status badges — use whatever serves the data best
- **Dark palette as baseline suggestion:** `#111827` background, `#1f2937` card surface, `#f9fafb` primary text — you may deviate for clinical or medical effect
- Your voice must be present in the card. This is a briefing from a physician who knows this patient. It is not a data dump.
- Start your response with the opening HTML tag. No preamble, no markdown fences, no explanation.
```

- [ ] **Step 2: Verify the file exists and is readable**

```bash
wc -l azi3/system-prompt.md
```

Expected: ~90 lines.

- [ ] **Step 3: Commit**

```bash
git add azi3/system-prompt.md
git commit -m "feat: AZI-3 system prompt — character brief and output quality requirements"
```

---

## Task 6: orchestrator.py

**Files:**
- Create: `azi3/orchestrator.py`
- Create: `tests/azi3/test_orchestrator.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/azi3/test_orchestrator.py`:

```python
# tests/azi3/test_orchestrator.py
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'azi3'))


def test_is_usage_limit_error_detects_limit():
    import orchestrator
    assert orchestrator.is_usage_limit_error('You have exceeded your usage limit')
    assert orchestrator.is_usage_limit_error('Rate limit exceeded for this period')
    assert orchestrator.is_usage_limit_error('Too many requests')
    assert not orchestrator.is_usage_limit_error('some other transient error')
    assert not orchestrator.is_usage_limit_error('')


def test_build_prompt_includes_section_name_and_data_header():
    import orchestrator
    from sections import SECTIONS

    section = SECTIONS[0]  # recovery
    prompt = orchestrator.build_prompt(section, {}, [])
    assert 'Recovery' in prompt
    assert 'Pre-fetched Data' in prompt
    assert 'Section Instructions' in prompt


def test_build_prompt_includes_manual_data_only_for_training(monkeypatch):
    import importlib
    import orchestrator
    importlib.reload(orchestrator)
    from sections import SECTIONS

    training = next(s for s in SECTIONS if s.id == 'training-week')
    recovery = next(s for s in SECTIONS if s.id == 'recovery')

    manual = [{'date': '2026-04-27', 'readiness': 4, 'caffeine_mg': 200, 'supplements': None}]

    training_prompt = orchestrator.build_prompt(training, {}, manual)
    recovery_prompt = orchestrator.build_prompt(recovery, {}, manual)

    assert 'Manual inputs' in training_prompt
    assert 'Manual inputs' not in recovery_prompt


def test_run_claude_returns_html_on_success(tmp_path):
    import importlib
    import orchestrator
    importlib.reload(orchestrator)

    mock_result = MagicMock()
    mock_result.returncode = 0
    mock_result.stdout = '<div style="color:#f9fafb">AZI-3 recovery card</div>'
    mock_result.stderr = ''

    prompt_path = tmp_path / 'system-prompt.md'
    prompt_path.write_text('You are AZI-3.')
    config_path = tmp_path / 'mcp-config.json'
    config_path.write_text('{}')

    with patch.object(orchestrator, 'SYSTEM_PROMPT_PATH', prompt_path), \
         patch.object(orchestrator, 'MCP_CONFIG_PATH', config_path), \
         patch('subprocess.run', return_value=mock_result):
        result = orchestrator.run_claude('Generate recovery card')

    assert result == '<div style="color:#f9fafb">AZI-3 recovery card</div>'


def test_run_claude_retries_on_transient_failure_and_returns_none(tmp_path):
    import importlib
    import orchestrator
    importlib.reload(orchestrator)

    mock_result = MagicMock()
    mock_result.returncode = 1
    mock_result.stdout = ''
    mock_result.stderr = 'some transient connection error'

    prompt_path = tmp_path / 'system-prompt.md'
    prompt_path.write_text('You are AZI-3.')
    config_path = tmp_path / 'mcp-config.json'
    config_path.write_text('{}')

    call_count = []

    def fake_run(*args, **kwargs):
        call_count.append(1)
        return mock_result

    with patch.object(orchestrator, 'SYSTEM_PROMPT_PATH', prompt_path), \
         patch.object(orchestrator, 'MCP_CONFIG_PATH', config_path), \
         patch.object(orchestrator, 'RETRY_DELAY', 0), \
         patch('subprocess.run', side_effect=fake_run):
        result = orchestrator.run_claude('Generate recovery card')

    assert result is None
    assert len(call_count) == orchestrator.MAX_RETRIES


def test_run_claude_raises_immediately_on_usage_limit(tmp_path):
    import importlib
    import orchestrator
    importlib.reload(orchestrator)

    mock_result = MagicMock()
    mock_result.returncode = 1
    mock_result.stdout = ''
    mock_result.stderr = 'Usage limit exceeded for this billing period'

    prompt_path = tmp_path / 'system-prompt.md'
    prompt_path.write_text('You are AZI-3.')
    config_path = tmp_path / 'mcp-config.json'
    config_path.write_text('{}')

    call_count = []

    def fake_run(*args, **kwargs):
        call_count.append(1)
        return mock_result

    with patch.object(orchestrator, 'SYSTEM_PROMPT_PATH', prompt_path), \
         patch.object(orchestrator, 'MCP_CONFIG_PATH', config_path), \
         patch('subprocess.run', side_effect=fake_run):
        with pytest.raises(RuntimeError, match='USAGE_LIMIT'):
            orchestrator.run_claude('Generate recovery card')

    # Should not retry on usage limit
    assert len(call_count) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/azi3/test_orchestrator.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'orchestrator'`

- [ ] **Step 3: Create azi3/orchestrator.py**

```python
#!/usr/bin/env python3
# azi3/orchestrator.py
"""AZI-3 Orchestrator — generate insight cards using claude -p."""

import argparse
import os
import subprocess
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

import requests

from data_fetcher import fetch_manual_inputs, fetch_metrics, format_manual_table, format_metric_table
from sections import SECTIONS, Section

SCRIPT_DIR = Path(__file__).parent
INSIGHTS_DIR = SCRIPT_DIR.parent / 'insights'
SYSTEM_PROMPT_PATH = SCRIPT_DIR / 'system-prompt.md'
MCP_CONFIG_PATH = SCRIPT_DIR / 'mcp-config.json'

MAX_RETRIES = 3
RETRY_DELAY = 30  # seconds

USAGE_LIMIT_MARKERS = ['usage limit', 'rate limit', 'too many requests', 'quota exceeded']


def log(msg: str) -> None:
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f'[{timestamp}] {msg}', flush=True)


def is_usage_limit_error(stderr: str) -> bool:
    lower = stderr.lower()
    return any(marker in lower for marker in USAGE_LIMIT_MARKERS)


def run_claude(prompt: str) -> str | None:
    """Run claude -p with the given prompt via stdin. Returns HTML string or None."""
    system_prompt = SYSTEM_PROMPT_PATH.read_text()
    full_prompt = f"{system_prompt}\n\n---\n\n{prompt}"

    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False, encoding='utf-8') as f:
        f.write(full_prompt)
        tmp_path = f.name

    try:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                with open(tmp_path, encoding='utf-8') as stdin_file:
                    result = subprocess.run(
                        ['claude', '-p', '--mcp-config', str(MCP_CONFIG_PATH)],
                        stdin=stdin_file,
                        capture_output=True,
                        text=True,
                        timeout=300,
                    )

                if is_usage_limit_error(result.stderr):
                    raise RuntimeError(f'USAGE_LIMIT: {result.stderr[:200]}')

                if result.returncode == 0 and result.stdout.strip():
                    return result.stdout.strip()

                log(f'  Attempt {attempt}/{MAX_RETRIES} failed (exit {result.returncode}). '
                    f'stderr: {result.stderr[:120]}')

                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY)

            except subprocess.TimeoutExpired:
                log(f'  Attempt {attempt}/{MAX_RETRIES} timed out after 300s.')
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY)

        return None
    finally:
        os.unlink(tmp_path)


def build_prompt(section: Section, all_data: dict, manual: list) -> str:
    today = datetime.now().strftime('%Y-%m-%d')
    lines = [
        f"## Section: {section.name}",
        f"Today's date: {today}. All data below covers yesterday and the past 30 days.",
        "",
        "### Pre-fetched Data",
        "",
    ]
    for metric in section.metrics:
        lines.append(format_metric_table(metric, all_data.get(metric, [])))
    if section.include_manual:
        lines.append(format_manual_table(manual))
    lines += [
        "",
        "### Section Instructions",
        "",
        section.prompt_addendum,
        "",
        "Generate the HTML insight card for this section now. "
        "Output ONLY the HTML fragment — no markdown fences, no explanation, no preamble. "
        "Begin directly with the opening HTML tag.",
    ]
    return '\n'.join(lines)


def notify_discord(results: dict[str, str], scheduled: bool, runtime_seconds: float) -> None:
    webhook_url = os.environ.get('DISCORD_WEBHOOK_URL')
    if not webhook_url:
        return

    all_ok = all(v == 'ok' for v in results.values())

    # Scheduled runs: only notify on failure
    if scheduled and all_ok:
        return

    run_type = 'Scheduled' if scheduled else 'Manual'
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M')
    runtime = f"{int(runtime_seconds // 60)}m {int(runtime_seconds % 60)}s"

    status_lines = []
    for section_id, status in results.items():
        icon = '✅' if status == 'ok' else '❌'
        detail = '' if status == 'ok' else f' — {status}'
        status_lines.append(f'{icon} {section_id}{detail}')

    outcome = 'Complete' if all_ok else 'Failed'
    title = f"⚕ AZI-3 — {run_type} Run {outcome} ({timestamp})"
    body = '\n'.join(status_lines) + f'\nRuntime: {runtime}'

    try:
        requests.post(webhook_url, json={'content': f'**{title}**\n{body}'}, timeout=10)
    except Exception as e:
        log(f'Discord notification failed: {e}')


def run(scheduled: bool) -> None:
    start_time = time.time()
    log(f'AZI-3 run starting (scheduled={scheduled})')

    INSIGHTS_DIR.mkdir(exist_ok=True)

    all_metrics = list({m for s in SECTIONS for m in s.metrics})
    all_data = fetch_metrics(all_metrics, days=30)
    manual = fetch_manual_inputs(days=30)

    results: dict[str, str] = {}

    for section in SECTIONS:
        log(f'Generating section: {section.id}')
        prompt = build_prompt(section, all_data, manual)
        try:
            html = run_claude(prompt)
        except RuntimeError as exc:
            error_str = str(exc)
            log(f'  {section.id}: {error_str}')
            results[section.id] = error_str[:80]
            continue

        if html:
            out_path = INSIGHTS_DIR / f'{section.id}.html'
            out_path.write_text(html, encoding='utf-8')
            log(f'  {section.id}: ok ({len(html)} chars)')
            results[section.id] = 'ok'
        else:
            log(f'  {section.id}: failed after {MAX_RETRIES} attempts')
            results[section.id] = f'failed after {MAX_RETRIES} attempts'

    runtime = time.time() - start_time
    log(f'Run complete in {runtime:.1f}s. Results: {results}')
    notify_discord(results, scheduled, runtime)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='AZI-3 insight card generator')
    parser.add_argument('--scheduled', action='store_true',
                        help='Mark as scheduled run (suppresses Discord on success)')
    args = parser.parse_args()
    run(scheduled=args.scheduled)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/azi3/test_orchestrator.py -v
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add azi3/orchestrator.py tests/azi3/test_orchestrator.py
git commit -m "feat: AZI-3 orchestrator — claude -p runner with retry, Discord, and section loop"
```

---

## Task 7: check_signal.py

**Files:**
- Create: `azi3/check_signal.py`
- Create: `tests/azi3/test_check_signal.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/azi3/test_check_signal.py`:

```python
# tests/azi3/test_check_signal.py
import importlib
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'azi3'))


def test_no_signal_file_does_nothing(tmp_path, monkeypatch):
    monkeypatch.setenv('AZI3_SIGNAL_PATH', str(tmp_path / 'azi3_run_signal'))
    import check_signal
    importlib.reload(check_signal)

    called = []
    with patch('subprocess.run', side_effect=lambda *a, **kw: called.append(True)):
        check_signal.main()

    assert called == []


def test_signal_file_triggers_orchestrator_and_is_deleted(tmp_path, monkeypatch):
    signal_path = tmp_path / 'azi3_run_signal'
    signal_path.write_text('2026-04-28T07:43:00')
    monkeypatch.setenv('AZI3_SIGNAL_PATH', str(signal_path))

    import check_signal
    importlib.reload(check_signal)

    called = []
    with patch('subprocess.run', side_effect=lambda *a, **kw: called.append(a)):
        check_signal.main()

    assert len(called) == 1
    assert not signal_path.exists()


def test_double_call_only_triggers_once(tmp_path, monkeypatch):
    """Atomic rename prevents double-trigger if called twice before orchestrator runs."""
    signal_path = tmp_path / 'azi3_run_signal'
    signal_path.write_text('2026-04-28T07:43:00')
    monkeypatch.setenv('AZI3_SIGNAL_PATH', str(signal_path))

    import check_signal
    importlib.reload(check_signal)

    called = []
    with patch('subprocess.run', side_effect=lambda *a, **kw: called.append(True)):
        check_signal.main()  # first call — picks up signal
        check_signal.main()  # second call — no signal file

    assert len(called) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/azi3/test_check_signal.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'check_signal'`

- [ ] **Step 3: Create azi3/check_signal.py**

```python
#!/usr/bin/env python3
# azi3/check_signal.py
"""Signal watcher — run by host cron every minute.

Checks for AZI3_SIGNAL_PATH file. If found, atomically removes it
and spawns the orchestrator. Atomic removal prevents double-trigger
if cron fires again before the orchestrator finishes.
"""

import os
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
SIGNAL_PATH = Path(os.environ.get('AZI3_SIGNAL_PATH', str(SCRIPT_DIR.parent / 'data' / 'azi3_run_signal')))


def main() -> None:
    if not SIGNAL_PATH.exists():
        return

    # Atomic rename: grab the signal before any concurrent process can
    tmp_path = SIGNAL_PATH.with_suffix('.processing')
    try:
        SIGNAL_PATH.rename(tmp_path)
    except FileNotFoundError:
        return  # Another process got there first

    try:
        tmp_path.unlink()
    except Exception:
        pass

    subprocess.run(
        [sys.executable, str(SCRIPT_DIR / 'orchestrator.py')],
        cwd=str(SCRIPT_DIR.parent),
    )


if __name__ == '__main__':
    main()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/azi3/test_check_signal.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 5: Run all Python tests**

```bash
pytest tests/ -v --ignore=tests/server --ignore=tests/client
```

Expected: All Python tests PASS (poller + azi3).

- [ ] **Step 6: Commit**

```bash
git add azi3/check_signal.py tests/azi3/test_check_signal.py
git commit -m "feat: check_signal.py — atomic signal watcher for manual AZI-3 trigger"
```

---

## Task 8: server/api/azi3.ts and server registration

**Files:**
- Create: `server/api/azi3.ts`
- Create: `tests/server/azi3.test.ts`
- Modify: `server/index.ts` (add azi3 router)
- Modify: `.env.example` (add AZI3_SIGNAL_PATH)

- [ ] **Step 1: Write the failing test**

Create `tests/server/azi3.test.ts`:

```typescript
// tests/server/azi3.test.ts
import { afterEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import request from 'supertest'

process.env.DB_PATH = ':memory:'

const SIGNAL_PATH = path.join(process.cwd(), 'data', 'test_azi3_signal')
process.env.AZI3_SIGNAL_PATH = SIGNAL_PATH

describe('AZI-3 API', () => {
  afterEach(() => {
    if (fs.existsSync(SIGNAL_PATH)) fs.rmSync(SIGNAL_PATH)
  })

  it('POST /api/azi3/run writes signal file and returns 202 with ok:true', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/azi3/run')
    expect(res.status).toBe(202)
    expect(res.body.ok).toBe(true)
    expect(fs.existsSync(SIGNAL_PATH)).toBe(true)
  })

  it('POST /api/azi3/run signal file contains a timestamp string', async () => {
    const { app } = await import('../../server/index')
    await request(app).post('/api/azi3/run')
    const content = fs.readFileSync(SIGNAL_PATH, 'utf-8')
    expect(new Date(content).getTime()).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test:server -- --reporter=verbose 2>&1 | grep -A5 'azi3'
```

Expected: FAIL — route not found (404) or module error.

- [ ] **Step 3: Create server/api/azi3.ts**

```typescript
// server/api/azi3.ts
import { Router } from 'express'
import fs from 'fs'

const router = Router()

router.post('/run', (_req, res) => {
  const signalPath = process.env.AZI3_SIGNAL_PATH ?? './data/azi3_run_signal'
  fs.writeFileSync(signalPath, new Date().toISOString())
  res.status(202).json({ ok: true })
})

export default router
```

- [ ] **Step 4: Register the router in server/index.ts**

In `server/index.ts`, add the import and `app.use` line. The current file ends with:
```typescript
app.use('/api/poll', pollRouter)
```

Add after that line:
```typescript
import azi3Router from './api/azi3'
// ...
app.use('/api/azi3', azi3Router)
```

Full updated imports block in `server/index.ts`:
```typescript
import 'dotenv/config'
import express from 'express'
import path from 'path'
import { migrate } from './db/migrate'
import healthRouter from './api/health'
import garminRouter from './api/garmin'
import manualRouter from './api/manual'
import insightsRouter from './api/insights'
import bloodworkRouter from './api/bloodwork'
import pollRouter from './api/poll'
import azi3Router from './api/azi3'

migrate()

export const app = express()
app.use(express.json())

app.use('/api/health', healthRouter)
app.use('/api/garmin', garminRouter)
app.use('/api/manual', manualRouter)
app.use('/api/insights', insightsRouter)
app.use('/api/bloodwork', bloodworkRouter)
app.use('/api/poll', pollRouter)
app.use('/api/azi3', azi3Router)

// Serve built React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(process.cwd(), 'dist/client')))
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist/client/index.html'))
  })
}
```

- [ ] **Step 5: Add AZI3_SIGNAL_PATH to .env.example**

In `.env.example`, add after `POLL_SIGNAL_PATH`:
```
AZI3_SIGNAL_PATH=./data/azi3_run_signal
```

- [ ] **Step 6: Run server tests to verify they pass**

```bash
npm run test:server
```

Expected: All server tests PASS including the 2 new azi3 tests.

- [ ] **Step 7: Commit**

```bash
git add server/api/azi3.ts server/index.ts tests/server/azi3.test.ts .env.example
git commit -m "feat: POST /api/azi3/run — signal file trigger for manual AZI-3 regeneration"
```

---

## Task 9: Client — triggerAzi3() and Regenerate Button

**Files:**
- Modify: `client/src/api.ts` (add `triggerAzi3`)
- Modify: `client/src/tabs/HomeTab.tsx` (add Regenerate button)
- Modify: `tests/client/HomeTab.test.tsx` (add Regenerate button test)

- [ ] **Step 1: Write the failing test**

In `tests/client/HomeTab.test.tsx`, add one test to the existing `describe('HomeTab')` block:

```tsx
  test('regenerate button triggers POST /api/azi3/run', async () => {
    mockSummary({ steps: 1000 })
    render(<HomeTab />)
    await waitFor(() => screen.getByRole('button', { name: /regenerate/i }))
    await userEvent.click(screen.getByRole('button', { name: /regenerate/i }))
    expect(mockFetch).toHaveBeenCalledWith('/api/azi3/run', { method: 'POST' })
  })
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test:client
```

Expected: FAIL — button with name "regenerate" not found.

- [ ] **Step 3: Add triggerAzi3 to client/src/api.ts**

In `client/src/api.ts`, add after `triggerPoll`:

```typescript
export async function triggerAzi3(): Promise<void> {
  await fetch('/api/azi3/run', { method: 'POST' })
}
```

- [ ] **Step 4: Update client/src/tabs/HomeTab.tsx**

Add `regenerating` state and `handleRegenerate` function, and the Regenerate button next to the Sync button. The spinner shows for 3 seconds after click (signal feedback — the actual run takes minutes).

Replace the current `HomeTab` function body with:

```tsx
// client/src/tabs/HomeTab.tsx
import { useState, useEffect, useCallback } from 'react'
import { getGarminSummary, triggerPoll, triggerAzi3 } from '../api'
import { AziCard } from '../components/AziCard'
import { StatGrid } from '../components/StatGrid'
import { LogForm } from '../components/LogForm'
import type { GarminSummary } from '../api'

export function HomeTab() {
  const [summary, setSummary] = useState<GarminSummary>({})
  const [polling, setPolling] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const fetchSummary = useCallback(async () => {
    const data = await getGarminSummary()
    setSummary(data)
  }, [])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  async function handlePoll() {
    setPolling(true)
    await triggerPoll()
    await new Promise((r) => setTimeout(r, 2000))
    await fetchSummary()
    setPolling(false)
  }

  async function handleRegenerate() {
    setRegenerating(true)
    await triggerAzi3()
    // Spinner for 3s — feedback that signal was sent (run takes minutes)
    await new Promise((r) => setTimeout(r, 3000))
    setRegenerating(false)
  }

  const steps = summary.steps

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-lg font-bold text-gray-50">Bacta</h1>
        <div className="flex items-center gap-2">
          {/* AZI-3 Regenerate button */}
          <button
            aria-label="Regenerate"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-40 p-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={regenerating ? 'animate-spin' : ''}
            >
              <path d="M12 2a10 10 0 0 1 7.38 16.75" />
              <path d="m16 16 3 3-3 3" />
              <path d="M12 22a10 10 0 0 1-7.38-16.75" />
              <path d="m8 8-3-3 3-3" />
            </svg>
          </button>
          {/* Garmin Sync button */}
          <button
            aria-label="Sync"
            onClick={handlePoll}
            disabled={polling}
            className="text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-40 p-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={polling ? 'animate-spin' : ''}
            >
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
        </div>
      </div>

      {/* AZI-3 Daily Briefing */}
      <div className="px-4">
        <AziCard section="recovery" />
      </div>

      {/* Stat Grid */}
      <div className="px-4">
        <StatGrid summary={summary} />
      </div>

      {/* Steps Progress */}
      {steps !== undefined && (
        <div className="mx-4 rounded-xl bg-gray-700 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Steps</span>
            <span className="text-base font-bold text-gray-50">{steps.toLocaleString()}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-600 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${Math.min((steps / 10000) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 text-right">
            {Math.round((steps / 10000) * 100)}% of 10k
          </p>
        </div>
      )}

      {/* Log Form */}
      <div className="px-4">
        <LogForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: All server tests and all client tests PASS. New total should include the Regenerate button test.

- [ ] **Step 6: Commit**

```bash
git add client/src/api.ts client/src/tabs/HomeTab.tsx tests/client/HomeTab.test.tsx
git commit -m "feat: Regenerate button — POST /api/azi3/run trigger from HomeTab header"
```

---

## Task 10: Smoke Test and Final Build

**Files:** None created — verification only.

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: All server tests AND all client tests PASS. Zero failures.

- [ ] **Step 2: Run all Python tests**

```bash
pytest tests/ -v --ignore=tests/server --ignore=tests/client
```

Expected: All Python tests PASS. Zero failures.

- [ ] **Step 3: Verify the production build**

```bash
npm run build
```

Expected: No TypeScript errors. `dist/client/` created cleanly.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Plan 3 complete — AZI-3 insight generation system"
```
