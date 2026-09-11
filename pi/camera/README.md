# Pi camera publisher

The script uses `rpicam-vid` to encode H.264, wrap it in MPEG-TS, and publish
it over UDP without rotating or mirroring the source image.

## Run with MediaMTX on the same Pi

```bash
chmod +x stream-camera.sh
GATEWAY_HOST=127.0.0.1 ./stream-camera.sh
```

Optional environment variables:

```text
GATEWAY_PORT=15000
CAMERA_WIDTH=640
CAMERA_HEIGHT=360
CAMERA_MODE=1640:1232:10:P
CAMERA_FPS=15
CAMERA_BITRATE=1000000
CAMERA_INTRA=15
CAMERA_ROTATION=0
```

`CAMERA_MODE=1640:1232:10:P` forces the IMX219 full-sensor 2x2-binned
mode while keeping the encoded stream at `CAMERA_WIDTH` x `CAMERA_HEIGHT`.
This avoids the narrower field of view of the cropped 640x480 sensor mode.

The default `640x360`, 15 fps, 1 Mbps settings provide a 16:9 stream and are
intentionally conservative
for a Raspberry Pi Zero 1. The systemd configuration in `../systemd` starts
both MediaMTX and this publisher automatically at boot.
