# Browser client

The page embeds the WebRTC player served by MediaMTX and includes a touch motor
control board. It has no npm dependencies and does not need a build step.

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

## Motor control

Start `motor_server.py` on the Pi, then use the motor connection form. Its
default address is `ws://makelab.local:8765`.

- Hold Forward or Backward to run that motor; releasing immediately stops it.
- Motor A and B can be held simultaneously.
- Motor A uses PWM `0.9` and Motor B uses PWM `0.6`, matching `motor_test.py`.
- Motor A auto mode alternates direction using the delay selected on the page.
- The delay slider changes only the auto-mode direction interval, not PWM.
- Losing the browser connection stops all motors on the Pi.

The web server must listen on the LAN and Windows Firewall must allow private
network access to TCP port `8080`. Do not expose the web or motor server to the
public internet.
