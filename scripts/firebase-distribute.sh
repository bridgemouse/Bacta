#!/usr/bin/env bash
# firebase-distribute.sh [--dry-run] <apk> <release-notes-file>
# Uploads a signed APK to Firebase App Distribution. Skips (exit 0) when credentials are not
# configured so a release never fails for lack of Firebase. Credentials are never printed.
set -euo pipefail

die() { echo "firebase-distribute: $*" >&2; exit 1; }

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=1; shift; fi

APP_ID="${FIREBASE_APP_ID:-}"
CREDS="${GOOGLE_APPLICATION_CREDENTIALS:-}"
if [[ -z "$APP_ID" || -z "$CREDS" ]]; then
  echo "firebase-distribute: skipped (Firebase credentials not configured)"
  exit 0
fi

[[ $# -eq 2 ]] || die "usage: firebase-distribute.sh [--dry-run] <apk> <release-notes-file>"
APK="$1"
NOTES="$2"

[[ "$APP_ID" =~ ^1:[0-9]+:android:[0-9a-f]+$ ]] || die "FIREBASE_APP_ID must look like 1:1234567890:android:0a1b2c3d4e5f67890, got '$APP_ID'"
[[ -f "$APK" ]] || die "APK not found: $APK"
[[ -f "$NOTES" ]] || die "release notes file not found: $NOTES"
[[ -f "$CREDS" ]] || die "credentials file not found (GOOGLE_APPLICATION_CREDENTIALS)"

# GROUPS is a special bash variable, so the group list uses another name.
TESTER_GROUPS="${FIREBASE_GROUPS:-owner}"
TOOLS_VERSION="${FIREBASE_TOOLS_VERSION:-15.34.2}"

cmd=(npx --yes "firebase-tools@$TOOLS_VERSION" appdistribution:distribute "$APK"
  --app "$APP_ID" --groups "$TESTER_GROUPS" --release-notes-file "$NOTES")

if (( DRY_RUN )); then
  printf '%s ' "${cmd[@]}"
  echo
  exit 0
fi

exec "${cmd[@]}"
