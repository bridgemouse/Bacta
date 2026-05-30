#!/usr/bin/env bash
# bootstrap-lxc.sh — provision LXC 109 (bacta) from scratch
# Run as root inside the container:
#   curl -fsSL https://raw.githubusercontent.com/bridgemouse/Bacta/main/scripts/bootstrap-lxc.sh | bash
# Or after cloning:
#   sudo bash scripts/bootstrap-lxc.sh
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
APP_USER="wheat"
APP_DIR="/opt/bacta"
DATA_DIR="$APP_DIR/data"
INSIGHTS_DIR="$APP_DIR/insights"
NFS_HOST="192.168.1.202"          # LXC 106
NFS_EXPORT="/srv/nfs/vault"
NFS_MOUNT="/mnt/vault"
GH_RUNNER_DIR="/home/$APP_USER/actions-runner"
GH_REPO="https://github.com/bridgemouse/Bacta"
NODE_MAJOR=20
# ──────────────────────────────────────────────────────────────────────────────

log() { echo -e "\n\033[1;36m▶ $*\033[0m"; }

# ── 1. System packages ────────────────────────────────────────────────────────
log "Installing system packages"
apt-get update -qq
apt-get install -y -qq \
    curl wget git gnupg ca-certificates \
    nfs-common \
    python3 python3-pip python3-venv \
    build-essential \
    jq

# ── 2. Node.js 20 via NodeSource ──────────────────────────────────────────────
log "Installing Node.js $NODE_MAJOR"
if ! node --version 2>/dev/null | grep -q "^v$NODE_MAJOR"; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
    apt-get install -y nodejs
fi
node --version
npm --version

# ── 3. App user ───────────────────────────────────────────────────────────────
log "Ensuring user $APP_USER exists"
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$APP_USER"
fi

# ── 4. NFS vault mount ────────────────────────────────────────────────────────
log "Setting up NFS vault mount at $NFS_MOUNT"
mkdir -p "$NFS_MOUNT"
FSTAB_ENTRY="$NFS_HOST:$NFS_EXPORT  $NFS_MOUNT  nfs  ro,defaults,_netdev  0  0"
if ! grep -qF "$NFS_HOST:$NFS_EXPORT" /etc/fstab; then
    echo "$FSTAB_ENTRY" >> /etc/fstab
    echo "Added to /etc/fstab"
else
    echo "Already in /etc/fstab — skipping"
fi
mount -a || echo "WARNING: mount -a failed — vault may not be reachable yet. Will retry on next boot."

# ── 5. App directories ────────────────────────────────────────────────────────
log "Creating app directories at $APP_DIR"
mkdir -p "$DATA_DIR" "$INSIGHTS_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ── 6. Clone / update repo ───────────────────────────────────────────────────
log "Setting up repo in $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" pull
else
    git clone "$GH_REPO" "$APP_DIR"
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

# ── 7. Install npm deps & build ───────────────────────────────────────────────
log "Installing npm dependencies and building"
# Remove Windows-only Rolldown binding so Linux can install correctly
su - "$APP_USER" -c "cd $APP_DIR && npm pkg delete dependencies['@rolldown/binding-win32-x64-msvc'] 2>/dev/null || true"
su - "$APP_USER" -c "cd $APP_DIR && npm ci --omit=dev 2>/dev/null || npm ci"
su - "$APP_USER" -c "cd $APP_DIR && npm run build"

# ── 8. Bacta API systemd service ──────────────────────────────────────────────
log "Installing bacta-api systemd service"
cat > /etc/systemd/system/bacta-api.service <<EOF
[Unit]
Description=Bacta API Server
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable bacta-api
systemctl restart bacta-api
echo "bacta-api service status:"
systemctl status bacta-api --no-pager || true

# ── 9. GitHub Actions self-hosted runner ──────────────────────────────────────
log "Setting up GitHub Actions self-hosted runner"
mkdir -p "$GH_RUNNER_DIR"
chown "$APP_USER:$APP_USER" "$GH_RUNNER_DIR"

# Fetch latest runner version
RUNNER_VERSION=$(curl -s https://api.github.com/repos/actions/runner/releases/latest | jq -r '.tag_name' | sed 's/^v//')
RUNNER_TAR="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"

if [ ! -f "$GH_RUNNER_DIR/run.sh" ]; then
    su - "$APP_USER" -c "
        cd $GH_RUNNER_DIR
        curl -fsSL https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_TAR} -o runner.tar.gz
        tar xzf runner.tar.gz
        rm runner.tar.gz
    "
    echo ""
    echo "══════════════════════════════════════════════════════════════════"
    echo "  Runner downloaded. You must now register it manually:"
    echo ""
    echo "  1. Go to: https://github.com/bridgemouse/Bacta/settings/actions/runners/new"
    echo "  2. Copy the token from the page"
    echo "  3. Run as $APP_USER:"
    echo ""
    echo "     su - $APP_USER"
    echo "     cd $GH_RUNNER_DIR"
    echo "     ./config.sh --url $GH_REPO --token <YOUR_TOKEN> --name lxc109-bacta --labels bacta,self-hosted --unattended"
    echo ""
    echo "  4. Then come back and run:"
    echo "     sudo bash $APP_DIR/scripts/install-runner-service.sh"
    echo "══════════════════════════════════════════════════════════════════"
else
    echo "Runner already configured — skipping download"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
log "Bootstrap complete"
echo ""
echo "Next steps:"
echo "  1. Register the GitHub Actions runner (see instructions above)"
echo "  2. After registration, run: sudo bash $APP_DIR/scripts/install-runner-service.sh"
echo "  3. Add Garmin tokens: scp <tokens> wheat@<lxc108-ip>:~/.garminconnect/garmin_tokens.json"
echo "  4. Add LXC 108 to pve-startup.sh and service-monitor.sh"
