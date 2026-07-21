# Raspberry Pi Camera Streaming and Motor Control Architecture

## 1. 목적

Raspberry Pi Zero 1에 CSI 카메라와 모터를 연결하고, 원격 클라이언트에서 다음 기능을 제공한다.

- 카메라 영상의 저지연 실시간 스트리밍
- `go`, `stop` 명령을 이용한 최소 모터 제어
- 초기 Windows 브라우저 지원
- 향후 Meta Quest 3 브라우저 및 WebXR 지원
- 모터 구성이 DC 모터 2개 또는 서보 모터 3개로 변경되어도 상위 코드 재사용

## 2. 핵심 결정

| 영역 | 결정 | 이유 |
|---|---|---|
| 영상 전송 | WebRTC | Windows와 Quest의 브라우저에서 공통으로 사용할 수 있고 지연이 짧다. |
| 영상 코덱 | H.264 하드웨어 인코딩 | Pi Zero 1에서 소프트웨어 인코딩 부하를 피한다. |
| 모터 제어 | WebSocket 하나만 사용 | 구현과 디버깅이 단순하며 현재 명령 크기와 빈도에 충분하다. |
| 클라이언트 | 브라우저 기반 웹 앱 | Windows와 Quest가 같은 통신 및 애플리케이션 코드를 공유한다. |
| 모터 구현 | 교체 가능한 `MotorDriver` | 모터 구성이 확정되지 않아도 나머지 시스템을 개발할 수 있다. |
| 안전장치 | Pi 내부 watchdog | 네트워크 또는 클라이언트 장애 시 모터를 자동 정지한다. |

WebRTC DataChannel은 현재 사용하지 않는다. 실제 측정 결과 WebSocket이 요구사항을 충족하지 못할 때만 별도 검토한다.

### 2.1 현재 구현 및 검증 상태

2026-07-21 기준으로 영상 스트리밍의 다음 end-to-end 경로를 실제 장치에서 검증했다.

```text
IMX219 CSI camera
  → Raspberry Pi Zero 1
  → bcm2835-codec hardware H.264 encoder
  → MPEG-TS/UDP :15000 (payload 1316 bytes)
  → MediaMTX on Windows
  → WebRTC :8889 / media UDP :8189
  → Windows browser
```

| 항목 | 상태 |
|---|---|
| IMX219 감지 | 완료 |
| 640×480, 15fps capture | 완료 |
| `/dev/video11` hardware H.264 encoding | 완료 |
| Pi에서 Windows로 MPEG-TS/UDP 송출 | 완료 |
| MediaMTX MPEG-TS ingest | 완료 |
| MediaMTX WebRTC browser playback | 완료 |
| 프로젝트 웹 화면의 embedded player | 완료 |
| Quest Browser 2D 재생 | 미검증 |
| WebXR video texture | 미구현 |
| 모터 제어 | 미구현 |

## 3. 시스템 구성

```text
┌──────────────────────────────────────────┐
│ Windows 또는 Quest 브라우저             │
│                                          │
│  WebRTCClient ───────── 영상 수신        │
│  ControlClient ──────── 명령 전송        │
│  DesktopView / XRView                    │
└──────────────┬────────────────▲──────────┘
               │ WebSocket/WSS  │ WebRTC
               ▼                │
┌──────────────────────────────────────────┐
│ Gateway                                  │
│ 초기 배치: Windows PC                    │
│                                          │
│  Web server                              │
│  WebRTC signaling/media gateway          │
│  선택 사항: WebSocket reverse proxy      │
└──────────────┬────────────────▲──────────┘
               │                │ H.264
               │                │
┌──────────────▼────────────────┴──────────┐
│ Raspberry Pi Zero 1                      │
│                                          │
│  CameraService                           │
│    CSI → H.264 hardware encoder          │
│                                          │
│  ControlWebSocketServer                  │
│    → MotionController                    │
│    → MotorDriver                         │
│                                          │
│  MotorWatchdog                           │
└──────────────────────────────────────────┘
```

Gateway는 Pi Zero 1의 부하를 줄이기 위해 WebRTC 연결 협상과 브라우저 전달을 담당한다. 초기에는 Windows PC에서 실행한다. 향후 항상 켜져 있는 별도 서버, 더 성능이 좋은 Raspberry Pi 또는 클라우드로 이동할 수 있다.

같은 LAN에서 초기 개발할 때 클라이언트가 Pi의 `ws://` endpoint에 직접 연결할 수 있다. 웹 앱을 HTTPS로 제공하는 배포 환경에서는 mixed-content 제한을 피하기 위해 Gateway가 `wss://` endpoint를 제공하고 Pi로 명령을 중계한다.

## 4. Raspberry Pi 구성

### 4.1 CameraService

#### 확인된 카메라 하드웨어

2026-07-21에 Raspberry Pi에서 `rpicam-hello`를 실행해 다음 항목을 확인했다.

| 항목 | 확인값 |
|---|---|
| 카메라 센서 | Sony IMX219 |
| libcamera | `v0.7.1+rpt20260609` |
| 파이프라인 | `rpi/vc4` |
| 파이프라인 설정 | `/usr/share/libcamera/pipeline/rpi/vc4/rpi_apps.yaml` |
| 센서 튜닝 파일 | `/usr/share/libcamera/ipa/rpi/vc4/imx219.json` |
| 카메라 경로 | `/base/soc/i2c0mux/i2c@1/imx219@10` |
| 당시 Unicam 장치 | `/dev/media3` |
| 당시 ISP 장치 | `/dev/media0` |

로그에 카메라 추가와 Unicam/ISP 등록이 정상적으로 나타났으며 카메라 감지 오류는 없었다. IMX219는 Camera Module v2에 일반적으로 사용되는 센서지만, 이 문서에서는 모듈 제품명까지 확정하지 않고 센서 모델만 확인된 정보로 취급한다. `/dev/mediaN` 번호는 부팅 또는 장치 구성에 따라 달라질 수 있으므로 애플리케이션에서 고정값으로 가정하지 않는다.

확인에 사용한 명령은 다음과 같다.

```bash
rpicam-hello
rpicam-hello --list-cameras
```

카메라 감지뿐 아니라 실제 H.264 출력도 확인했다. `rpicam-vid` 실행 로그에서 `/dev/video11`의 `bcm2835-codec-encode`와 `h264_v4l2m2m` 사용을 확인했으므로 현재 Pi Zero 1에서는 하드웨어 인코딩 경로가 사용된다.

```bash
rpicam-still -n -o test.jpg

rpicam-vid -n -t 5000 \
  --width 640 \
  --height 480 \
  --framerate 15 \
  --bitrate 1000000 \
  --codec h264 \
  -o test.h264
```

영상 경로는 다음과 같다.

```text
CSI Camera
  → rpicam-vid 또는 동등한 카메라 파이프라인
  → H.264 hardware encoder
  → MPEG-TS over UDP (`Windows_IP:15000`)
  → MediaMTX WebRTC Gateway
  → Browser MediaStream
```

첫 구현에서는 `rpicam-vid`의 libav backend가 H.264를 MPEG-TS로 감싸 Windows PC의 UDP 15000번 포트로 보낸다. UDP payload는 MPEG-TS packet 7개에 해당하는 1316바이트로 고정한다. MediaMTX의 `camera` path가 이를 수신하고 TCP 8889번 포트의 WebRTC player 및 WHEP endpoint로 제공한다. WebRTC media용 UDP 8189번 포트도 사용한다.

```text
Pi:       rpicam-vid → udp://WINDOWS_IP:15000?pkt_size=1316
Gateway:  udp+mpegts://0.0.0.0:15000 → MediaMTX path `camera`
Browser:  http://WINDOWS_IP:8889/camera
```

초기 웹 클라이언트는 MediaMTX의 공식 WebRTC player를 iframe으로 포함한다. 이 구현은 Windows 및 Quest Browser의 2D 검증용이다. WebXR에서 video texture에 직접 접근하는 단계에서는 iframe을 WHEP JavaScript reader와 HTML video element로 교체한다.

Python 애플리케이션에서 프레임을 읽거나 JPEG/H.264로 재인코딩하지 않는다. `CameraService`는 외부 카메라 프로세스의 실행, 상태 확인, 재시작과 종료만 담당한다.

초기 영상 설정은 다음 값을 기준으로 하며 실제 장치에서 지연, 화질, CPU 사용률을 측정한 후 조정한다.

```yaml
camera:
  sensor: imx219
  width: 640
  height: 480
  fps: 15
  bitrate: 1000000
  codec: h264
```

실제 구현은 [pi/camera/stream-camera.sh](pi/camera/stream-camera.sh)에 있으며 주요 encoder/output 옵션은 다음과 같다.

```text
--profile baseline
--inline
--codec libav
--libav-format mpegts
--output udp://WINDOWS_IP:15000?pkt_size=1316
```

`--inline`은 H.264 parameter set을 스트림 안에 주기적으로 포함하며, `baseline` profile은 브라우저 호환성을 위한 초기값이다. UDP payload `1316`은 188바이트 MPEG-TS packet 7개로 구성해 packet 경계가 어긋나는 문제를 줄인다.

현재 MediaMTX 설정은 다음과 같다.

```yaml
logLevel: info
udpReadBufferSize: 1000000

webrtc: true
webrtcAddress: :8889
webrtcAllowOrigins: ["*"]
webrtcLocalUDPAddress: :8189

paths:
  camera:
    source: udp+mpegts://0.0.0.0:15000
```

### 4.2 ControlWebSocketServer

WebSocket 연결과 JSON 메시지를 처리한다. 역할은 다음으로 제한한다.

1. 메시지 크기 및 형식 검증
2. 명령과 sequence 번호 파싱
3. `MotionController`에 유효한 명령 전달
4. watchdog 갱신
5. 처리 결과 응답
6. 연결 종료 시 모터 정지

WebSocket handler가 GPIO 또는 PWM을 직접 제어해서는 안 된다.

### 4.3 MotionController

통신 계층과 하드웨어 드라이버 사이의 애플리케이션 계층이다.

- 현재 이동 상태 관리
- 명령 직렬화
- 중복 명령 처리
- 명령 중복 및 상태 전환 정책 적용
- 각도 및 속도 제한 적용
- 일반 정지와 비상 정지 수행

### 4.4 MotorDriver

상위 계층이 실제 모터 구성을 알지 못하도록 공통 인터페이스를 사용한다.

```python
from typing import Protocol


class MotorDriver(Protocol):
    def execute(self, command: "MotionCommand") -> None:
        ...

    def stop(self) -> None:
        ...

    def emergency_stop(self) -> None:
        ...

    def close(self) -> None:
        ...
```

예정된 구현체는 다음과 같다.

- `MockMotorDriver`: GPIO 없이 통신과 UI 테스트
- `Dc2MotorDriver`: DC 모터 2개를 사용하는 차동 구동
- `Servo3MotorDriver`: 서보 모터 3개 구성

실행 시 설정으로 드라이버 하나를 선택한다.

```yaml
motor:
  driver: mock  # mock, dc2, servo3
```

### 4.5 MotorWatchdog

클라이언트는 동작 버튼을 누르는 동안 약 100ms마다 `go`를 반복 전송하고, 버튼을 놓으면 즉시 `stop`을 전송한다.

```text
button down: go → go → go → go
button up:                   stop
```

Pi는 마지막으로 유효한 이동 명령을 받은 후 기본 400ms 안에 다음 명령이 없으면 자동으로 정지한다.

다음 조건에서는 반드시 `stop` 또는 `emergency_stop`을 실행한다.

- watchdog timeout
- WebSocket 연결 종료
- 제어권을 가진 클라이언트의 교체
- 서버 처리 예외
- 애플리케이션 종료
- 초기화 실패

`stop` 명령은 `go`보다 우선 처리한다. `stop` 이후 도착한 오래된 sequence 번호의 `go`는 무시하며, 새로운 `go`를 받기 전까지 정지 상태를 유지한다.

## 5. 제어 프로토콜

### 5.1 명령 종류

```text
go | stop
```

- `go`: 현재 선택된 드라이버의 기본 동작을 시작하거나 계속한다.
- `stop`: 현재 동작을 즉시 안전하게 정지한다.

명령의 의미는 사용자 의도를 나타낸다. 구체적인 GPIO, PWM 또는 서보 각도는 `MotorDriver`가 결정한다.

### 5.2 요청

```json
{
  "type": "move",
  "command": "go",
  "seq": 42
}
```

- `type`: 현재는 `move`만 지원
- `command`: `go` 또는 `stop`
- `seq`: 클라이언트가 단조 증가시키는 정수

### 5.3 성공 응답

```json
{
  "type": "ack",
  "seq": 42,
  "accepted": true,
  "state": "go"
}
```

### 5.4 실패 응답

```json
{
  "type": "ack",
  "seq": 42,
  "accepted": false,
  "error": "invalid_command"
}
```

알 수 없는 필드, 명령 또는 과도하게 큰 메시지는 실행하지 않는다. 오류 응답을 전송할 수 없는 상태라면 연결을 종료하고 모터를 정지한다.

## 6. 모터별 명령 해석

현재 하드웨어 구성과 구동 방식이 정해지지 않았으므로 `go`의 구체적인 동작은 확정하지 않는다.

| 명령 | 공통 의미 |
|---|---|
| `go` | 선택된 모터 드라이버의 기본 동작 시작 또는 유지 |
| `stop` | 현재 동작을 안전하게 정지 |

`MockMotorDriver`는 내부 상태만 `go`로 변경한다. `Dc2MotorDriver`와 `Servo3MotorDriver`의 실제 출력은 모터 구성 확정 후 정의한다.

모터별 고려 사항은 다음과 같다.

- DC 모터의 `go`: 회전 방향, 속도와 두 모터의 조합을 추후 결정
- 위치 제어 서보의 `go`: 목표 위치 또는 이동 패턴을 추후 결정
- 위치 제어 서보의 `stop`: 현재 위치 유지 여부를 추후 결정
- 연속 회전 서보의 `stop`: 중립 PWM으로 회전 정지

향후 방향이나 개별 모터 제어가 필요해지면 새 명령을 프로토콜 버전 변경으로 추가한다. 기존 `go`와 `stop`의 의미는 가능한 한 유지한다.

## 7. 웹 클라이언트

클라이언트는 통신, 입력, 화면을 분리한다.

```text
WebRTCClient
  └─ WebRTC 연결 및 MediaStream 제공

ControlClient
  └─ WebSocket 연결, 명령 전송, ACK 처리

Input adapters
  ├─ KeyboardInput
  ├─ GamepadInput
  └─ XRControllerInput

Views
  ├─ DesktopView
  └─ XRView
```

모든 입력 장치는 최종적으로 `go` 또는 `stop`을 생성한다.

```text
Screen button ┐
Keyboard ─────┼→ MotionCommand → ControlClient
XR Controller ┘
```

Windows에서는 `DesktopView`가 HTML video element에 WebRTC `MediaStream`을 표시한다. Quest에서는 먼저 동일한 2D 화면을 Quest Browser에서 검증하고, 이후 `XRView`가 같은 video source를 WebXR 가상 화면에 표시한다.

## 8. 예상 저장소 구조

```text
SFR/
├─ architecture.md
├─ pi/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ config.py
│  │  ├─ camera/
│  │  │  ├─ service.py
│  │  │  └─ pipeline.py
│  │  ├─ control/
│  │  │  ├─ websocket_server.py
│  │  │  ├─ protocol.py
│  │  │  ├─ motion_controller.py
│  │  │  └─ watchdog.py
│  │  └─ motor/
│  │     ├─ base.py
│  │     ├─ mock_driver.py
│  │     ├─ dc2_driver.py
│  │     └─ servo3_driver.py
│  ├─ tests/
│  └─ systemd/
│     └─ sfr.service
├─ gateway/
│  ├─ config/
│  └─ README.md
└─ web/
   ├─ src/
   │  ├─ main.ts
   │  ├─ api/
   │  │  ├─ WebRTCClient.ts
   │  │  └─ ControlClient.ts
   │  ├─ input/
   │  │  ├─ KeyboardInput.ts
   │  │  ├─ GamepadInput.ts
   │  │  └─ XRControllerInput.ts
   │  ├─ views/
   │  │  ├─ DesktopView.ts
   │  │  └─ XRView.ts
   │  └─ protocol/
   │     └─ command.ts
   └─ package.json
```

## 9. 주요 실행 흐름

### 9.1 시작

```text
Pi boot
  → MotorDriver를 안전한 정지 상태로 초기화
  → MotorWatchdog 시작
  → ControlWebSocketServer 시작
  → CameraService 시작
  → Gateway가 H.264 입력 수신
  → Browser가 WebRTC 및 WebSocket 연결
```

카메라 시작 실패가 모터를 움직이게 해서는 안 된다. 모터 서비스 시작 실패 또한 카메라 프로세스에 잘못된 GPIO 상태를 남겨서는 안 된다.

### 9.2 이동

```text
사용자가 동작 버튼을 누름
  → Input adapter가 명령 생성
  → ControlClient가 WebSocket 메시지 전송
  → 서버가 메시지 검증
  → watchdog 갱신
  → MotionController 실행
  → 선택된 MotorDriver가 하드웨어 제어
  → ACK 반환
```

### 9.3 연결 장애

```text
Wi-Fi 또는 브라우저 연결 끊김
  → 반복 명령 중단
  → WebSocket close 또는 watchdog timeout
  → MotionController.stop()
  → MotorDriver가 안전한 출력 적용
```

### 9.4 검증된 영상 실행 절차

Windows에서 MediaMTX를 먼저 실행한다.

```powershell
cd C:\dev\SFR
.\gateway\mediamtx.exe .\gateway\mediamtx.yml
```

Pi에서 Windows의 실제 LAN IPv4 주소를 지정해 publisher를 실행한다.

```bash
cd ~/dev/SFR/camera
GATEWAY_HOST=<WINDOWS_LAN_IP> ./stream-camera.sh
```

스크립트의 첫 출력이 아래 형식인지 확인한다.

```text
Streaming 640x480@15 to <WINDOWS_LAN_IP>:15000
```

MediaMTX가 stream을 인식한 후 Windows 브라우저에서 기본 player를 연다.

```text
http://localhost:8889/camera
```

프로젝트 웹 화면이 필요하면 별도 Windows terminal에서 정적 서버를 실행한다.

```powershell
cd C:\dev\SFR
py -m http.server 8080 --directory web
```

```text
http://localhost:8080
```

Windows 이외의 LAN client에서는 `localhost` 대신 Windows LAN IP를 사용한다. Windows IP가 DHCP로 변경되면 Pi의 `GATEWAY_HOST`도 변경해야 한다.

### 9.5 사용 포트

| 포트 | 프로토콜 | 방향 | 용도 |
|---:|---|---|---|
| 15000 | UDP | Pi → Windows | H.264/MPEG-TS ingest |
| 8889 | TCP | Browser → Windows | WebRTC HTTP signaling/player/WHEP |
| 8189 | UDP | Browser ↔ Windows | WebRTC media |
| 8080 | TCP | Browser → Windows | 프로젝트 정적 웹 화면, 개발 시에만 사용 |

Windows Firewall에서는 해당 네트워크 profile에 필요한 inbound port를 허용한다. 초기 LAN 개발 설정은 공용 인터넷에 노출하지 않는다.

### 9.6 확인된 장애와 해석

| 로그 또는 증상 | 의미 | 조치 |
|---|---|---|
| `bind: Only one usage of each socket address...` | MediaMTX가 사용할 UDP port를 다른 process가 점유 | `Get-NetUDPEndpoint -LocalPort <PORT>`로 PID를 확인하거나 비어 있는 port로 변경 |
| `read udp4 ... i/o timeout` | MediaMTX는 수신 대기 중이지만 Pi packet이 도착하지 않음 | Pi 송출 port, Windows LAN IP, network 대역 및 firewall 확인 |
| `decode errors ... skipped bytes` | MPEG-TS packet 경계 불일치 또는 UDP packet 손실 | sender URL에 `pkt_size=1316` 적용, `udpReadBufferSize` 증가, bitrate/network 확인 |
| `no stream is available on path 'camera'` | WebRTC 요청 시 MediaMTX에 정상 ingest된 track이 없음 | browser보다 먼저 MediaMTX와 Pi publisher 상태 확인 |

실제 환경에서 UDP 5000과 5001이 다른 Windows process와 충돌해 최종 ingest port를 15000으로 변경했다. 포트 값은 `gateway/mediamtx.yml`, Pi publisher와 Windows Firewall에서 동일해야 한다.

## 10. 배포 단계

### 1단계: 하드웨어 없이 제어 검증

- Pi 또는 개발 PC에서 `MockMotorDriver` 실행
- Windows 웹 앱에서 `go`/`stop` 버튼 및 키보드 입력 구현
- 명령 검증, ACK, watchdog, 연결 종료 동작 테스트

### 2단계: 영상 연결

- [x] CSI 카메라 H.264 출력 검증
- [x] Windows에서 MediaMTX WebRTC Gateway 실행
- [x] Windows 브라우저에서 영상 재생
- [x] UDP packet size 및 수신 buffer 조정
- [ ] 장시간 CPU 사용률, packet loss와 end-to-end 지연 측정

### 3단계: 실제 모터 연결

- 모터 종류와 드라이버 보드 확정
- `Dc2MotorDriver` 또는 `Servo3MotorDriver` 구현
- `go` 동작, PWM 범위, 각도 제한과 비상 정지 테스트

### 4단계: Quest 지원

- Quest Browser에서 기존 2D 웹 앱 검증
- HTTPS/WSS 배포 구성
- `XRView` 추가
- Quest controller 입력을 기존 `MotionCommand`에 매핑

## 11. 안전 및 운영 요구사항

- DC 모터는 Pi GPIO에서 직접 구동하지 않고 모터 드라이버와 별도 전원을 사용한다.
- Pi와 모터 드라이버는 공통 GND를 사용하되 모터 노이즈와 전압 강하를 고려한다.
- 부팅 중 GPIO 기본 상태는 모터 정지여야 한다.
- 한 번에 한 클라이언트만 제어권을 갖도록 한다.
- 인증되지 않은 외부 클라이언트가 제어 WebSocket에 접근하지 못하게 한다.
- 인터넷을 통한 접속에는 HTTPS, WSS, 인증 및 WebRTC TURN 구성을 추가한다.
- 서비스는 systemd로 실행하고 비정상 종료 시 안전 정지 후 재시작한다.
- 로그에 명령 종류와 오류는 남기되 고빈도 반복 명령을 무제한 기록하지 않는다.

## 12. 미확정 사항

다음 항목은 하드웨어 또는 실제 성능 측정 후 결정한다.

- DC 모터 2개와 서보 모터 3개 중 최종 구성
- 서보 모터의 종류와 각 모터의 역할
- `go`가 실행할 실제 모터 동작
- 모터 드라이버 보드와 GPIO pin mapping
- 이동 속도, PWM 범위 및 서보 각도 제한
- 좌우 회전 방식
- Gateway의 최종 배치 위치
- Quest에서 평면, 곡면 또는 몰입형 영상 중 최종 표시 방식

이 항목들은 각 모듈의 구현 또는 설정에 국한되며, WebRTC 영상, WebSocket 제어, 명령 프로토콜과 `MotorDriver` 추상화라는 전체 구조는 유지한다.
