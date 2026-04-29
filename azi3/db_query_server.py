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
