# Motor control server

The server accepts control-board commands over WebSocket and drives two motors
through a PH/EN motor driver. Never connect a motor directly to Raspberry Pi
GPIO. Use a separate motor supply and connect the Pi and driver grounds.

## GPIO mapping (BCM)

| Signal | BCM GPIO | Physical pin |
|---|---:|---:|
| Motor A EN | 18 | 12 |
| Motor A PH | 23 | 16 |
| Motor B EN | 19 | 35 |
| Motor B PH | 24 | 18 |

## Install and run on Raspberry Pi

```bash
sudo apt update
sudo apt install -y python3-gpiozero python3-lgpio python3-websockets
cd ~/dev/SFR/motor
python3 motor_server.py
```

The server listens on all LAN interfaces at port `8765`. The control board
connects to `ws://makelab.local:8765` by default. Press `Ctrl+C` to stop the
server; all motor outputs are set to zero before GPIO is closed.

Motor A always uses PWM `0.9` and Motor B always uses PWM `0.6`, matching the
values in `motor_test.py`. The control-board slider changes only Motor A's auto
direction delay (`0.25` to `5` seconds); it does not change motor PWM.

Optional settings:

```bash
python3 motor_server.py --port 8765 --auto-interval 0.5
```

For initial testing, lift the wheels off the ground and keep the motor power
switch within reach. This development server has no authentication and must
not be exposed to the public internet.

For automatic startup with the web server after a Pi reboot, install the
systemd units in `../systemd` after both servers have been tested manually.

## Copy from Windows

Run from `C:\dev\SFR` in PowerShell:

```powershell
scp .\pi\motor\motor_server.py makelab@makelab.local:~/dev/SFR/motor/
```
