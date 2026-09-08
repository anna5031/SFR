#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="/home/makelab/dev/SFR"

if [[ ! -f "${PROJECT_DIR}/motor/motor_server.py" ]]; then
  echo "Missing ${PROJECT_DIR}/motor/motor_server.py" >&2
  exit 1
fi

if [[ ! -f "${PROJECT_DIR}/web/index.html" ]]; then
  echo "Missing ${PROJECT_DIR}/web/index.html" >&2
  exit 1
fi

if [[ ! -f "${PROJECT_DIR}/camera/stream-camera.sh" ]]; then
  echo "Missing ${PROJECT_DIR}/camera/stream-camera.sh" >&2
  exit 1
fi

sudo install -m 0644 "${SCRIPT_DIR}/sfr-motor.service" /etc/systemd/system/sfr-motor.service
sudo install -m 0644 "${SCRIPT_DIR}/sfr-camera.service" /etc/systemd/system/sfr-camera.service
sudo install -m 0644 "${SCRIPT_DIR}/sfr-camera.env" /etc/default/sfr-camera

sudo systemctl disable --now sfr-mediamtx.service sfr-web.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/sfr-mediamtx.service /etc/systemd/system/sfr-web.service
sudo systemctl daemon-reload
sudo systemctl enable --now \
  sfr-camera.service \
  sfr-motor.service

echo
echo "SFR services installed and started."
sudo systemctl --no-pager --full status \
  sfr-camera.service \
  sfr-motor.service || true
