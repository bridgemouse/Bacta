#!/usr/bin/env python3
"""
hevy/poller.py — manually triggers a Hevy data sync via the Bacta API.
Bacta's own background sync (server/lib/providerSync.ts) calls runSync()
in-process on an hourly schedule and does not invoke this script — it
remains available for external/manual triggering (e.g. your own cron
entry) against the same API endpoint.

Required env vars:
  BACTA_INTERNAL_TOKEN  — pre-shared token for API auth
  BACTA_BASE_URL        — base URL of local Bacta server (default: http://localhost:3001)
"""
import os
import sys

try:
    import requests
except ImportError:
    print('[hevy] requests library not installed — run: pip3 install requests', file=sys.stderr)
    sys.exit(1)

BASE_URL = os.environ.get('BACTA_BASE_URL', 'http://localhost:3001')
TOKEN    = os.environ.get('BACTA_INTERNAL_TOKEN', '')


def main() -> None:
    if not TOKEN:
        print('[hevy] BACTA_INTERNAL_TOKEN not set — cannot authenticate', file=sys.stderr)
        sys.exit(1)

    try:
        r = requests.post(
            f'{BASE_URL}/api/integrations/hevy/sync',
            headers={'Authorization': f'Bearer {TOKEN}'},
            timeout=60,
        )
    except requests.exceptions.ConnectionError:
        print(f'[hevy] could not connect to {BASE_URL} — is bacta-api running?', file=sys.stderr)
        sys.exit(1)

    if not r.ok:
        print(f'[hevy] sync failed: {r.status_code} {r.text}', file=sys.stderr)
        sys.exit(1)

    data = r.json()
    print(f'[hevy] synced: {data.get("recordsWritten", "?")} records written')


if __name__ == '__main__':
    main()
