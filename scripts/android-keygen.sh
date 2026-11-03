#!/usr/bin/env bash
# Owner-run, once. Creates the Android release signing key on the dev VM, moves it to
# ~/secrets on this machine, stores it as GitHub secrets, and prints the password ONCE.
set -euo pipefail

VM="${ANDROID_VM:-wheat@bacta-android}"
KEYSTORE="$HOME/secrets/bacta-release.jks"

[[ ! -e "$KEYSTORE" ]] || { echo "android-keygen: $KEYSTORE already exists; refusing to overwrite" >&2; exit 1; }

PASS="$(openssl rand -base64 24 | tr -d '/+=')"
mkdir -p "$HOME/secrets" && chmod 700 "$HOME/secrets"

ssh "$VM" "keytool -genkeypair -keystore /tmp/bacta-release.jks -alias bacta -keyalg RSA -keysize 4096 -validity 10000 -storepass '$PASS' -keypass '$PASS' -dname 'CN=Bacta, O=bridgemouse'" >/dev/null
scp "$VM:/tmp/bacta-release.jks" "$KEYSTORE" >/dev/null
ssh "$VM" 'rm -f /tmp/bacta-release.jks'
chmod 600 "$KEYSTORE"

base64 -w0 "$KEYSTORE" | gh secret set BACTA_KEYSTORE_B64
printf %s "$PASS"  | gh secret set BACTA_KEYSTORE_PASSWORD
printf %s "$PASS"  | gh secret set BACTA_KEY_PASSWORD
printf %s bacta    | gh secret set BACTA_KEY_ALIAS

echo
echo "Release key created: $KEYSTORE"
echo "PASSWORD (shown once — save it in your password manager now): $PASS"
echo "ALSO copy $KEYSTORE to a second place off this machine. If both are lost, installed apps must be uninstalled before a new key can be used."
