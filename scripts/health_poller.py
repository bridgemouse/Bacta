#!/usr/bin/env python3
"""
health_poller.py — dispatcher for all active wearable providers.

Reads active providers from Bacta's app_settings table and calls
each provider's poller script. Garmin is always included if the
credentials file exists. OAuth-based providers (Polar, Oura, etc.)
are called when their {provider}_enabled setting is 'true'.

Usage: python3 scripts/health_poller.py
"""
import os
import subprocess
import sqlite3
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

DB_PATH = os.environ.get('BACTA_DB', '/opt/bacta/data/bacta.db')
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROVIDERS_DIR = os.path.join(SCRIPT_DIR, 'providers')


def get_setting(db: sqlite3.Connection, key: str) -> str | None:
    row = db.execute('SELECT value FROM app_settings WHERE key = ?', (key,)).fetchone()
    return row[0] if row else None


def run_provider(name: str, script: str) -> None:
    log.info(f'Running provider: {name}')
    result = subprocess.run(
        ['python3', script],
        env={**os.environ, 'BACTA_DB': DB_PATH},
        capture_output=False,
    )
    if result.returncode != 0:
        log.error(f'Provider {name} exited with code {result.returncode}')
    else:
        log.info(f'Provider {name} completed successfully')


def main() -> None:
    db = sqlite3.connect(DB_PATH)

    # Garmin: always run if credentials file exists (unchanged auth method)
    garmin_creds = os.path.expanduser('~/.garminconnect')
    if os.path.exists(garmin_creds):
        run_provider('garmin', os.path.join(PROVIDERS_DIR, 'garmin', 'poller.py'))
    else:
        log.warning('Garmin credentials not found — skipping garmin provider')

    # OAuth-based providers: run if {provider}_enabled == 'true' in app_settings
    oauth_providers = ['polar', 'oura', 'whoop', 'withings', 'strava', 'hevy']
    for provider in oauth_providers:
        enabled = get_setting(db, f'{provider}_enabled')
        if enabled == 'true':
            script = os.path.join(PROVIDERS_DIR, provider, 'poller.py')
            if os.path.exists(script):
                run_provider(provider, script)
            else:
                log.warning(f'Provider {provider} enabled but poller not found at {script}')

    db.close()
    log.info('health_poller complete')


if __name__ == '__main__':
    main()
