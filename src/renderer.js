const projectPathEl = document.getElementById("projectPath");
const portEl = document.getElementById("port");
const runningChipEl = document.getElementById("runningChip");
const urlChipEl = document.getElementById("urlChip");
const updaterChipEl = document.getElementById("updaterChip");
const messageEl = document.getElementById("message");
const logsEl = document.getElementById("logs");
const nodeChipEl = document.getElementById("nodeChip");
const npmChipEl = document.getElementById("npmChip");
const stepNodeEl = document.getElementById("stepNode");
const stepFolderEl = document.getElementById("stepFolder");
const stepStartEl = document.getElementById("stepStart");
const stepOpenEl = document.getElementById("stepOpen");
const restartBannerEl = document.getElementById("restartBanner");

const pickFolderBtn = document.getElementById("pickFolderBtn");
const checkPrereqsBtn = document.getElementById("checkPrereqsBtn");
const openNodeDownloadBtn = document.getElementById("openNodeDownloadBtn");
const quickStartBtn = document.getElementById("quickStartBtn");
const validateBtn = document.getElementById("validateBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const openBtn = document.getElementById("openBtn");
const copyUrlBtn = document.getElementById("copyUrlBtn");
const clearLogsBtn = document.getElementById("clearLogsBtn");
const checkUpdatesBtn = document.getElementById("checkUpdatesBtn");

let currentUrl = "";
let running = false;
let hasNode = false;
let hasNpm = false;
let busy = false;

function setStepState(el, state) {
  if (!el) return;
  el.classList.remove("done", "pending");
  if (state === "done") el.classList.add("done");
  if (state === "pending") el.classList.add("pending");
}

function updateStepGuide() {
  const hasFolder = Boolean(projectPathEl.value.trim());
  setStepState(stepNodeEl, hasNode && hasNpm ? "done" : "pending");
  setStepState(stepFolderEl, hasFolder ? "done" : "pending");
  setStepState(stepStartEl, running ? "done" : "pending");
  setStepState(stepOpenEl, currentUrl ? "done" : "pending");
}

function updateActionState() {
  const hasFolder = Boolean(projectPathEl.value.trim());
  startBtn.disabled = busy || running || !hasFolder || !hasNode || !hasNpm;
  validateBtn.disabled = busy || !hasFolder;
  quickStartBtn.disabled = busy || running;
  stopBtn.disabled = busy || !running;
  openBtn.disabled = busy || !currentUrl;
  copyUrlBtn.disabled = busy || !currentUrl;
  pickFolderBtn.disabled = busy;
  checkPrereqsBtn.disabled = busy;
  openNodeDownloadBtn.disabled = busy;
}

function setPrereqChip(el, label, ok, version) {
  if (!el) return;
  const ver = version ? ` ${version}` : "";
  el.textContent = `${label}: ${ok ? `OK${ver}` : "Missing"}`;
  el.classList.remove("ok", "missing", "neutral");
  el.classList.add(ok ? "ok" : "missing");
}

function setPrereqs(prereqs) {
  if (!prereqs) return;
  hasNode = Boolean(prereqs.nodeOk);
  hasNpm = Boolean(prereqs.npmOk);
  setPrereqChip(nodeChipEl, "Node.js", hasNode, prereqs.nodeVersion);
  setPrereqChip(npmChipEl, "npm", hasNpm, prereqs.npmVersion);
  if (restartBannerEl) {
    const missing = !hasNode || !hasNpm;
    restartBannerEl.classList.toggle("hidden", !missing);
  }
  updateStepGuide();
  updateActionState();
}

function setMessage(msg, isError = false) {
  messageEl.textContent = msg || "";
  messageEl.style.color = isError ? "#111111" : "#1f2937";
}

function setBusy(value) {
  busy = Boolean(value);
  updateActionState();
}

function appendLog(text) {
  logsEl.textContent += text;
  logsEl.scrollTop = logsEl.scrollHeight;
}

function setRunningStatus(isRunning, url, projectPath, port) {
  running = Boolean(isRunning);
  currentUrl = url || "";
  runningChipEl.textContent = running ? "Running" : "Stopped";
  runningChipEl.classList.remove("ok", "missing", "neutral");
  runningChipEl.classList.add(running ? "ok" : "missing");

  urlChipEl.textContent = `URL: ${currentUrl || "-"}`;

  if (projectPath) projectPathEl.value = projectPath;
  if (port) portEl.value = String(port);

  updateStepGuide();
  updateActionState();
}

function setUpdaterStatus(text, ok = null) {
  if (!updaterChipEl) return;
  updaterChipEl.textContent = `Updates: ${text}`;
  updaterChipEl.classList.remove("ok", "missing", "neutral");
  if (ok === true) {
    updaterChipEl.classList.add("ok");
  } else if (ok === false) {
    updaterChipEl.classList.add("missing");
  } else {
    updaterChipEl.classList.add("neutral");
  }
}

async function init() {
  try {
    const state = await window.runner.getState();
    setRunningStatus(state.running, state.url, state.projectPath, state.port);
    setPrereqs(state.prereqs);
    if (!state.prereqs?.nodeOk || !state.prereqs?.npmOk) {
      const checked = await window.runner.checkPrereqs();
      setPrereqs(checked);
    }
  } catch (error) {
    setMessage(`Initialization failed: ${error?.message || "Unknown error"}`, true);
  }
}

pickFolderBtn.addEventListener("click", async () => {
  const result = await window.runner.pickFolder();
  if (!result.ok) {
    if (result.error) setMessage(result.error, true);
    return;
  }
  if (result.projectPath) projectPathEl.value = result.projectPath;
  setMessage("Project folder selected.");
  updateStepGuide();
  updateActionState();
});

checkPrereqsBtn.addEventListener("click", async () => {
  setBusy(true);
  try {
    setMessage("Checking prerequisites...");
    const result = await window.runner.checkPrereqs();
    setPrereqs(result);
    if (result.nodeOk && result.npmOk) {
      setMessage("System check passed.");
    } else {
      setMessage("Node.js/npm missing. Install Node LTS from nodejs.org.", true);
    }
  } catch (error) {
    setMessage(`System check failed: ${error?.message || "Unknown error"}`, true);
  } finally {
    setBusy(false);
  }
});

openNodeDownloadBtn.addEventListener("click", async () => {
  setBusy(true);
  try {
    setMessage("Preparing Node.js installer...");
    const result = await window.runner.installNode();
    if (result?.alreadyInstalled) {
      setMessage(result.message || "Node.js is already installed.");
    } else if (result?.canceled) {
      setMessage(result.message || "Node.js install canceled.");
    } else if (result?.ok) {
      setMessage(result.message || "Node.js installer launched.");
    } else {
      const fallback = result?.fallbackOpened ? " Opened nodejs.org as fallback." : "";
      setMessage(`Could not launch installer. ${result?.error || "Unknown error."}${fallback}`, true);
    }
    const checked = await window.runner.checkPrereqs();
    setPrereqs(checked);
  } catch (error) {
    setMessage(`Install launcher failed: ${error?.message || "Unknown error"}`, true);
  } finally {
    setBusy(false);
  }
});

validateBtn.addEventListener("click", async () => {
  setBusy(true);
  try {
    const prereqs = await window.runner.checkPrereqs();
    setPrereqs(prereqs);
    if (!prereqs.nodeOk || !prereqs.npmOk) {
      setMessage("Node.js/npm missing. Install Node LTS first.", true);
      return;
    }

    const result = await window.runner.validate({ projectPath: projectPathEl.value.trim() });
    if (!result.ok) {
      setMessage(result.error || "Validation failed.", true);
      return;
    }
    setMessage("Validation passed.");
  } catch (error) {
    setMessage(`Validation failed: ${error?.message || "Unknown error"}`, true);
  } finally {
    setBusy(false);
  }
});

quickStartBtn.addEventListener("click", async () => {
  setBusy(true);
  try {
    const projectPath = projectPathEl.value.trim();
    const port = Number(portEl.value || "3000");
    if (!projectPath) {
      setMessage("Step 1: Click Choose Folder and select your dashboard app folder.", true);
      return;
    }

    const prereqs = await window.runner.checkPrereqs();
    setPrereqs(prereqs);
    if (!prereqs.nodeOk || !prereqs.npmOk) {
      setMessage("Install Node.js first. Click Install Node.js, finish install, then reopen Runner.", true);
      return;
    }

    const valid = await window.runner.validate({ projectPath });
    if (!valid.ok) {
      setMessage(valid.error || "Selected folder is not valid.", true);
      return;
    }

    setMessage("Quick Start running: install dependencies, start app, then open browser...");
    const result = await window.runner.start({ projectPath, port });
    if (!result.ok) {
      setMessage(result.error || "Start failed.", true);
      return;
    }
    setMessage(`Dashboard started at ${result.url}`);
    const opened = await window.runner.openUrl(result.url);
    if (!opened?.ok) {
      setMessage(`Started at ${result.url} (open URL failed: ${opened?.error || "Unknown error"})`, true);
    }
  } catch (error) {
    setMessage(`Quick Start failed: ${error?.message || "Unknown error"}`, true);
  } finally {
    setBusy(false);
  }
});

startBtn.addEventListener("click", async () => {
  setBusy(true);
  try {
    const projectPath = projectPathEl.value.trim();
    const port = Number(portEl.value || "3000");
    if (!projectPath) {
      setMessage("Select a project folder first.", true);
      return;
    }

    setMessage("Starting app...");
    const result = await window.runner.start({ projectPath, port });
    if (!result.ok) {
      setMessage(result.error || "Start failed.", true);
      return;
    }
    setMessage(`Running at ${result.url}`);
    const opened = await window.runner.openUrl(result.url);
    if (!opened?.ok) {
      setMessage(`Running at ${result.url} (open URL failed: ${opened?.error || "Unknown error"})`, true);
    }
  } catch (error) {
    setMessage(`Start failed: ${error?.message || "Unknown error"}`, true);
  } finally {
    setBusy(false);
  }
});

stopBtn.addEventListener("click", async () => {
  setBusy(true);
  try {
    await window.runner.stop();
    setMessage("Stopped.");
  } catch (error) {
    setMessage(`Stop failed: ${error?.message || "Unknown error"}`, true);
  } finally {
    setBusy(false);
  }
});

openBtn.addEventListener("click", async () => {
  try {
    if (!currentUrl) {
      setMessage("No URL to open.", true);
      return;
    }
    const result = await window.runner.openUrl(currentUrl);
    if (!result?.ok) {
      setMessage(result?.error || "Open URL failed.", true);
    }
  } catch (error) {
    setMessage(`Open URL failed: ${error?.message || "Unknown error"}`, true);
  }
});

copyUrlBtn.addEventListener("click", async () => {
  const result = await window.runner.copyUrl(currentUrl);
  if (!result.ok) {
    setMessage(result.error || "No URL to copy.", true);
    return;
  }
  setMessage("URL copied.");
});

clearLogsBtn.addEventListener("click", () => {
  logsEl.textContent = "";
});

checkUpdatesBtn.addEventListener("click", async () => {
  setBusy(true);
  setUpdaterStatus("checking...");
  const result = await window.runner.checkUpdates();
  if (!result?.ok && result?.error) {
    setMessage(`Update check failed: ${result.error}`, true);
    setUpdaterStatus("error", false);
  } else if (result?.skipped) {
    setMessage("Update check skipped in development mode.");
    setUpdaterStatus("dev mode");
  } else {
    setMessage("Update check started.");
  }
  setBusy(false);
});

window.runner.onStatus((payload) => {
  setRunningStatus(payload.running, payload.url, payload.projectPath, payload.port);
  setPrereqs(payload.prereqs);
});

window.runner.onLog((line) => {
  appendLog(line);
});

window.runner.onUpdater((payload) => {
  const status = payload?.status || "";
  if (status === "checking") setUpdaterStatus("checking...");
  else if (status === "available") setUpdaterStatus(`available (${payload.version || "new"})`);
  else if (status === "up-to-date") setUpdaterStatus(`up to date (${payload.version || "current"})`, true);
  else if (status === "downloading") {
    const pct = Number(payload?.percent || 0);
    setUpdaterStatus(`downloading ${pct.toFixed(1)}%`);
  } else if (status === "downloaded") setUpdaterStatus(`ready to install (${payload.version || "new"})`, true);
  else if (status === "error") setUpdaterStatus("error", false);
  else if (status === "skipped-dev") setUpdaterStatus("dev mode");
});

void init();
