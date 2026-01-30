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
});
