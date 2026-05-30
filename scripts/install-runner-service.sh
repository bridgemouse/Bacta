#!/usr/bin/env bash
# install-runner-service.sh — install the GitHub Actions runner as a systemd service
# Run after ./config.sh has been completed:
#   sudo bash scripts/install-runner-service.sh
set -euo pipefail

APP_USER="wheat"
GH_RUNNER_DIR="/home/$APP_USER/actions-runner"

if [ ! -f "$GH_RUNNER_DIR/.runner" ]; then
    echo "ERROR: Runner not configured yet. Run config.sh first."
    echo "  cd $GH_RUNNER_DIR"
    echo "  ./config.sh --url https://github.com/bridgemouse/Bacta --token <TOKEN> --name lxc109-bacta --labels bacta,self-hosted --unattended"
    exit 1
fi

echo "Installing runner as systemd service..."
cd "$GH_RUNNER_DIR"
./svc.sh install "$APP_USER"
./svc.sh start

echo ""
echo "Runner service installed and started."
echo "Status:"
./svc.sh status
