#!/usr/bin/env python3
"""
Convert a Cookie-Editor JSON export into Playwright storage_state format.

Usage:
    1. Install "Cookie-Editor" extension in Chrome
    2. Log into connect.garmin.com in Chrome
    3. Click the Cookie-Editor icon → Export (All) → copy the JSON
    4. Paste it into a file, e.g. ~/garmin_cookies.json
    5. Run: python tools/import_chrome_cookies.py ~/garmin_cookies.json

The script writes data/garmin_state.json, which garmin_service.py will
restore automatically on next startup.
"""
import json
import sys
from pathlib import Path

SAMESIDE_MAP = {
    'no_restriction': 'None',
    'lax': 'Lax',
    'strict': 'Strict',
    'unspecified': 'None',
}

OUTPUT_PATH = Path('./data/garmin_state.json')


def convert(cookies: list[dict]) -> dict:
    out = []
    for c in cookies:
        # Only keep Garmin-related cookies
        domain = c.get('domain', '')
        if 'garmin' not in domain:
            continue

        sameSite = SAMESIDE_MAP.get((c.get('sameSite') or '').lower(), 'None')
        entry = {
            'name': c['name'],
            'value': c['value'],
            'domain': domain,
            'path': c.get('path', '/'),
            'expires': c.get('expirationDate', -1),
            'httpOnly': c.get('httpOnly', False),
            'secure': c.get('secure', False),
            'sameSite': sameSite,
        }
        out.append(entry)

    return {'cookies': out, 'origins': []}


def main():
    if len(sys.argv) < 2:
        print('Usage: python tools/import_chrome_cookies.py <path-to-cookie-editor-export.json>')
        sys.exit(1)

    src = Path(sys.argv[1]).expanduser()
    if not src.exists():
        print(f'ERROR: file not found: {src}')
        sys.exit(1)

    raw = json.loads(src.read_text())
    if not isinstance(raw, list):
        print('ERROR: expected a JSON array from Cookie-Editor export')
        sys.exit(1)

    state = convert(raw)
    garmin_count = len(state['cookies'])

    if garmin_count == 0:
        print('WARNING: no garmin.com cookies found in the export.')
        print('Make sure you exported from connect.garmin.com while logged in.')
        sys.exit(1)

    OUTPUT_PATH.parent.mkdir(exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(state, indent=2))
    print(f'Wrote {garmin_count} Garmin cookies to {OUTPUT_PATH}')
    print('garmin_service.py will restore this session on next startup.')


if __name__ == '__main__':
    main()
