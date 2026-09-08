# Raspberry Pi automatic startup

The Pi starts only the camera publisher and motor server. MediaMTX and the
control-board web server run on the Windows PC to keep WebRTC load off the Pi
Zero.

The Windows hotspot address is configured in `sfr-camera.env` and defaults to
`192.168.137.1`.

## Install

From Windows PowerShell in `C:\dev\SFR`:

```powershell
scp -r .\pi\systemd makelab@<PI_IP>:~/dev/SFR/
```

Then on the Pi:

```bash
cd ~/dev/SFR/systemd
chmod +x install.sh
./install.sh
```

The installer disables and removes the old Pi MediaMTX and web units, then
enables the camera and motor units.

## Check

```bash
systemctl is-active sfr-camera sfr-motor
sudo journalctl -u sfr-camera -u sfr-motor -f
```

If the Windows hotspot uses a different address, edit
`/etc/default/sfr-camera` and restart the publisher:

```bash
sudo nano /etc/default/sfr-camera
sudo systemctl restart sfr-camera
```
