# Browser client

The first version embeds the WebRTC player served by MediaMTX. It has no npm
dependencies and does not need a build step.

Start the static web server from the repository root:

```powershell
.\web\serve.ps1
```

Open this URL on the Windows PC:

```text
http://localhost:8080
```

To test another device on the same LAN, including Quest Browser, use the
Windows PC LAN address:

```text
http://WINDOWS_PC_IP:8080
```

The form defaults to the host that served this page, port `8889`, and stream
path `camera`. The current iframe implementation is suitable for desktop and
initial Quest Browser testing. Direct WHEP playback into a video element will
replace it when WebXR texture access is implemented.

