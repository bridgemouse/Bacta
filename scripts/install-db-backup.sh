#!/usr/bin/env bash
# Install the nightly Bacta DB backup as a systemd service + timer.
# Runs at 03:30 — after the 03:00 Garmin poll. Run as:
#   bash /opt/bacta/scripts/install-db-backup.sh
set -e

UNIT_DIR=/etc/systemd/system
SCRIPT=/opt/bacta/scripts/backup-db.js
BACKUP_DIR=/opt/bacta/backups
USER=wheat

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# ── Service unit ──────────────────────────────────────────────────────────────
printf '[Unit]\nDescription=Bacta DB nightly backup\nAfter=network.target\n\n[Service]\nType=oneshot\nUser=%s\nEnvironment=BACTA_DB=/opt/bacta/data/bacta.db\nEnvironment=BACTA_BACKUP_DIR=%s\nExecStart=/usr/bin/node %s\nStandardOutput=journal\nStandardError=journal\n' \
  "$USER" "$BACKUP_DIR" "$SCRIPT" \
  | sudo tee "$UNIT_DIR/bacta-backup.service" > /dev/null

# ── Timer unit (03:30 daily) ──────────────────────────────────────────────────
printf '[Unit]\nDescription=Bacta DB nightly backup timer\n\n[Timer]\nOnCalendar=*-*-* 03:30:00\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n' \
  | sudo tee "$UNIT_DIR/bacta-backup.timer" > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable --now bacta-backup.timer

echo "Installed. Timer status:"
sudo systemctl status bacta-backup.timer --no-pager

# NOTE (runbook): configure an OFF-BOX, ENCRYPTED copy of $BACKUP_DIR — e.g.
# rclone/scp the newest *.db.gz to another host or the NFS vault. See OPERATIONS.md.
