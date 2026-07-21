# Pi camera publisher

This directory is the only part required on the Raspberry Pi for the first
streaming milestone.

## Run

Replace the address with the LAN IPv4 address of the Windows PC that runs
MediaMTX.

```bash
chmod +x stream-camera.sh
GATEWAY_HOST=192.168.0.10 ./stream-camera.sh
```

Optional environment variables:

```text
GATEWAY_PORT=15000
CAMERA_WIDTH=640
CAMERA_HEIGHT=480
CAMERA_FPS=15
CAMERA_BITRATE=1000000
CAMERA_INTRA=15
```

The script asks `rpicam-vid` to encode H.264 and wrap it in MPEG-TS. It sends
the resulting stream over UDP; it does not decode or re-encode frames in
Python.
