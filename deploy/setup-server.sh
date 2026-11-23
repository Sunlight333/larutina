#!/usr/bin/env bash
# One-time (and re-runnable) server provisioning for Ubuntu 24.04, as root:
#   curl -fsSL https://raw.githubusercontent.com/Sunlight333/larutina/main/deploy/setup-server.sh | bash
# or, with the repo already cloned:  bash /opt/larutina/deploy/setup-server.sh
#
# Installs Docker, opens only SSH/HTTP/HTTPS, enables fail2ban, clones the
# repo to /opt/larutina and installs the auto-deploy timer. Safe to rerun.
set -euo pipefail

REPO_URL=${REPO_URL:-https://github.com/Sunlight333/larutina.git}
APP_DIR=/opt/larutina
SITE_DOMAIN=${SITE_DOMAIN:-larutinabeauty.com}

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl git ufw fail2ban unattended-upgrades

# Docker Engine + Compose plugin from Docker's apt repository.
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

# Firewall: SSH, HTTP, HTTPS (and HTTP/3). Docker-published ports are 80/443 only.
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban

# Code.
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
chmod +x "$APP_DIR/deploy/deploy.sh"
ln -sf "$APP_DIR/deploy/deploy.sh" /usr/local/bin/larutina-deploy

# Server-local settings (git-ignored).
if [ ! -f "$APP_DIR/deploy/.env" ]; then
  echo "SITE_DOMAIN=$SITE_DOMAIN" > "$APP_DIR/deploy/.env"
fi

# Auto-deploy: every minute, deploy origin/main if it changed.
install -m 0644 "$APP_DIR/deploy/systemd/larutina-deploy.service" /etc/systemd/system/
install -m 0644 "$APP_DIR/deploy/systemd/larutina-deploy.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now larutina-deploy.timer

echo "Server ready. First deploy: larutina-deploy"
