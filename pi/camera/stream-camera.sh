#!/usr/bin/env bash
set -euo pipefail

: "${GATEWAY_HOST:?Set GATEWAY_HOST to the MediaMTX host address}"

GATEWAY_PORT="${GATEWAY_PORT:-15000}"
CAMERA_WIDTH="${CAMERA_WIDTH:-640}"
CAMERA_HEIGHT="${CAMERA_HEIGHT:-480}"
CAMERA_FPS="${CAMERA_FPS:-15}"
CAMERA_BITRATE="${CAMERA_BITRATE:-1000000}"
CAMERA_INTRA="${CAMERA_INTRA:-15}"
CAMERA_ROTATION="${CAMERA_ROTATION:-0}"

if ! command -v rpicam-vid >/dev/null 2>&1; then
  echo "rpicam-vid was not found. Install rpicam-apps first." >&2
  exit 1
fi

echo "Streaming ${CAMERA_WIDTH}x${CAMERA_HEIGHT}@${CAMERA_FPS} to ${GATEWAY_HOST}:${GATEWAY_PORT}"

exec rpicam-vid \
  --timeout 0 \
  --nopreview \
  --width "${CAMERA_WIDTH}" \
  --height "${CAMERA_HEIGHT}" \
  --framerate "${CAMERA_FPS}" \
  --rotation "${CAMERA_ROTATION}" \
  --bitrate "${CAMERA_BITRATE}" \
  --intra "${CAMERA_INTRA}" \
  --profile baseline \
  --inline \
  --codec libav \
  --libav-format mpegts \
  --output "udp://${GATEWAY_HOST}:${GATEWAY_PORT}?pkt_size=1316"
