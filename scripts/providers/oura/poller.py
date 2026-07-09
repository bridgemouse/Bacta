#!/usr/bin/env python3
"""
oura/poller.py — triggers an Oura data sync via the Bacta API.
Called by health_poller.py when oura_enabled=true in app_settings.

Required env vars:
  BACTA_INTERNAL_TOKEN  — pre-shared token for API auth
  BACTA_BASE_URL        — base URL of local Bacta server (default: http://localhost:3001)
"""
import os
import sys

try:
    import requests
except ImportError:
    print('[oura] requests library not installed — run: pip3 install requests', file=sys.stderr)
    sys.exit(1)

BASE_URL = os.environ.get('BACTA_BASE_URL', 'http://localhost:3001')
TOKEN    = os.environ.get('BACTA_INTERNAL_TOKEN', '')


def main() -> None:
    if not TOKEN:
        print('[oura] BACTA_INTERNAL_TOKEN not set — cannot authenticate', file=sys.stderr)
        sys.exit(1)

    try:
        r = requests.post(
            f'{BASE_URL}/api/integrations/oura/sync',
            headers={'Authorization': f'Bearer {TOKEN}'},
            timeout=120,
        )
    except requests.exceptions.ConnectionError:
        print(f'[oura] could not connect to {BASE_URL} — is bacta-api running?', file=sys.stderr)
        sys.exit(1)

    if not r.ok:
        print(f'[oura] sync failed: {r.status_code} {r.text}', file=sys.stderr)
        sys.exit(1)

    data = r.json()
    print(f'[oura] synced: {data.get("recordsWritten", "?")} records written')


if __name__ == '__main__':
    main()
