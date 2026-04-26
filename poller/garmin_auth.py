import os
from playwright.async_api import Page, Browser

GARMIN_SSO_URL = (
    'https://sso.garmin.com/portal/sso/en-US/sign-in'
    '?clientId=GarminConnect'
    '&service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F'
)

async def login(browser: Browser) -> Page:
    """
    Authenticate to Garmin Connect via headless Chromium.
    Returns an authenticated page with session cookies set.
    """
    email = os.environ['GARMIN_EMAIL']
    password = os.environ['GARMIN_PASSWORD']

    page = await browser.new_page()
    await page.goto(GARMIN_SSO_URL, wait_until='networkidle')

    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.click('button[type="submit"]')

    # Wait for redirect to Garmin Connect home
    await page.wait_for_url('**/modern/**', timeout=30_000)

    print('[garmin_auth] authenticated successfully')
    return page


async def get_display_name(page: Page) -> str:
    """Get the Garmin Connect display name from the current session."""
    response = await page.goto(
        'https://connect.garmin.com/modern/proxy/userprofile-service/socialProfile/'
    )
    data = await response.json()
    return data.get('displayName', '')
