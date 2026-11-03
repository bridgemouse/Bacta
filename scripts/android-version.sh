#!/usr/bin/env bash
# android-version.sh android-vMAJOR.MINOR.PATCH -> "MAJOR.MINOR.PATCH versionCode"
# versionCode = major*10000 + minor*100 + patch, so minor and patch must stay <= 99
# (1.0.100 would otherwise equal 1.1.0).
set -euo pipefail

tag="${1:-}"
if [[ ! "$tag" =~ ^android-v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "android-version: tag must look like android-vMAJOR.MINOR.PATCH, got '$tag'" >&2
  exit 1
fi

major=$((10#${BASH_REMATCH[1]}))
minor=$((10#${BASH_REMATCH[2]}))
patch=$((10#${BASH_REMATCH[3]}))

if (( minor > 99 || patch > 99 || major > 999 )); then
  echo "android-version: major must be <= 999 and minor/patch <= 99 (versionCode would collide), got '$tag'" >&2
  exit 1
fi

echo "$major.$minor.$patch $(( major * 10000 + minor * 100 + patch ))"
