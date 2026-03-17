const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("runner", {
  getState: () => ipcRenderer.invoke("runner:get-state"),
  checkPrereqs: () => ipcRenderer.invoke("runner:check-prereqs"),
  pickFolder: () => ipcRenderer.invoke("runner:pick-folder"),
  validate: (payload) => ipcRenderer.invoke("runner:validate", payload),
  start: (payload) => ipcRenderer.invoke("runner:start", payload),
  stop: () => ipcRenderer.invoke("runner:stop"),
  openUrl: (url) => ipcRenderer.invoke("runner:open-url", url),
  openNodeDownload: () => ipcRenderer.invoke("runner:open-node-download"),
  onStatus: (cb) => ipcRenderer.on("runner:status", (_e, payload) => cb(payload)),
  onLog: (cb) => ipcRenderer.on("runner:log", (_e, line) => cb(line))
});
