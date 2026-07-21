const frame = document.querySelector("#stream-frame");
const placeholder = document.querySelector("#placeholder");
const form = document.querySelector("#connection-form");
const hostInput = document.querySelector("#gateway-host");
const portInput = document.querySelector("#gateway-port");
const pathInput = document.querySelector("#stream-path");
const disconnectButton = document.querySelector("#disconnect-button");
const status = document.querySelector("#status");
const streamUrlOutput = document.querySelector("#stream-url");

const STORAGE_KEY = "sfr-stream-settings";

function setStatus(label, state) {
  status.textContent = label;
  status.dataset.state = state;
}

function normalizePath(path) {
  return path.trim().replace(/^\/+|\/+$/g, "");
}

function getSettings() {
  return {
    host: hostInput.value.trim(),
    port: Number(portInput.value),
    path: normalizePath(pathInput.value),
  };
}

function makePlayerUrl({ host, port, path }) {
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const url = new URL(`${protocol}//${host}:${port}/${path}`);
  url.searchParams.set("controls", "false");
  url.searchParams.set("muted", "true");
  url.searchParams.set("autoplay", "true");
  url.searchParams.set("playsInline", "true");
  return url;
}

function connect(settings) {
  if (!settings.host || !settings.path || !Number.isInteger(settings.port)) {
    setStatus("설정 오류", "error");
    return;
  }

  const playerUrl = makePlayerUrl(settings);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

  setStatus("연결 중", "connecting");
  streamUrlOutput.textContent = playerUrl.toString();
  placeholder.hidden = true;
  frame.hidden = false;
  frame.src = playerUrl.toString();
}

function disconnect() {
  frame.src = "about:blank";
  frame.hidden = true;
  placeholder.hidden = false;
  streamUrlOutput.textContent = "";
  setStatus("연결 해제", "idle");
}

frame.addEventListener("load", () => {
  if (frame.src !== "about:blank") {
    setStatus("플레이어 연결됨", "connected");
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  connect(getSettings());
});

disconnectButton.addEventListener("click", disconnect);

const defaultHost = window.location.hostname || "127.0.0.1";
let savedSettings = null;

try {
  savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEY));
} catch {
  localStorage.removeItem(STORAGE_KEY);
}

hostInput.value = savedSettings?.host || defaultHost;
portInput.value = savedSettings?.port || 8889;
pathInput.value = savedSettings?.path || "camera";
disconnect();

