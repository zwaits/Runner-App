const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const https = require("https");
const { autoUpdater } = require("electron-updater");

const STATE_FILE = "runner-state.json";

let mainWindow = null;
let appProcess = null;
let currentProjectPath = "";
let currentPort = 3000;
let currentUrl = "";
let currentScript = "dev";
let prereqStatus = { nodeOk: false, npmOk: false, nodeVersion: "", npmVersion: "" };
let updaterConfigured = false;

function stateFilePath() {
  return path.join(app.getPath("userData"), STATE_FILE);
}

function loadState() {
  try {
    const raw = fs.readFileSync(stateFilePath(), "utf-8");
    const parsed = JSON.parse(raw);
    return {
      projectPath: typeof parsed.projectPath === "string" ? parsed.projectPath : "",
      port: Number.isFinite(parsed.port) ? Number(parsed.port) : 3000,
      script: parsed.script === "start" ? "start" : "dev"
    };
  } catch {
    return { projectPath: "", port: 3000, script: "dev" };
  }
}

function saveState() {
  const payload = {
    projectPath: currentProjectPath,
    port: currentPort,
    script: currentScript
  };
  fs.mkdirSync(path.dirname(stateFilePath()), { recursive: true });
  fs.writeFileSync(stateFilePath(), JSON.stringify(payload, null, 2), "utf-8");
}

function sendStatus(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("runner:status", {
    ...payload,
    prereqs: prereqStatus
  });
}

function sendLog(line) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("runner:log", String(line));
}

function sendUpdater(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("runner:updater", payload);
}

function runSimpleCommand(command, args = []) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: false });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", () => resolve({ ok: false, out: "", err: "" }));
    child.on("close", (code) => resolve({ ok: code === 0, out: out.trim(), err: err.trim() }));
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        fetchText(next).then(resolve).catch(reject);
        return;
      }
      if (status < 200 || status >= 300) {
        res.resume();
        reject(new Error(`HTTP ${status}`));
        return;
      }
      let out = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (out += chunk));
      res.on("end", () => resolve(out));
    });
    request.on("error", reject);
    request.end();
  });
}

function downloadToFile(url, destination) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const file = fs.createWriteStream(destination);
    const request = https.get(url, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        file.close(() => {
          try {
            fs.unlinkSync(destination);
          } catch {}
          downloadToFile(next, destination).then(resolve).catch(reject);
        });
        return;
      }
      if (status < 200 || status >= 300) {
        res.resume();
        file.close(() => {
          try {
            fs.unlinkSync(destination);
          } catch {}
          reject(new Error(`Download failed (HTTP ${status})`));
        });
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve(destination)));
    });
    request.on("error", (err) => {
      file.close(() => {
        try {
          fs.unlinkSync(destination);
        } catch {}
        reject(err);
      });
    });
    file.on("error", (err) => {
      request.destroy(err);
    });
  });
}

async function getLatestLtsVersion() {
  const raw = await fetchText("https://nodejs.org/dist/index.json");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Unexpected Node release metadata format.");
  const lts = parsed.find((entry) => Boolean(entry?.lts) && typeof entry?.version === "string");
  if (!lts || typeof lts.version !== "string") {
    throw new Error("Unable to determine latest Node LTS version.");
  }
  return lts.version;
}

async function installNodeWithPrompt() {
  const pre = await checkPrerequisites();
  if (pre.nodeOk && pre.npmOk) {
    return { ok: true, alreadyInstalled: true, message: `Node.js ${pre.nodeVersion} and npm ${pre.npmVersion} are already installed.` };
  }

  const confirm = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Install", "Cancel"],
    defaultId: 0,
    cancelId: 1,
    title: "Install Node.js",
    message: "Node.js + npm are required to run the dashboard.",
    detail:
      "Runner will download the latest Node LTS installer and launch it. Windows may ask for admin permission. Continue?"
  });
  if (confirm.response !== 0) return { ok: false, canceled: true, message: "Node install canceled." };

  // Auto-install flow currently implemented for Windows. For other platforms, open official download page.
  if (!isWindows()) {
    await shell.openExternal("https://nodejs.org/en/download");
    return {
      ok: true,
      launched: false,
      message: "Opened nodejs.org download page. Install Node LTS, then reopen Runner and click Check Prerequisites."
    };
  }

  const version = await getLatestLtsVersion();
  const arch = process.arch === "x64" ? "x64" : "x64";
  const fileName = `node-${version}-${arch}.msi`;
  const installerUrl = `https://nodejs.org/dist/${version}/${fileName}`;
  const destination = path.join(app.getPath("temp"), "dashboard-runner", fileName);

  sendLog(`\n==> Downloading Node installer: ${installerUrl}\n`);
  await downloadToFile(installerUrl, destination);
  sendLog(`==> Download complete: ${destination}\n`);

  const openResult = await shell.openPath(destination);
  if (openResult) {
    throw new Error(openResult);
  }

  return {
    ok: true,
    launched: true,
    message:
      "Node installer launched. Complete installation, then reopen Dashboard Runner and click Check Prerequisites."
  };
}

function configureAutoUpdater() {
  if (updaterConfigured) return;
  updaterConfigured = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    sendLog("\n==> Checking for app updates...\n");
    sendUpdater({ status: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    sendLog(`==> Update available: ${info?.version ?? "new version"}\n`);
    sendUpdater({ status: "available", version: info?.version ?? "" });
  });

  autoUpdater.on("update-not-available", (info) => {
    sendLog(`==> App is up to date (${info?.version ?? "current"}).\n`);
    sendUpdater({ status: "up-to-date", version: info?.version ?? "" });
  });

  autoUpdater.on("error", (error) => {
    sendLog(`==> Update check failed: ${error?.message || String(error)}\n`);
    sendUpdater({ status: "error", error: error?.message || String(error) });
  });

  autoUpdater.on("download-progress", (progress) => {
    sendUpdater({
      status: "downloading",
      percent: Number(progress?.percent ?? 0),
      transferred: Number(progress?.transferred ?? 0),
      total: Number(progress?.total ?? 0)
    });
  });

  autoUpdater.on("update-downloaded", async (info) => {
    sendLog(`==> Update downloaded (${info?.version ?? "latest"}).\n`);
    sendUpdater({ status: "downloaded", version: info?.version ?? "" });
    const result = await dialog.showMessageBox(mainWindow, {
      type: "question",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Update Ready",
      message: "A new Dashboard Runner update has been downloaded.",
      detail: "Restart now to apply the update?"
    });
    if (result.response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall());
    }
  });
}

async function checkForAppUpdates(manual = false) {
  if (!app.isPackaged) {
    if (manual) {
      sendUpdater({ status: "skipped-dev" });
      return { ok: true, skipped: true, reason: "Development mode" };
    }
    return { ok: true, skipped: true, reason: "Development mode" };
  }
  configureAutoUpdater();
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendLog(`==> Auto-update check failed: ${message}\n`);
    sendUpdater({ status: "error", error: message });
    if (manual) return { ok: false, error: message };
    return { ok: true, skipped: true, reason: message };
  }
}

async function checkPrerequisites() {
  const node = await runSimpleCommand(process.platform === "win32" ? "node.exe" : "node", ["-v"]);
  const npm = await runSimpleCommand(npmCommand(), ["-v"]);
  prereqStatus = {
    nodeOk: node.ok,
    npmOk: npm.ok,
    nodeVersion: node.ok ? node.out : "",
    npmVersion: npm.ok ? npm.out : ""
  };
  return prereqStatus;
}

function isWindows() {
  return process.platform === "win32";
}

function npmCommand() {
  return isWindows() ? "npm.cmd" : "npm";
}

function projectIsValid(projectPath) {
  if (!projectPath) return { ok: false, reason: "No project folder selected." };
  const packageJson = path.join(projectPath, "package.json");
  if (!fs.existsSync(projectPath)) return { ok: false, reason: "Selected folder does not exist." };
  if (!fs.existsSync(packageJson)) return { ok: false, reason: "No package.json found in selected folder." };

  try {
    const parsed = JSON.parse(fs.readFileSync(packageJson, "utf-8"));
    const hasScript = parsed?.scripts && (parsed.scripts.dev || parsed.scripts.start);
    if (!hasScript) return { ok: false, reason: "package.json has no dev/start script." };
    const script = parsed?.scripts?.dev ? "dev" : "start";
    return { ok: true, script };
  } catch {
    return { ok: false, reason: "package.json is not valid JSON." };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 980,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer.html"));
}

function stopProject() {
  if (!appProcess) return;
  try {
    appProcess.kill("SIGTERM");
  } catch {}
  appProcess = null;
  currentUrl = "";
  sendStatus({ running: false, url: "", port: currentPort, projectPath: currentProjectPath });
}

function runNpm(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand(), args, {
      cwd,
      env: { ...process.env },
      shell: false
    });

    child.stdout.on("data", (d) => sendLog(d.toString()));
    child.stderr.on("data", (d) => sendLog(d.toString()));

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function startProject({ projectPath, port }) {
  if (appProcess) {
    return { ok: false, error: "App is already running. Stop it first." };
  }

  const valid = projectIsValid(projectPath);
  if (!valid.ok) {
    return { ok: false, error: valid.reason };
  }
  if (!prereqStatus.nodeOk || !prereqStatus.npmOk) {
    await checkPrerequisites();
  }
  if (!prereqStatus.nodeOk || !prereqStatus.npmOk) {
    return {
      ok: false,
      error: "Node.js and npm are required on this machine. Install Node LTS, then reopen Dashboard Runner."
    };
  }

  currentProjectPath = projectPath;
  currentPort = Number(port) || 3000;
  currentScript = valid.script || "dev";
  saveState();

  sendLog(`\n==> Installing dependencies in: ${projectPath}`);
  try {
    await runNpm(["install"], projectPath);
  } catch (err) {
    return { ok: false, error: `Install failed: ${err.message}` };
  }

  sendLog(`\n==> Starting app on port ${currentPort}`);

  const env = {
    ...process.env,
    PORT: String(currentPort)
  };

  const cmdArgs = ["run", currentScript];
  appProcess = spawn(npmCommand(), cmdArgs, {
    cwd: projectPath,
    env,
    shell: false
  });

  currentUrl = `http://localhost:${currentPort}`;

  appProcess.stdout.on("data", (d) => {
    const text = d.toString();
    sendLog(text);
    if (text.includes("ready") || text.includes("started") || text.includes("Local:")) {
      sendStatus({ running: true, url: currentUrl, port: currentPort, projectPath: currentProjectPath });
    }
  });

  appProcess.stderr.on("data", (d) => sendLog(d.toString()));

  appProcess.on("error", (err) => {
    sendLog(`Process error: ${err.message}`);
    appProcess = null;
    sendStatus({ running: false, url: "", port: currentPort, projectPath: currentProjectPath });
  });

  appProcess.on("close", (code) => {
    sendLog(`\nProcess exited with code ${code}`);
    appProcess = null;
    currentUrl = "";
    sendStatus({ running: false, url: "", port: currentPort, projectPath: currentProjectPath });
  });

  sendStatus({
    running: true,
    url: currentUrl,
    port: currentPort,
    projectPath: currentProjectPath,
    script: currentScript
  });
  return { ok: true, url: currentUrl };
}

app.whenReady().then(() => {
  const initial = loadState();
  currentProjectPath = initial.projectPath;
  currentPort = initial.port;
  currentScript = initial.script || "dev";

  createWindow();

  ipcMain.handle("runner:get-state", async () => ({
    running: Boolean(appProcess),
    projectPath: currentProjectPath,
    port: currentPort,
    url: currentUrl,
    script: currentScript,
    prereqs: prereqStatus
  }));

  ipcMain.handle("runner:check-prereqs", async () => checkPrerequisites());

  ipcMain.handle("runner:pick-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "Select your app folder"
    });

    if (result.canceled || !result.filePaths?.[0]) return { ok: false };

    currentProjectPath = result.filePaths[0];
    saveState();

    const valid = projectIsValid(currentProjectPath);
    if (!valid.ok) return { ok: false, error: valid.reason, projectPath: currentProjectPath };

    return { ok: true, projectPath: currentProjectPath, script: valid.script || "dev" };
  });

  ipcMain.handle("runner:validate", async (_event, { projectPath }) => {
    const valid = projectIsValid(projectPath || currentProjectPath);
    return valid.ok ? { ok: true } : { ok: false, error: valid.reason };
  });

  ipcMain.handle("runner:start", async (_event, payload) => {
    return startProject(payload || { projectPath: currentProjectPath, port: currentPort });
  });

  ipcMain.handle("runner:stop", async () => {
    stopProject();
    return { ok: true };
  });

  ipcMain.handle("runner:open-url", async (_event, url) => {
    const target = url || currentUrl;
    if (!target) return { ok: false, error: "No URL available." };
    await shell.openExternal(target);
    return { ok: true };
  });

  ipcMain.handle("runner:copy-url", async (_event, url) => {
    const target = url || currentUrl;
    if (!target) return { ok: false, error: "No URL available." };
    clipboard.writeText(target);
    return { ok: true };
  });

  ipcMain.handle("runner:open-node-download", async () => {
    await shell.openExternal("https://nodejs.org/en/download");
    return { ok: true };
  });

  ipcMain.handle("runner:check-updates", async () => {
    return checkForAppUpdates(true);
  });

  ipcMain.handle("runner:install-node", async () => {
    try {
      const result = await installNodeWithPrompt();
      return result;
    } catch (error) {
      sendLog(`\nNode installer error: ${error instanceof Error ? error.message : String(error)}\n`);
      await shell.openExternal("https://nodejs.org/en/download");
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to launch Node installer.",
        fallbackOpened: true
      };
    }
  });

  void checkPrerequisites().then((result) => {
    sendStatus({
      running: Boolean(appProcess),
      projectPath: currentProjectPath,
      port: currentPort,
      url: currentUrl,
      prereqs: result
    });
  });

  if (app.isPackaged) {
    setTimeout(() => {
      void checkForAppUpdates(false);
    }, 3000);
    setInterval(() => {
      void checkForAppUpdates(false);
    }, 6 * 60 * 60 * 1000);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopProject();
  if (process.platform !== "darwin") app.quit();
});
