#!/usr/bin/env bash
# Install the unified health poller as a systemd service + timer.
# Replaces install-garmin-poller.sh. Run as: bash /opt/bacta/scripts/install-health-poller.sh
set -e

UNIT_DIR=/etc/systemd/system
SCRIPT=/opt/bacta/scripts/health_poller.py
DB_DIR=/opt/bacta/data
USER=wheat

mkdir -p "$DB_DIR"

printf '[Unit]\nDescription=Bacta nightly health data poller\nAfter=network.target\n\n[Service]\nType=oneshot\nUser=%s\nEnvironment=BACTA_DB=%s/bacta.db\nExecStart=/usr/bin/python3 %s\nStandardOutput=journal\nStandardError=journal\n' \
  "$USER" "$DB_DIR" "$SCRIPT" \
  | sudo tee "$UNIT_DIR/bacta-health.service" > /dev/null

printf '[Unit]\nDescription=Bacta nightly health data poller timer\n\n[Timer]\nOnCalendar=*-*-* 03:00:00\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n' \
  | sudo tee "$UNIT_DIR/bacta-health.timer" > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable --now bacta-health.timer

echo "Installed bacta-health.timer. Status:"
sudo systemctl status bacta-health.timer --no-pager
