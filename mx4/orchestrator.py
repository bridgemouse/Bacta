#!/usr/bin/env python3
# mx4/orchestrator.py
"""MX-4 Orchestrator — generate insight cards using claude -p."""

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
    title = f"⚕ MX-4 — {run_type} Run {outcome} ({timestamp})"
    body = '\n'.join(status_lines) + f'\nRuntime: {runtime}'

    try:
        requests.post(webhook_url, json={'content': f'**{title}**\n{body}'}, timeout=10)
    except Exception as e:
        log(f'Discord notification failed: {e}')


def run(scheduled: bool) -> None:
    start_time = time.time()
    log(f'MX-4 run starting (scheduled={scheduled})')

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
    parser = argparse.ArgumentParser(description='MX-4 insight card generator')
    parser.add_argument('--scheduled', action='store_true',
                        help='Mark as scheduled run (suppresses Discord on success)')
    args = parser.parse_args()
    run(scheduled=args.scheduled)
