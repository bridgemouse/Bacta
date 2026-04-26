#!/usr/bin/env python3
"""
Persistent Garmin Connect polling service.
Authenticates once via headless Chromium, polls all metrics hourly.
Watches for a signal file to trigger immediate poll (force-poll from API).
"""
import asyncio
import os
import sys
from datetime import date, datetime
from pathlib import Path

from playwright.async_api import async_playwright

from db import upsert_many_snapshots
from garmin_auth import login, get_display_name
from garmin_metrics import fetch_all

DB_PATH = os.environ.get('DB_PATH', './data/bacta.db')
SIGNAL_PATH = os.environ.get('POLL_SIGNAL_PATH', './data/poll_signal')
POLL_INTERVAL_SECONDS = int(os.environ.get('POLL_INTERVAL_SECONDS', '3600'))


def log(msg: str):
    print(f'[garmin_service] {datetime.now().isoformat()} {msg}', flush=True)


async def poll_once(page, display_name: str):
    today = date.today().isoformat()
    log(f'polling metrics for {today}')
    try:
        metrics = await fetch_all(page, display_name, today)
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


async def main():
    log('starting up')
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--disable-blink-features=AutomationControlled', '--no-sandbox'],
        )
        page = await login(browser)
        display_name = await get_display_name(page)
        log(f'authenticated as {display_name}')

        # Initial poll on startup
        await poll_once(page, display_name)

        while True:
            # Sleep in 10-second increments, checking for signal file
            for _ in range(POLL_INTERVAL_SECONDS // 10):
                await asyncio.sleep(10)
                if check_signal():
                    log('force-poll signal received')
                    await poll_once(page, display_name)
                    break  # Reset the hourly timer

            await poll_once(page, display_name)


if __name__ == '__main__':
    asyncio.run(main())
