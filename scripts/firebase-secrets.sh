#!/usr/bin/env bash
# Owner-run: validate a Firebase service-account key and App ID, then store them as GitHub secrets.
# The key is read from a file and piped to `gh`; its contents are never printed.
set -euo pipefail

die() { echo "firebase-secrets: $*" >&2; exit 1; }

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=1; shift; fi
[[ $# -eq 2 ]] || die "usage: firebase-secrets.sh [--dry-run] <service-account.json> <app-id>"
KEY="$1"
APP_ID="$2"

[[ -r "$KEY" ]] || die "key file not readable: $KEY"

node -e '
const fs = require("fs")
let j
try { j = JSON.parse(fs.readFileSync(process.argv[1], "utf8")) } catch { process.exit(2) }
process.exit(j && j.type === "service_account" ? 0 : 3)
' "$KEY" || die "$KEY must be a service-account JSON key (a JSON file with type \"service_account\")"

[[ "$APP_ID" =~ ^1:[0-9]+:android:[0-9a-f]+$ ]] \
  || die "app id must look like 1:1234567890:android:0a1b2c3d4e5f67890 (Firebase console, Project settings, General), got '$APP_ID'"

if (( DRY_RUN )); then
  echo "gh secret set FIREBASE_SERVICE_ACCOUNT < $KEY"
  echo "gh secret set FIREBASE_APP_ID --body $APP_ID"
  exit 0
fi

command -v gh >/dev/null || die "the GitHub CLI (gh) is required"
gh secret set FIREBASE_SERVICE_ACCOUNT < "$KEY"
gh secret set FIREBASE_APP_ID --body "$APP_ID"
echo "firebase-secrets: set FIREBASE_SERVICE_ACCOUNT and FIREBASE_APP_ID"
