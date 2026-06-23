#!/usr/bin/env bash
# DEPRECATED: Garmin is now managed by install-health-poller.sh
# This script is kept for reference only. Use install-health-poller.sh instead.
echo "WARNING: This script is deprecated. Run install-health-poller.sh instead."
exit 1
# Install the Garmin nightly poller as a systemd service + timer.
# Run as: bash /opt/bacta/scripts/install-garmin-poller.sh
set -e

UNIT_DIR=/etc/systemd/system
SCRIPT=/opt/bacta/scripts/garmin_poller.py
DB_DIR=/opt/bacta/data
USER=wheat

# Ensure DB directory exists
mkdir -p "$DB_DIR"

# ── Service unit ──────────────────────────────────────────────────────────────
printf '[Unit]\nDescription=Bacta Garmin nightly poller\nAfter=network.target\n\n[Service]\nType=oneshot\nUser=%s\nEnvironment=BACTA_DB=%s/bacta.db\nExecStart=/usr/bin/python3 %s\nStandardOutput=journal\nStandardError=journal\n' \
  "$USER" "$DB_DIR" "$SCRIPT" \
  | sudo tee "$UNIT_DIR/bacta-garmin.service" > /dev/null

# ── Timer unit (runs at 3:00 AM daily) ────────────────────────────────────────
printf '[Unit]\nDescription=Bacta Garmin nightly poller timer\n\n[Timer]\nOnCalendar=*-*-* 03:00:00\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n' \
  | sudo tee "$UNIT_DIR/bacta-garmin.timer" > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable --now bacta-garmin.timer

echo "Installed. Timer status:"
sudo systemctl status bacta-garmin.timer --no-pager
