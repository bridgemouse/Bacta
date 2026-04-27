#!/usr/bin/env python3
"""Quick test of python-garminconnect auth and a single metric fetch."""
import os
import sys
import json
from datetime import date
from pathlib import Path

from garminconnect import Garmin

email = os.environ.get('GARMIN_EMAIL')
password = os.environ.get('GARMIN_PASSWORD')
if not email or not password:
    print('ERROR: set GARMIN_EMAIL and GARMIN_PASSWORD')
    sys.exit(1)

TOKEN_PATH = './data/garmin_tokens'

print(f'Connecting as {email}...')
try:
    client = Garmin(email, password, prompt_mfa=lambda: input('Enter MFA code from email: '))
    client.login(tokenstore=TOKEN_PATH)
    print('Login succeeded. Tokens saved to', TOKEN_PATH)
except Exception as e:
    print(f'Login failed: {e}')
    sys.exit(1)

today = date.today().isoformat()
print(f'\nFetching daily summary for {today}...')
try:
    summary = client.get_user_summary(today)
    print('\nAll body battery fields:')
    for k, v in summary.items():
        if 'attery' in k:
            print(f'  {k}: {v}')
    print('\nKey metrics:')
    print(f"  steps:      {summary.get('totalSteps')}")
    print(f"  resting HR: {summary.get('restingHeartRate')}")
    print(f"  stress:     {summary.get('averageStressLevel')}")
except Exception as e:
    print(f'Summary fetch failed: {e}')

print('\nFetching body battery time series...')
try:
    bb = client.get_body_battery(today, today)
    print(f'  raw response type: {type(bb)}')
    print(f'  raw: {json.dumps(bb, indent=2)[:500]}')
except Exception as e:
    print(f'Body battery fetch failed: {e}')
