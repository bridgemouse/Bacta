import os

from garminconnect import Garmin

# Directory where OAuth tokens are persisted across runs.
# Set GARMIN_STATE_PATH env var to override.
_TOKEN_PATH = os.environ.get('GARMIN_STATE_PATH', './data/garmin_tokens')


def _get_mfa_prompt():
    """Return the appropriate MFA callback — Discord if configured, else terminal."""
    from discord_mfa import is_configured, prompt_mfa_via_discord
    if is_configured():
        return prompt_mfa_via_discord
    return lambda: input('Enter MFA code from email: ')


def load_client() -> Garmin:
    """
    Return an authenticated Garmin client using saved OAuth tokens.
    If MFA is required (e.g. tokens expired), notifies via Discord if configured,
    otherwise prompts on the terminal.
    Raises FileNotFoundError if no tokens exist — run setup_garmin_session.py first.
    """
    if not os.path.exists(_TOKEN_PATH):
        raise FileNotFoundError(
            f'No tokens found at {_TOKEN_PATH}. '
            'Run: python setup_garmin_session.py'
        )
    email = os.environ['GARMIN_EMAIL']
    password = os.environ['GARMIN_PASSWORD']
    client = Garmin(email, password, prompt_mfa=_get_mfa_prompt())
    client.login(tokenstore=_TOKEN_PATH)
    return client


def get_display_name(client: Garmin) -> str:
    """Return the Garmin Connect display name, or empty string on failure."""
    try:
        return client.get_full_name() or ''
    except Exception:
        return ''
