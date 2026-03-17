const projectPathEl = document.getElementById("projectPath");
const portEl = document.getElementById("port");
const runningChipEl = document.getElementById("runningChip");
const urlChipEl = document.getElementById("urlChip");
const messageEl = document.getElementById("message");
const logsEl = document.getElementById("logs");
const nodeChipEl = document.getElementById("nodeChip");
const npmChipEl = document.getElementById("npmChip");
const stepNodeEl = document.getElementById("stepNode");
const stepFolderEl = document.getElementById("stepFolder");
const stepStartEl = document.getElementById("stepStart");
const stepOpenEl = document.getElementById("stepOpen");

const pickFolderBtn = document.getElementById("pickFolderBtn");
const checkPrereqsBtn = document.getElementById("checkPrereqsBtn");
const openNodeDownloadBtn = document.getElementById("openNodeDownloadBtn");
const quickStartBtn = document.getElementById("quickStartBtn");
const validateBtn = document.getElementById("validateBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const openBtn = document.getElementById("openBtn");
const clearLogsBtn = document.getElementById("clearLogsBtn");

let currentUrl = "";
let running = false;
let hasNode = false;
let hasNpm = false;

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
  startBtn.disabled = running || !hasFolder || !hasNode || !hasNpm;
  validateBtn.disabled = !hasFolder;
  quickStartBtn.disabled = running;
  stopBtn.disabled = !running;
  openBtn.disabled = !currentUrl;
}

function setPrereqChip(el, label, ok, version) {
  if (!el) return;
  const ver = version ? ` ${version}` : "";
  el.textContent = `${label}: ${ok ? `OK${ver}` : "Missing"}`;
  el.style.background = ok ? "#dcfce7" : "#fee2e2";
  el.style.color = ok ? "#166534" : "#991b1b";
}

function setPrereqs(prereqs) {
  if (!prereqs) return;
  hasNode = Boolean(prereqs.nodeOk);
  hasNpm = Boolean(prereqs.npmOk);
  setPrereqChip(nodeChipEl, "Node.js", hasNode, prereqs.nodeVersion);
  setPrereqChip(npmChipEl, "npm", hasNpm, prereqs.npmVersion);
  updateStepGuide();
  updateActionState();
}

function setMessage(msg, isError = false) {
  messageEl.textContent = msg || "";
  messageEl.style.color = isError ? "#b91c1c" : "#334155";
}

function appendLog(text) {
  logsEl.textContent += text;
  logsEl.scrollTop = logsEl.scrollHeight;
}

function setRunningStatus(isRunning, url, projectPath, port) {
  running = Boolean(isRunning);
  currentUrl = url || "";
  runningChipEl.textContent = running ? "Running" : "Stopped";
  runningChipEl.style.background = running ? "#dcfce7" : "#fee2e2";
  runningChipEl.style.color = running ? "#166534" : "#991b1b";

  urlChipEl.textContent = `URL: ${currentUrl || "-"}`;

  if (projectPath) projectPathEl.value = projectPath;
  if (port) portEl.value = String(port);

  updateStepGuide();
  updateActionState();
}

async function init() {
  const state = await window.runner.getState();
  setRunningStatus(state.running, state.url, state.projectPath, state.port);
  setPrereqs(state.prereqs);
  if (!state.prereqs?.nodeOk || !state.prereqs?.npmOk) {
    const checked = await window.runner.checkPrereqs();
    setPrereqs(checked);
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
  setMessage("Checking prerequisites...");
  const result = await window.runner.checkPrereqs();
  setPrereqs(result);
  if (result.nodeOk && result.npmOk) {
    setMessage("System check passed.");
  } else {
    setMessage("Node.js/npm missing. Install Node LTS from nodejs.org.", true);
  }
});

openNodeDownloadBtn.addEventListener("click", async () => {
  await window.runner.openNodeDownload();
  setMessage("Node.js download page opened. Install Node LTS, then click Check Prerequisites.");
});

validateBtn.addEventListener("click", async () => {
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
});

quickStartBtn.addEventListener("click", async () => {
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

  setMessage("Installing packages and starting dashboard...");
  const result = await window.runner.start({ projectPath, port });
  if (!result.ok) {
    setMessage(result.error || "Start failed.", true);
    return;
  }
  setMessage(`Dashboard started at ${result.url}`);
  await window.runner.openUrl(result.url);
});

startBtn.addEventListener("click", async () => {
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
  await window.runner.openUrl(result.url);
});

stopBtn.addEventListener("click", async () => {
  await window.runner.stop();
  setMessage("Stopped.");
});

openBtn.addEventListener("click", async () => {
  if (!currentUrl) {
    setMessage("No URL to open.", true);
    return;
  }
  await window.runner.openUrl(currentUrl);
});

clearLogsBtn.addEventListener("click", () => {
  logsEl.textContent = "";
});

window.runner.onStatus((payload) => {
  setRunningStatus(payload.running, payload.url, payload.projectPath, payload.port);
  setPrereqs(payload.prereqs);
});

window.runner.onLog((line) => {
  appendLog(line);
});

void init();
