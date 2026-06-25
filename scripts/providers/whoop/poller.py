import os
import sys
import requests

BASE_URL = os.environ.get('BACTA_BASE_URL', 'http://localhost:3001')
TOKEN    = os.environ.get('BACTA_INTERNAL_TOKEN', '')

def main():
    r = requests.post(
        f'{BASE_URL}/api/integrations/whoop/sync',
        headers={'Authorization': f'Bearer {TOKEN}'},
        timeout=120,
    )
    if not r.ok:
        print(f'[whoop] sync failed: {r.status_code} {r.text}', file=sys.stderr)
        sys.exit(1)
    data = r.json()
    print(f'[whoop] synced: {data.get("recordsWritten", "?")} records written')

if __name__ == '__main__':
    main()
