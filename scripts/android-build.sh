#!/usr/bin/env bash
# Sync android/ to the dev VM and run builds / adb there. One-way: the VM copy is disposable.
set -euo pipefail

VM="${ANDROID_VM:-wheat@bacta-android}"
REMOTE_BASE="${ANDROID_REMOTE_BASE:-/home/wheat/work}"
PROJECT="${ANDROID_PROJECT-bacta-android}"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=8 -o ServerAliveInterval=30)
DRY_RUN=0

die() { echo "android-build: $*" >&2; exit 1; }
usage() { echo "usage: android-build.sh [--dry-run] sync|build [tasks...]|apk|install <ip:port>|adb <args...>|screenshot <ip:port>" >&2; exit 2; }

if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=1; shift; fi
CMD="${1:-}"; [[ -n "$CMD" ]] || usage
shift

[[ "$PROJECT" =~ ^[A-Za-z0-9._-]+$ && "$PROJECT" != "." && "$PROJECT" != ".." ]] \
  || die "ANDROID_PROJECT must be a plain directory name (letters, digits, . _ -), got '$PROJECT'"
# Whitelist characters (the path is single-quoted into a remote shell command) and reject any
# '..' component: in a glob, '*' matches '..', so '/home/../etc/x' would otherwise pass.
[[ "$REMOTE_BASE" =~ ^/home/[A-Za-z0-9._-]+/[A-Za-z0-9._/-]+$ && "$REMOTE_BASE/" != */../* ]] \
  || die "ANDROID_REMOTE_BASE must be a plain directory under a user's home (e.g. /home/wheat/work), got '$REMOTE_BASE'"

SRC="${ANDROID_SRC:-$(git rev-parse --show-toplevel)/android}"
[[ -d "$SRC" ]] || die "source directory not found: $SRC"
REMOTE_DIR="$REMOTE_BASE/$PROJECT"
APK_REMOTE="$REMOTE_DIR/app/build/outputs/apk/debug/app-debug.apk"

run() { if (( DRY_RUN )); then echo "$*"; else "$@"; fi }

do_sync() {
  run ssh "${SSH_OPTS[@]}" "$VM" "mkdir -p '$REMOTE_DIR'"
  run rsync -az --delete --exclude build --exclude .gradle --exclude local.properties --exclude .idea \
    -e "ssh ${SSH_OPTS[*]}" "$SRC/" "$VM:$REMOTE_DIR/"
}

case "$CMD" in
  sync)
    do_sync ;;
  build)
    do_sync
    run ssh "${SSH_OPTS[@]}" "$VM" "cd '$REMOTE_DIR' && ./gradlew --console=plain ${*:-assembleDebug}" ;;
  apk)
    mkdir -p /tmp/bacta-android
    run scp "${SSH_OPTS[@]}" "$VM:$APK_REMOTE" /tmp/bacta-android/ ;;
  install)
    [[ -n "${1:-}" ]] || die "install needs the phone address, e.g. 192.168.1.50:37123"
    run ssh "${SSH_OPTS[@]}" "$VM" "adb -s $1 install -r '$APK_REMOTE'" ;;
  adb)
    run ssh "${SSH_OPTS[@]}" "$VM" adb "$@" ;;
  screenshot)
    [[ -n "${1:-}" ]] || die "screenshot needs the phone address, e.g. 192.168.1.50:37123"
    mkdir -p /tmp/bacta-android
    if (( DRY_RUN )); then echo "ssh $VM adb -s $1 exec-out screencap -p > /tmp/bacta-android/screen.png"
    else ssh "${SSH_OPTS[@]}" "$VM" "adb -s $1 exec-out screencap -p" > /tmp/bacta-android/screen.png; fi ;;
  *)
    usage ;;
esac
