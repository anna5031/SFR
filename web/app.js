const frame = document.querySelector("#stream-frame");
const placeholder = document.querySelector("#placeholder");
const videoForm = document.querySelector("#connection-form");
const status = document.querySelector("#status");
const streamUrlOutput = document.querySelector("#stream-url");
const motorForm = document.querySelector("#motor-connection-form");
const motorStatus = document.querySelector("#motor-status");
const motorHost = document.querySelector("#motor-host");
const motorPort = document.querySelector("#motor-port");
const autoDelay = document.querySelector("#auto-delay");
const delayOutput = document.querySelector("#delay-output");
const autoDescription = document.querySelector("#auto-description");
const autoButton = document.querySelector("#auto-button");
const holdButtons = [...document.querySelectorAll(".hold-button")];

const STREAM_STORAGE_KEY = "sfr-stream-settings";
const MOTOR_STORAGE_KEY = "sfr-motor-settings";
let motorSocket = null;
let autoEnabled = false;
const activePointers = new Map();

function setStatus(element, label, state) {
  element.textContent = label;
  element.dataset.state = state;
}

function sendMotor(message) {
  if (motorSocket?.readyState !== WebSocket.OPEN) return false;
  motorSocket.send(JSON.stringify(message));
  return true;
}

function stopMotor(motor) {
  sendMotor({ type: "stop", motor });
  for (const [pointerId, state] of activePointers) {
    if (state.motor === motor) {
      state.button.classList.remove("active");
      activePointers.delete(pointerId);
    }
  }
}

function stopManualMotors() {
  stopMotor("a");
  stopMotor("b");
}

function connectMotor() {
  motorSocket?.close();
  const host = motorHost.value.trim();
  const port = Number(motorPort.value);
  localStorage.setItem(MOTOR_STORAGE_KEY, JSON.stringify({ host, port }));
  setStatus(motorStatus, "연결 중", "connecting");
  motorSocket = new WebSocket(`ws://${host}:${port}`);

  motorSocket.addEventListener("open", () => {
    setStatus(motorStatus, "모터 연결됨", "connected");
    sendMotor({ type: "auto_interval", seconds: Number(autoDelay.value) });
  });
  motorSocket.addEventListener("close", () => {
    stopManualMotors();
    autoEnabled = false;
    updateAutoButton();
    setStatus(motorStatus, "연결 안 됨", "idle");
  });
  motorSocket.addEventListener("error", () => {
    setStatus(motorStatus, "연결 오류", "error");
  });
}

function updateAutoButton() {
  autoButton.ariaPressed = String(autoEnabled);
  autoButton.textContent = autoEnabled ? "자동 왕복 정지" : "자동 왕복 시작";
  autoButton.classList.toggle("active", autoEnabled);
}

holdButtons.forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (motorSocket?.readyState !== WebSocket.OPEN) return;
    const motor = button.dataset.motor;
    stopMotor(motor);
    if (motor === "a" && autoEnabled) {
      autoEnabled = false;
      updateAutoButton();
    }
    button.setPointerCapture(event.pointerId);
    activePointers.set(event.pointerId, { motor, button });
    button.classList.add("active");
    sendMotor({ type: "motor", motor, direction: button.dataset.direction });
  });

  const release = (event) => {
    const active = activePointers.get(event.pointerId);
    if (!active) return;
    active.button.classList.remove("active");
    activePointers.delete(event.pointerId);
    sendMotor({ type: "stop", motor: active.motor });
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
  button.addEventListener("contextmenu", (event) => event.preventDefault());
});

autoDelay.addEventListener("input", () => {
  const label = `${Number(autoDelay.value).toFixed(2)}초`;
  delayOutput.value = label;
  autoDescription.textContent = `${label}마다 Left ↔ Right`;
  sendMotor({ type: "auto_interval", seconds: Number(autoDelay.value) });
});

autoButton.addEventListener("click", () => {
  if (motorSocket?.readyState !== WebSocket.OPEN) return;
  stopMotor("a");
  autoEnabled = !autoEnabled;
  sendMotor({ type: "auto", enabled: autoEnabled });
  updateAutoButton();
});

document.querySelector("#emergency-stop").addEventListener("click", () => {
  stopManualMotors();
  autoEnabled = false;
  updateAutoButton();
  sendMotor({ type: "emergency_stop" });
});

window.addEventListener("blur", stopManualMotors);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopManualMotors();
});
window.addEventListener("pagehide", () => {
  sendMotor({ type: "emergency_stop" });
  motorSocket?.close();
});

motorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  connectMotor();
});

videoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const settings = {
    host: document.querySelector("#gateway-host").value.trim(),
    port: Number(document.querySelector("#gateway-port").value),
    path: document.querySelector("#stream-path").value.trim().replace(/^\/+|\/+$/g, ""),
  };
  const protocol = location.protocol === "https:" ? "https:" : "http:";
  const url = new URL(`${protocol}//${settings.host}:${settings.port}/${settings.path}`);
  Object.entries({ controls: false, muted: true, autoplay: true, playsInline: true })
    .forEach(([key, value]) => url.searchParams.set(key, value));
  localStorage.setItem(STREAM_STORAGE_KEY, JSON.stringify(settings));
  setStatus(status, "연결 중", "connecting");
  placeholder.hidden = true;
  frame.hidden = false;
  frame.src = url;
  streamUrlOutput.textContent = url;
});

document.querySelector("#disconnect-button").addEventListener("click", () => {
  frame.src = "about:blank";
  frame.hidden = true;
  placeholder.hidden = false;
  streamUrlOutput.textContent = "";
  setStatus(status, "영상 연결 대기", "idle");
});

frame.addEventListener("load", () => {
  if (frame.src !== "about:blank") setStatus(status, "영상 연결됨", "connected");
});

let savedStream = {};
let savedMotor = {};
try { savedStream = JSON.parse(localStorage.getItem(STREAM_STORAGE_KEY)) || {}; } catch { /* defaults */ }
try { savedMotor = JSON.parse(localStorage.getItem(MOTOR_STORAGE_KEY)) || {}; } catch { /* defaults */ }
document.querySelector("#gateway-host").value = savedStream.host || location.hostname || "127.0.0.1";
document.querySelector("#gateway-port").value = savedStream.port || 8889;
document.querySelector("#stream-path").value = savedStream.path || "camera";
motorHost.value = savedMotor.host || "makelab.local";
motorPort.value = savedMotor.port || 8765;
frame.src = "about:blank";
frame.hidden = true;
updateAutoButton();
