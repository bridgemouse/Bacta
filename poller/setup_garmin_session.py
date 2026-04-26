#!/usr/bin/env python3
"""
One-time interactive setup for Garmin Connect session.

Run this script once to authenticate and save session cookies.
After a successful run, garmin_service.py will restore the saved session
automatically without requiring another OTP.

Usage:
    cd /path/to/bacta
    source poller/.venv/bin/activate
    export $(grep -v '^#' .env | xargs)
    python poller/setup_garmin_session.py
"""
import asyncio
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

GARMIN_SSO_URL = (
    'https://sso.garmin.com/portal/sso/en-US/sign-in'
    '?clientId=GarminConnect'
    '&service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F'
)
GARMIN_HOME_URL = 'https://connect.garmin.com/modern/'
STATE_PATH = os.environ.get('GARMIN_STATE_PATH', './data/garmin_state.json')


async def main():
    email = os.environ.get('GARMIN_EMAIL')
    password = os.environ.get('GARMIN_PASSWORD')
    if not email or not password:
        print('ERROR: GARMIN_EMAIL and GARMIN_PASSWORD must be set in environment.')
        sys.exit(1)

    Path('./data').mkdir(exist_ok=True)

    print('Launching browser (non-headless so you can see the flow)...')
    async with async_playwright() as p:
        # Use non-headless so Garmin sees a real browser fingerprint
        browser = await p.chromium.launch(
            headless=False,
            args=['--disable-blink-features=AutomationControlled'],
        )
        context = await browser.new_context(
            user_agent=(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/122.0.0.0 Safari/537.36'
            ),
            viewport={'width': 1280, 'height': 800},
        )
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        page = await context.new_page()

        print(f'Navigating to Garmin SSO...')
        await page.goto(GARMIN_SSO_URL, wait_until='domcontentloaded', timeout=60_000)

        # Wait for Cloudflare if present
        try:
            await page.wait_for_function(
                "document.title !== 'Just a moment...'", timeout=15_000
            )
        except Exception:
            pass

        await page.wait_for_selector('input[name="email"]', timeout=30_000)
        await page.fill('input[name="email"]', email)
        await page.fill('input[name="password"]', password)
        await page.click('button[type="submit"]')
        print('Credentials submitted.')

        print()
        print('If Garmin sent a one-time security code to your email,')
        print('enter it below and press Enter.')
        print('If no code is needed (session-based auth), just press Enter.')
        print()

        otp = input('One-time code (or blank): ').strip()
        if otp:
            # Try to find and fill the OTP input
            otp_selectors = [
                'input[name="verificationCode"]',
                'input[id*="otp"]',
                'input[id*="code"]',
                'input[type="number"]',
                'input[maxlength="6"]',
            ]
            filled = False
            for sel in otp_selectors:
                try:
                    el = await page.wait_for_selector(sel, timeout=3_000)
                    if el:
                        await el.fill(otp)
                        filled = True
                        print(f'Filled OTP using selector: {sel}')
                        break
                except Exception:
                    continue

            if not filled:
                print('WARNING: Could not find OTP input field automatically.')
                print('The browser window is open — please enter the code manually.')
                input('Press Enter once you have submitted the code in the browser...')
            else:
                try:
                    await page.click('button[type="submit"]')
                except Exception:
                    await page.keyboard.press('Enter')

        print('Waiting for redirect to Garmin Connect...')
        try:
            await page.wait_for_url('**/modern/**', timeout=60_000)
        except Exception:
            print('Did not reach /modern/ automatically.')
            print('If you are logged in in the browser window, press Enter to save the session.')
            print('Otherwise, complete login in the browser window and press Enter when done.')
            input('Press Enter to save session: ')

        if '/modern/' in page.url or 'connect.garmin.com' in page.url:
            await context.storage_state(path=STATE_PATH)
            print(f'\nSession saved to {STATE_PATH}')
            print('garmin_service.py will restore this session automatically.')
            print('You will only need to re-run this setup when the session expires.')
        else:
            print(f'ERROR: Unexpected URL: {page.url}')
            sys.exit(1)

        await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
