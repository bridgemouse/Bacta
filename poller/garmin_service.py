#!/usr/bin/env python3
"""
Persistent Garmin Connect polling service.
Loads OAuth tokens, polls all metrics hourly.
Watches for a signal file to trigger immediate poll (force-poll from API).
"""
import os
import sys
import time
from datetime import date, datetime
from pathlib import Path

from db import upsert_many_snapshots
from garmin_auth import load_client, get_display_name
from garmin_metrics import fetch_all

DB_PATH = os.environ.get('DB_PATH', './data/bacta.db')
SIGNAL_PATH = os.environ.get('POLL_SIGNAL_PATH', './data/poll_signal')
POLL_INTERVAL_SECONDS = int(os.environ.get('POLL_INTERVAL_SECONDS', '3600'))


def log(msg: str):
    print(f'[garmin_service] {datetime.now().isoformat()} {msg}', flush=True)


def poll_once(client, display_name: str):
    today = date.today().isoformat()
    log(f'polling metrics for {today}')
    try:
        metrics = fetch_all(client, today)
        rows = [(metric, value, unit) for metric, (value, unit) in metrics.items()]
        upsert_many_snapshots(DB_PATH, 'garmin_snapshots', today, rows, '{}')
        log(f'wrote {len(rows)} metrics to db')
    except Exception as e:
        log(f'ERROR during poll: {e}')


def check_signal() -> bool:
    """Returns True and removes signal file if force-poll was requested."""
    path = Path(SIGNAL_PATH)
    if path.exists():
        path.unlink()
        return True
    return False


def main():
    log('starting up')

    try:
        client = load_client()
    except FileNotFoundError as e:
        log(f'ERROR: {e}')
        sys.exit(1)

    display_name = get_display_name(client)
    log(f'authenticated as {display_name or os.environ.get("GARMIN_EMAIL", "unknown")}')

    poll_once(client, display_name)

    while True:
        for _ in range(POLL_INTERVAL_SECONDS // 10):
            time.sleep(10)
            if check_signal():
                log('force-poll signal received')
                poll_once(client, display_name)
                break

        poll_once(client, display_name)


if __name__ == '__main__':
    main()
