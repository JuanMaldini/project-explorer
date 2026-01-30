const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  readDataJson: () => ipcRenderer.invoke("read-data-json"),
  saveProjects: (projects) => ipcRenderer.invoke("save-projects", projects),
  exportProjects: (projects) => ipcRenderer.invoke("export-projects", projects),
  importProjects: () => ipcRenderer.invoke("import-projects"),
  copyText: (text) => ipcRenderer.invoke("copy-text", text),
  openPath: (targetPath) => ipcRenderer.invoke("open-path", targetPath),
  selectImage: () => ipcRenderer.invoke("select-image"),
  selectFolder: () => ipcRenderer.invoke("select-folder"),

  showMessageBox: (options) => ipcRenderer.invoke("show-message-box", options),

  getServerSyncSettings: () => ipcRenderer.invoke("server-sync-get-settings"),
  enableServerSync: (initialProjects) =>
    ipcRenderer.invoke("server-sync-enable", initialProjects),
  disableServerSync: (options) =>
    ipcRenderer.invoke("server-sync-disable", options),

  onServerSyncDataChanged: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("server-sync-data-changed", handler);
    return () => ipcRenderer.removeListener("server-sync-data-changed", handler);
  },

  onServerSyncStatus: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("server-sync-status", handler);
    return () => ipcRenderer.removeListener("server-sync-status", handler);
  },
});
