# Windows WebRTC gateway

MediaMTX receives H.264/MPEG-TS packets from the Pi on UDP port 15000 and
exposes the `camera` stream to browsers through WebRTC.

## Setup

1. Download the Windows amd64 standalone archive from the MediaMTX releases
   page: <https://github.com/bluenviron/mediamtx/releases>
2. Copy `mediamtx.exe` into this directory. The binary is intentionally
   excluded from Git.
3. Allow inbound UDP ports `15000` and `8189`, and inbound TCP port `8889` in
   Windows Firewall for private networks.
4. Start the gateway:

```powershell
.\gateway\start.ps1
```

The direct MediaMTX player is available at:

```text
http://WINDOWS_PC_IP:8889/camera
```

The stream appears after the Pi publisher starts sending packets. Do not open
these ports to the public internet; this initial configuration has no
authentication or TLS.
