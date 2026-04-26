import json
import os
from pathlib import Path

from playwright.async_api import Page, Browser, BrowserContext

GARMIN_SSO_URL = (
    'https://sso.garmin.com/portal/sso/en-US/sign-in'
    '?clientId=GarminConnect'
    '&service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F'
)
GARMIN_HOME_URL = 'https://connect.garmin.com/modern/'

_STEALTH_USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
    'AppleWebKit/537.36 (KHTML, like Gecko) '
    'Chrome/120.0.0.0 Safari/537.36'
)

# Path to persist browser storage state (cookies + localStorage) across runs.
# Set GARMIN_STATE_PATH env var to override. Defaults to data/garmin_state.json.
_STATE_PATH = os.environ.get('GARMIN_STATE_PATH', './data/garmin_state.json')


async def make_stealth_context(browser: Browser, state_path: str | None = None) -> BrowserContext:
    """Create a browser context that passes basic bot-detection checks.
    If state_path is provided and exists, restores saved cookies/storage.
    """
    kwargs = dict(
        user_agent=_STEALTH_USER_AGENT,
        viewport={'width': 1280, 'height': 720},
    )
    if state_path and Path(state_path).exists():
        kwargs['storage_state'] = state_path

    context = await browser.new_context(**kwargs)
    # Hide the webdriver flag that Cloudflare and Garmin check for
    await context.add_init_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )
    return context


async def _is_already_logged_in(page: Page) -> bool:
    """Returns True if the current session is still authenticated."""
    try:
        await page.goto(GARMIN_HOME_URL, wait_until='domcontentloaded', timeout=20_000)
        # If we land on /modern/ without being redirected to SSO, we're logged in
        return '/modern/' in page.url and 'sign-in' not in page.url
    except Exception:
        return False


async def login(browser: Browser) -> Page:
    """
    Authenticate to Garmin Connect via headless Chromium.

    Tries to restore a saved session first. If the session is expired or
    no state file exists, performs a full login with email/password.
    Garmin may prompt for a one-time code during login — set GARMIN_OTP
    env var before starting the service to handle this automatically.

    After successful login, saves browser storage state for future runs.
    Returns an authenticated page.
    """
    email = os.environ['GARMIN_EMAIL']
    password = os.environ['GARMIN_PASSWORD']

    # Try restoring saved session first
    context = await make_stealth_context(browser, _STATE_PATH)
    page = await context.new_page()

    if Path(_STATE_PATH).exists():
        print('[garmin_auth] restoring saved session...', flush=True)
        if await _is_already_logged_in(page):
            print('[garmin_auth] session restored successfully', flush=True)
            return page
        print('[garmin_auth] saved session expired, re-authenticating...', flush=True)
        await context.close()
        context = await make_stealth_context(browser)
        page = await context.new_page()

    # Full login flow
    await page.goto(GARMIN_SSO_URL, wait_until='domcontentloaded', timeout=60_000)

    # Wait for Cloudflare challenge to resolve if present
    try:
        await page.wait_for_function(
            "document.title !== 'Just a moment...'",
            timeout=20_000,
        )
    except Exception:
        pass

    # Fill credentials
    await page.wait_for_selector('input[name="email"]', timeout=30_000)
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.click('button[type="submit"]')

    # Handle one-time security code (2FA) if Garmin prompts for it
    try:
        # Broad selector covering Garmin's known OTP input patterns
        otp_selector = (
            'input[name="verificationCode"], '
            'input[id*="otp"], input[id*="code"], '
            'input[type="number"][maxlength="6"], '
            'input[placeholder*="code"], input[placeholder*="Code"]'
        )
        await page.wait_for_selector(otp_selector, timeout=12_000)
        # OTP prompt appeared — save screenshot for debugging
        try:
            await page.screenshot(path='./data/garmin_otp_prompt.png')
        except Exception:
            pass
        otp = os.environ.get('GARMIN_OTP', '').strip()
        if not otp:
            raise RuntimeError(
                'Garmin is requesting a one-time code. '
                'Set GARMIN_OTP=<code> env var and restart.'
            )
        print(f'[garmin_auth] OTP prompt detected, entering code...', flush=True)
        await page.fill(otp_selector, otp)
        # Submit OTP
        try:
            await page.click('button[type="submit"]')
        except Exception:
            await page.keyboard.press('Enter')
    except Exception as e:
        if 'one-time code' in str(e):
            raise
        # No OTP prompt within 12s — normal login flow (no 2FA triggered)

    # Wait for redirect to Garmin Connect home
    try:
        await page.wait_for_url('**/modern/**', timeout=30_000)
    except Exception:
        # Save screenshot to help diagnose login failures
        screenshot_path = './data/garmin_login_debug.png'
        try:
            Path('./data').mkdir(exist_ok=True)
            await page.screenshot(path=screenshot_path)
            print(f'[garmin_auth] login failed — screenshot saved to {screenshot_path}', flush=True)
            print(f'[garmin_auth] current URL: {page.url}', flush=True)
        except Exception:
            pass
        raise

    # Save session state for future runs
    Path(_STATE_PATH).parent.mkdir(parents=True, exist_ok=True)
    await context.storage_state(path=_STATE_PATH)
    print('[garmin_auth] authenticated successfully, session saved', flush=True)

    return page


async def get_display_name(page: Page) -> str:
    """Get the Garmin Connect display name from the current session."""
    try:
        response = await page.goto(
            'https://connect.garmin.com/modern/proxy/userprofile-service/socialProfile/'
        )
        if response is None:
            return ''
        data = await response.json()
        return data.get('displayName', '')
    except Exception:
        return ''
