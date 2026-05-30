#!/usr/bin/env python3
"""Run this once interactively to authenticate with Garmin Connect.
Tokens are saved to ~/.garminconnect/ for the poller to reuse.
"""
import json
import os
from getpass import getpass
from garminconnect import Garmin

email = input("Garmin email: ")
password = getpass("Garmin password: ")

client = Garmin(email=email, password=password, prompt_mfa=lambda: input("MFA code: "))
client.login()

token_dir = os.path.expanduser("~/.garminconnect")
os.makedirs(token_dir, exist_ok=True)

client.garth.dump(token_dir)

print(f"Authenticated as: {client.display_name}")
print(f"Tokens saved to: {token_dir}")
