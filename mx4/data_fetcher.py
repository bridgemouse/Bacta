# mx4/data_fetcher.py
"""Fetch Garmin and manual data from SQLite and format as markdown tables for MX-4 prompts."""

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
    if not metrics:
        return {}
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
