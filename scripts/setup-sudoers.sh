#!/usr/bin/env bash
# setup-sudoers.sh — grant wheat passwordless sudo for service restart only
# Run as root: sudo bash scripts/setup-sudoers.sh
set -euo pipefail

SUDOERS_FILE="/etc/sudoers.d/bacta"

cat > "$SUDOERS_FILE" <<'EOF'
# Allow wheat to restart bacta-api without a password (needed by GitHub Actions runner)
wheat ALL=(ALL) NOPASSWD: /bin/systemctl restart bacta-api
EOF

chmod 440 "$SUDOERS_FILE"
visudo -cf "$SUDOERS_FILE" && echo "sudoers entry installed OK" || echo "ERROR: invalid sudoers syntax"
