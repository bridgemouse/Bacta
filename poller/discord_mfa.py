"""
Discord-based MFA code retrieval for Garmin login.

When Garmin requires an MFA code, sends a notification to the Bacta Discord
channel and polls for a reply containing the 6-digit code.

Required env vars:
    DISCORD_BOT_TOKEN      — bot token from Discord Developer Portal
    DISCORD_BACTA_CHANNEL_ID — channel ID to send/receive the MFA code
"""
import os
import re
import time

import requests

_BASE = 'https://discord.com/api/v10'
_TIMEOUT_SECONDS = 600   # 10 minutes
_POLL_INTERVAL = 5

_RESEND_COMMAND = 'resend'


class MFARetryRequested(Exception):
    """Raised when the user requests a new MFA code via Discord."""


def _headers() -> dict:
    return {
        'Authorization': f'Bot {os.environ["DISCORD_BOT_TOKEN"]}',
        'Content-Type': 'application/json',
    }


def _send(channel_id: str, text: str) -> str | None:
    """Send a message to the channel; return its snowflake ID."""
    resp = requests.post(
        f'{_BASE}/channels/{channel_id}/messages',
        headers=_headers(),
        json={'content': text},
        timeout=10,
    )
    if resp.ok:
        return resp.json().get('id')
    print(f'[discord_mfa] send failed: {resp.status_code} {resp.text}', flush=True)
    return None


def _messages_after(channel_id: str, after_id: str) -> list[dict]:
    """Return messages posted after after_id, oldest first."""
    resp = requests.get(
        f'{_BASE}/channels/{channel_id}/messages',
        headers=_headers(),
        params={'after': after_id, 'limit': 10},
        timeout=10,
    )
    if resp.ok:
        return sorted(resp.json(), key=lambda m: m['id'])
    return []


def prompt_mfa_via_discord() -> str:
    """
    Notify the Bacta Discord channel that an MFA code is needed and wait
    for a reply containing a 6-digit code. Returns the code as a string.
    Raises RuntimeError on timeout.
    """
    channel_id = os.environ['DISCORD_BACTA_CHANNEL_ID']

    print('[discord_mfa] sending MFA notification to Discord...', flush=True)
    msg_id = _send(
        channel_id,
        '🔐 **Garmin MFA required**\n'
        'Check your email for a one-time code and **reply here with just the 6-digit number**.\n'
        f'*(will wait up to {_TIMEOUT_SECONDS // 60} minutes)*',
    )
    if not msg_id:
        raise RuntimeError('Failed to send Discord MFA notification — check bot token and channel ID.')

    print('[discord_mfa] waiting for MFA code in Discord...', flush=True)
    deadline = time.time() + _TIMEOUT_SECONDS
    reminder_at = time.time() + 1800  # 30 minutes
    reminded = False
    while time.time() < deadline:
        time.sleep(_POLL_INTERVAL)
        if not reminded and time.time() >= reminder_at:
            _send(
                channel_id,
                '⏳ Still waiting for your Garmin MFA code.\n'
                'Reply with the **6-digit code** from your email, '
                'or type `resend` to request a new one.',
            )
            reminded = True
        for msg in _messages_after(channel_id, msg_id):
            if msg.get('author', {}).get('bot'):
                continue
            content = msg.get('content', '').strip()
            if content.lower() == _RESEND_COMMAND:
                _send(channel_id, '🔄 Requesting a new code from Garmin — check your email again...')
                print('[discord_mfa] resend requested, restarting login', flush=True)
                raise MFARetryRequested()
            if re.fullmatch(r'\d{6}', content):
                _send(channel_id, f'✅ Got it — entering code `{content}`...')
                print('[discord_mfa] received MFA code from Discord', flush=True)
                return content

    raise RuntimeError(
        f'Timed out waiting for MFA code after {_TIMEOUT_SECONDS // 60} minutes.'
    )


def notify_mfa_required() -> None:
    """
    Send a one-way notification that MFA re-setup is needed (no reply expected).
    Used when the service exits rather than waiting interactively.
    """
    channel_id = os.environ.get('DISCORD_BACTA_CHANNEL_ID', '')
    if not channel_id or not os.environ.get('DISCORD_BOT_TOKEN', ''):
        return
    _send(
        channel_id,
        '⚠️ **Bacta — Garmin token expired**\n'
        'SSH into the server and run:\n'
        '```\ncd /path/to/bacta\n'
        'source poller/.venv/bin/activate\n'
        'python poller/setup_garmin_session.py\n```\n'
        'Then restart the poller.',
    )


def is_configured() -> bool:
    return bool(
        os.environ.get('DISCORD_BOT_TOKEN') and
        os.environ.get('DISCORD_BACTA_CHANNEL_ID')
    )
