#!/usr/bin/env python3
"""Run this once interactively to authenticate with Garmin Connect.
Tries existing tokens first, falls back to fresh login if needed.
Tokens are saved to ~/.garminconnect/ for the poller to reuse.
"""
import os
from getpass import getpass
from garminconnect import Garmin, GarminConnectAuthenticationError

TOKEN_DIR = os.path.expanduser("~/.garminconnect")

# Try existing tokens first
print(f"Trying saved tokens in {TOKEN_DIR}...")
try:
    client = Garmin()
    client.login(TOKEN_DIR)
    print(f"Authenticated as: {client.display_name}")
    print("Existing tokens are valid — no re-login needed.")
    exit(0)
except Exception as e:
    print(f"Saved tokens failed ({e}), logging in fresh...")

email = input("Garmin email: ")
password = getpass("Garmin password: ")

client = Garmin(email=email, password=password, prompt_mfa=lambda: input("MFA code: "))
client.login()

os.makedirs(TOKEN_DIR, exist_ok=True)
client.garth.dump(TOKEN_DIR)

print(f"Authenticated as: {client.display_name}")
print(f"Tokens saved to: {TOKEN_DIR}")
