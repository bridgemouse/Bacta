import os
import sys
import requests

BASE_URL = os.environ.get('BACTA_BASE_URL', 'http://localhost:3001')
TOKEN    = os.environ.get('BACTA_INTERNAL_TOKEN', '')
PROVIDER = 'polar'

def main():
    r = requests.post(
        f'{BASE_URL}/api/integrations/{PROVIDER}/sync',
        headers={'Authorization': f'Bearer {TOKEN}'},
        timeout=120,
    )
    if not r.ok:
        print(f'[{PROVIDER}] sync failed: {r.status_code} {r.text}', file=sys.stderr)
        sys.exit(1)
    data = r.json()
    print(f'[{PROVIDER}] synced: {data.get("recordsWritten", "?")} records written')

if __name__ == '__main__':
    main()
