"""
Discord-based MFA code retrieval for Garmin login.

When Garmin requires an MFA code, sends a notification to a Discord channel
and polls for a reply containing the code. Requires a bot with read/send
message permissions in the configured channel.

Required env vars:
    DISCORD_BOT_TOKEN      — bot token from Discord Developer Portal
    DISCORD_MFA_CHANNEL_ID — channel ID to send/receive the MFA code
"""
import os
import re
import time

import requests

_BASE = 'https://discord.com/api/v10'
_TIMEOUT_SECONDS = 600  # 10 minutes
_POLL_INTERVAL = 5


def _headers() -> dict:
    token = os.environ.get('DISCORD_BOT_TOKEN', '')
    return {'Authorization': f'Bot {token}', 'Content-Type': 'application/json'}


def _send_message(channel_id: str, text: str) -> str | None:
    """Send a message; return its ID."""
    resp = requests.post(
        f'{_BASE}/channels/{channel_id}/messages',
        headers=_headers(),
        json={'content': text},
        timeout=10,
    )
    if resp.ok:
        return resp.json().get('id')
    return None


def _get_messages_after(channel_id: str, after_id: str) -> list[dict]:
    """Return messages posted after after_id."""
    resp = requests.get(
        f'{_BASE}/channels/{channel_id}/messages',
        headers=_headers(),
        params={'after': after_id, 'limit': 10},
        timeout=10,
    )
    if resp.ok:
        return resp.json()
    return []


def prompt_mfa_via_discord() -> str:
    """
    Notify the Discord channel that an MFA code is needed and wait for a reply.
    Returns the code string when received.
    Raises RuntimeError on timeout or misconfiguration.
    """
    channel_id = os.environ.get('DISCORD_MFA_CHANNEL_ID', '')
    if not channel_id or not os.environ.get('DISCORD_BOT_TOKEN', ''):
        raise RuntimeError(
            'DISCORD_BOT_TOKEN and DISCORD_MFA_CHANNEL_ID must be set for Discord MFA.'
        )

    print('[discord_mfa] sending MFA notification to Discord...', flush=True)
    msg_id = _send_message(
        channel_id,
        '🔐 **Garmin MFA required**\n'
        'Check your email for a one-time code and reply here with just the number.\n'
        f'*(waiting up to {_TIMEOUT_SECONDS // 60} minutes)*',
    )
    if not msg_id:
        raise RuntimeError('Failed to send Discord MFA notification.')

    print('[discord_mfa] waiting for MFA code reply...', flush=True)
    deadline = time.time() + _TIMEOUT_SECONDS
    while time.time() < deadline:
        time.sleep(_POLL_INTERVAL)
        messages = _get_messages_after(channel_id, msg_id)
        for msg in reversed(messages):  # oldest first
            # Ignore bot's own messages
            if msg.get('author', {}).get('bot'):
                continue
            code = msg.get('content', '').strip()
            if re.fullmatch(r'\d{6}', code):
                _send_message(channel_id, f'✅ Got it, entering code `{code}`...')
                print(f'[discord_mfa] received MFA code', flush=True)
                return code

    raise RuntimeError(
        f'Timed out waiting for MFA code after {_TIMEOUT_SECONDS // 60} minutes.'
    )


def is_configured() -> bool:
    """Return True if Discord MFA env vars are set."""
    return bool(
        os.environ.get('DISCORD_BOT_TOKEN') and
        os.environ.get('DISCORD_MFA_CHANNEL_ID')
    )
