#!/usr/bin/env python3
"""
One-time interactive setup for Garmin Connect session.

Run this script to authenticate and save OAuth tokens.
After a successful run, garmin_service.py will reload tokens automatically
without requiring another MFA code (until tokens expire, typically months).

Usage:
    cd /path/to/bacta
    source poller/.venv/bin/activate
    export $(grep -v '^#' .env | xargs)
    python poller/setup_garmin_session.py
"""
import os
import sys
from pathlib import Path

from garminconnect import Garmin

TOKEN_PATH = os.environ.get('GARMIN_STATE_PATH', './data/garmin_tokens')


def main():
    email = os.environ.get('GARMIN_EMAIL')
    password = os.environ.get('GARMIN_PASSWORD')
    if not email or not password:
        print('ERROR: GARMIN_EMAIL and GARMIN_PASSWORD must be set in environment.')
        sys.exit(1)

    Path('./data').mkdir(exist_ok=True)

    print(f'Logging in as {email}...')
    print('Garmin will email you a one-time code if MFA is required.')
    print()

    client = Garmin(email, password, prompt_mfa=lambda: input('Enter MFA code from email: '))

    try:
        client.login(tokenstore=TOKEN_PATH)
    except Exception as e:
        print(f'ERROR: Login failed: {e}')
        sys.exit(1)

    # Verify by fetching display name
    try:
        name = client.get_full_name() or email
    except Exception:
        name = email

    print(f'\nAuthenticated as: {name}')
    print(f'Tokens saved to: {TOKEN_PATH}')
    print('garmin_service.py will use these tokens automatically.')
    print('Re-run this script if the service reports token expiry.')


if __name__ == '__main__':
    main()
