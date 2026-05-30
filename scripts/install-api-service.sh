#!/usr/bin/env bash
# install-api-service.sh — install bacta-api as a systemd service
# Run as root: sudo bash scripts/install-api-service.sh
set -euo pipefail

SERVICE_FILE=/etc/systemd/system/bacta-api.service

printf '[Unit]\nDescription=Bacta API Server\nAfter=network.target\n\n[Service]\nType=simple\nUser=wheat\nWorkingDirectory=/opt/bacta\nExecStart=/usr/bin/node dist/server/index.js\nRestart=always\nRestartSec=5\nEnvironment=NODE_ENV=production\nEnvironment=PORT=3001\n\n[Install]\nWantedBy=multi-user.target\n' > "$SERVICE_FILE"

systemctl daemon-reload
systemctl enable bacta-api
systemctl restart bacta-api
systemctl status bacta-api --no-pager
