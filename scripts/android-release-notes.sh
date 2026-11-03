#!/usr/bin/env bash
# android-release-notes.sh android-vMAJOR.MINOR.PATCH -> release notes on stdout.
# Lists non-merge commits that touch android/ since the previous android-v* tag (newest first).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tag="${1:-}"
max="${ANDROID_NOTES_MAX:-20}"

# android-version.sh owns the definition of a valid tag and exits non-zero with its own message.
version_line="$(bash "$here/android-version.sh" "$tag")"
version="${version_line%% *}"

mapfile -t tags < <(git tag --list 'android-v*' --sort=-version:refname)
prev=""
found=0
for t in "${tags[@]}"; do
  if (( found )); then prev="$t"; break; fi
  [[ "$t" == "$tag" ]] && found=1
done
if (( ! found )) && (( ${#tags[@]} > 0 )); then prev="${tags[0]}"; fi

if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then end="$tag"; else end="HEAD"; fi
if [[ -n "$prev" ]]; then range="$prev..$end"; else range="$end"; fi

mapfile -t subjects < <(git log --no-merges --format=%s "$range" -- android/ | head -n "$max")

echo "Bacta Android $version"
echo
if (( ${#subjects[@]} > 0 )); then
  printf -- '- %s\n' "${subjects[@]}"
elif [[ -n "$prev" ]]; then
  echo "- No Android changes since $prev"
else
  echo "- First Android release"
fi
