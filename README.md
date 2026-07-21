# SFR

Raspberry Pi Zero camera streaming and motor control project. The current
milestone implements camera streaming from an IMX219 CSI camera to a Windows
or Quest browser.

## First streaming test

All devices must be on the same LAN.

1. Follow [gateway/README.md](gateway/README.md) and start MediaMTX on Windows.
2. Copy `pi/camera` to the Raspberry Pi and run `stream-camera.sh` with the
   Windows PC IPv4 address in `GATEWAY_HOST`.
3. Follow [web/README.md](web/README.md), start the static server, and open the
   browser client.

Data flow:

```text
IMX219 CSI camera
  → rpicam-vid (H.264 in MPEG-TS)
  → UDP :15000
  → MediaMTX on Windows
  → WebRTC :8889
  → browser
```

See [architecture.md](architecture.md) for the planned motor-control and Quest
WebXR architecture.
