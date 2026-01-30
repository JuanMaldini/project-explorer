const {
  app,
  BrowserWindow,
  ipcMain,
  clipboard,
  Menu,
  shell,
  dialog,
} = require("electron");
const path = require("path");
const fsSync = require("fs");
const fs = require("fs/promises");
const crypto = require("crypto");

let chokidar;
try {
  chokidar = require("chokidar");
} catch {
  chokidar = null;
}

const normalizeOpenPathInput = (input) => {
  const raw = String(input ?? "").trim();
  if (!raw) return "";

  // Keep file:// and other URLs unchanged.
  if (/^(https?:|data:|blob:|file:)/i.test(raw)) return raw;

  // UNC: \\server\share\folder -> keep exactly two leading backslashes.
  if (/^[\\/]{2,}/.test(raw)) {
    const rest = raw.replace(/^[\\/]+/, "");
    const cleaned = rest.replace(/[\\/]+/g, "\\");
    return `\\\\${cleaned}`;
  }

  // Drive/local path: collapse repeated separators.
  return raw.replace(/[\\/]+/g, "\\");
};

if (!app.isPackaged) {
  try {
    // Reload Electron when main/preload files change during development.
    require("electron-reload")(path.join(app.getAppPath(), "electron"), {
      hardResetMethod: "exit",
    });
  } catch {
    // Optional in dev; ignore if dependency isn't installed yet.
  }
}

const forcedUserDataPath = path.join(app.getPath("appData"), "ProjectExplorer");
app.setPath("userData", forcedUserDataPath);
app.commandLine.appendSwitch(
  "disk-cache-dir",
  path.join(forcedUserDataPath, "Cache"),
);
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

const isPackaged = app.isPackaged;

if (process.platform === "win32") {
  // Helps Windows show the correct taskbar icon/grouping.
  app.setAppUserModelId("com.projectexplorer.app");
}

let mainWindow = null;

const SETTINGS_PATH = path.join(app.getPath("userData"), "settings.json");
const DEFAULT_SETTINGS = {
  serverSyncEnabled: false,
  serverSyncFolderPath: "",
};

const readSettings = async () => {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

const writeSettings = async (nextSettings) => {
  const safe = {
    ...DEFAULT_SETTINGS,
    ...(nextSettings && typeof nextSettings === "object" ? nextSettings : {}),
  };

  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(safe, null, 2), "utf8");
  return safe;
};

const getBundledDataJsonPath = () => {
  return path.join(app.getAppPath(), "build", "data.json");
};

const getWritableDataJsonPath = () => {
  if (!isPackaged) return path.join(app.getAppPath(), "public", "data.json");
  return path.join(app.getPath("userData"), "data.json");
};

const getExternalDataJsonPath = (folderPath) => {
  const folder = String(folderPath ?? "").trim();
  if (!folder) return "";
  return path.join(folder, "data.json");
};

const computeTextHash = (text) => {
  return crypto
    .createHash("sha256")
    .update(String(text ?? ""), "utf8")
    .digest("hex");
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const atomicWriteText = async (finalPath, text) => {
  const dir = path.dirname(finalPath);
  await fs.mkdir(dir, { recursive: true });

  const tmpPath = path.join(
    dir,
    `${path.basename(finalPath)}.tmp.${process.pid}.${Date.now()}`,
  );

  const file = await fs.open(tmpPath, "w");
  try {
    await file.writeFile(String(text ?? ""), "utf8");
    await file.sync();
  } finally {
    await file.close();
  }

  const attempts = 6;
  for (let i = 0; i < attempts; i += 1) {
    try {
      await fs.rename(tmpPath, finalPath);
      return true;
    } catch (err) {
      const code = err?.code;
      const isLast = i === attempts - 1;
      const retryable =
        code === "EPERM" ||
        code === "EACCES" ||
        code === "EBUSY" ||
        code === "EEXIST";

      if (!retryable || isLast) {
        try {
          await fs.unlink(tmpPath);
        } catch {
          // ignore
        }
        throw err;
      }

      try {
        await fs.unlink(finalPath);
      } catch {
        // ignore
      }

      await sleep(40 * (i + 1));
    }
  }

  return false;
};

const readTextWithRetry = async (filePath, attempts = 3) => {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch (err) {
      lastErr = err;
      await sleep(120 * (i + 1));
    }
  }
  throw lastErr;
};

const broadcastToWindows = (channel, payload) => {
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    try {
      win.webContents.send(channel, payload);
    } catch {
      // ignore
    }
  }
};

let serverSyncWatcher = null;
let serverSyncWatchingPath = "";
let lastWrittenHash = "";
let lastWrittenAt = 0;

const stopServerSyncWatcher = async () => {
  if (serverSyncWatcher) {
    try {
      await serverSyncWatcher.close();
    } catch {
      // ignore
    }
  }
  serverSyncWatcher = null;
  serverSyncWatchingPath = "";
};

const disableServerSyncInternal = async ({ reason } = {}) => {
  await stopServerSyncWatcher();

  const settings = await readSettings();
  const next = await writeSettings({
    ...settings,
    serverSyncEnabled: false,
  });

  broadcastToWindows("server-sync-status", {
    type: reason ? "error" : "disabled",
    enabled: false,
    folderPath: next.serverSyncFolderPath || "",
    message: reason || "",
  });

  return next;
};

const startServerSyncWatcher = async (folderPath) => {
  const dataPath = getExternalDataJsonPath(folderPath);
  if (!dataPath) throw new Error("Missing server sync folder path");

  await stopServerSyncWatcher();
  serverSyncWatchingPath = dataPath;

  if (!chokidar) {
    throw new Error(
      "File watching dependency missing (chokidar). Please reinstall dependencies.",
    );
  }

  serverSyncWatcher = chokidar.watch(dataPath, {
    ignoreInitial: true,
    usePolling: true,
    interval: 500,
    awaitWriteFinish: {
      stabilityThreshold: 1500,
      pollInterval: 100,
    },
    ignored: /(^|[\\/])data\.json\.tmp\./,
  });

  const handleChange = async () => {
    try {
      const text = await readTextWithRetry(dataPath, 3);
      const hash = computeTextHash(text);
      const now = Date.now();
      if (hash === lastWrittenHash && now - lastWrittenAt < 2500) return;

      broadcastToWindows("server-sync-data-changed", {
        folderPath: String(folderPath ?? ""),
        text,
      });
    } catch {
      await disableServerSyncInternal({
        reason:
          "Server sync lost connection or cannot read data.json. Switched back to local mode.",
      });
    }
  };

  serverSyncWatcher.on("change", handleChange);

  serverSyncWatcher.on("unlink", async () => {
    await disableServerSyncInternal({
      reason:
        "Server data.json was removed or became unavailable. Switched back to local mode.",
    });
  });

  serverSyncWatcher.on("error", async () => {
    await disableServerSyncInternal({
      reason:
        "Server sync watcher error. Switched back to local mode.",
    });
  });
};

const readDataJsonText = async () => {
  const settings = await readSettings();
  const useServer = Boolean(
    settings.serverSyncEnabled && settings.serverSyncFolderPath,
  );

  if (useServer) {
    const serverPath = getExternalDataJsonPath(settings.serverSyncFolderPath);
    return await readTextWithRetry(serverPath, 3);
  }

  const writablePath = getWritableDataJsonPath();

  if (isPackaged) {
    try {
      return await fs.readFile(writablePath, "utf8");
    } catch {
      const bundledPath = getBundledDataJsonPath();
      const bundledText = await fs.readFile(bundledPath, "utf8");
      await fs.mkdir(path.dirname(writablePath), { recursive: true });
      await fs.writeFile(writablePath, bundledText, "utf8");
      return bundledText;
    }
  }

  return await fs.readFile(writablePath, "utf8");
};

const createWindow = async () => {
  Menu.setApplicationMenu(null);

  const startUrl = process.env.ELECTRON_START_URL;
  const isDevServer = !isPackaged && Boolean(startUrl);

  const windowIconCandidates = [
    path.join(app.getAppPath(), "build", "icons", "app.png"),
    path.join(app.getAppPath(), "electron", "assets", "app.png"),
    path.join(app.getAppPath(), "public", "icons", "app.png"),
  ];

  const windowIcon = windowIconCandidates.find((p) => {
    try {
      return fsSync.existsSync(p);
    } catch {
      return false;
    }
  });

  const windowOptions = {
    width: 1200,
    height: 800,
    backgroundColor: "#0b0b0b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !isPackaged,
      // When using the React dev server (http://localhost:3000), Chromium may block
      // loading local images via file://. Disable webSecurity only in dev server mode.
      webSecurity: !isDevServer,
      sandbox: false,
    },
  };

  if (windowIcon) {
    windowOptions.icon = windowIcon;
  }

  mainWindow = new BrowserWindow(windowOptions);

  if (isDevServer) {
    await mainWindow.loadURL(startUrl);
  } else {
    await mainWindow.loadFile(
      path.join(app.getAppPath(), "build", "index.html"),
    );
  }
};

app.whenReady().then(async () => {
  ipcMain.handle("show-message-box", async (_event, options) => {
    const safe = options && typeof options === "object" ? options : {};
    const type =
      safe.type === "error" ||
      safe.type === "warning" ||
      safe.type === "info"
        ? safe.type
        : "info";

    const title = String(safe.title ?? "Project Explorer");
    const message = String(safe.message ?? "");
    const detail = String(safe.detail ?? "");

    return await dialog.showMessageBox({
      type,
      title,
      message,
      detail,
    });
  });

  ipcMain.handle("server-sync-get-settings", async () => {
    const settings = await readSettings();
    return {
      enabled: Boolean(settings.serverSyncEnabled),
      folderPath: String(settings.serverSyncFolderPath || ""),
    };
  });

  ipcMain.handle("server-sync-enable", async (_event, initialProjects) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Select shared folder for data.json",
      properties: ["openDirectory"],
    });

    if (canceled || !filePaths?.length) {
      return { enabled: false, cancelled: true };
    }

    const folderPath = filePaths[0];
    const externalDataPath = getExternalDataJsonPath(folderPath);

    try {
      const st = await fs.stat(folderPath);
      if (!st.isDirectory()) throw new Error("Selected path is not a folder");
    } catch {
      throw new Error("Selected folder is not accessible");
    }

    // Verify write access by writing a temp file in the chosen folder.
    const probePath = path.join(
      folderPath,
      `.project-explorer-probe.${process.pid}.${Date.now()}`,
    );
    try {
      await atomicWriteText(probePath, "ok");
      await fs.unlink(probePath);
    } catch {
      throw new Error("No write permission in selected folder");
    }

    // Create data.json if missing using current local projects as base.
    try {
      await fs.access(externalDataPath);
    } catch {
      const base = Array.isArray(initialProjects) ? initialProjects : [];
      const seedText = JSON.stringify(base, null, 2);
      await atomicWriteText(externalDataPath, seedText);
    }

    const nextSettings = await writeSettings({
      ...(await readSettings()),
      serverSyncEnabled: true,
      serverSyncFolderPath: folderPath,
    });

    await startServerSyncWatcher(folderPath);

    broadcastToWindows("server-sync-status", {
      type: "enabled",
      enabled: true,
      folderPath: nextSettings.serverSyncFolderPath || "",
      message: "",
    });

    const text = await readTextWithRetry(externalDataPath, 3);
    return {
      enabled: true,
      folderPath: nextSettings.serverSyncFolderPath || "",
      text,
    };
  });

  ipcMain.handle("server-sync-disable", async (_event, options) => {
    const opts = options && typeof options === "object" ? options : {};
    const syncToLocal = opts.syncToLocal !== false;

    const settings = await readSettings();
    const folderPath = String(settings.serverSyncFolderPath || "");
    const externalDataPath = getExternalDataJsonPath(folderPath);

    let copiedText = "";
    if (syncToLocal && folderPath) {
      try {
        copiedText = await readTextWithRetry(externalDataPath, 3);
        await atomicWriteText(getWritableDataJsonPath(), copiedText);
      } catch {
        // If server is unreachable, we still disable; renderer can keep current in-memory state.
      }
    }

    const next = await disableServerSyncInternal();
    return {
      enabled: false,
      folderPath: String(next.serverSyncFolderPath || ""),
      text: copiedText,
    };
  });

  ipcMain.handle("read-data-json", async () => {
    return await readDataJsonText();
  });

  ipcMain.handle("save-projects", async (_event, projects) => {
    if (!Array.isArray(projects)) {
      throw new Error("save-projects expects an array");
    }

    const settings = await readSettings();
    const useServer = Boolean(
      settings.serverSyncEnabled && settings.serverSyncFolderPath,
    );

    const text = JSON.stringify(projects, null, 2);

    if (useServer) {
      const serverPath = getExternalDataJsonPath(settings.serverSyncFolderPath);
      await atomicWriteText(serverPath, text);
      lastWrittenHash = computeTextHash(text);
      lastWrittenAt = Date.now();
      return true;
    }

    const writablePath = getWritableDataJsonPath();
    await fs.mkdir(path.dirname(writablePath), { recursive: true });
    await fs.writeFile(writablePath, text, "utf8");
    return true;
  });

  ipcMain.handle("export-projects", async (_event, projects) => {
    if (!Array.isArray(projects)) {
      throw new Error("export-projects expects an array");
    }

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Export projects",
      defaultPath: "project-explorer-export.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (canceled || !filePath) return false;

    const text = JSON.stringify(projects, null, 2);
    await fs.writeFile(filePath, text, "utf8");
    return true;
  });

  ipcMain.handle("import-projects", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Import projects",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (canceled || !filePaths?.length) return null;

    const importPath = filePaths[0];
    const raw = await fs.readFile(importPath, "utf8");

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Selected file is not valid JSON");
    }

    if (!Array.isArray(parsed)) {
      throw new Error("Imported JSON must be an array of projects");
    }

    // Overwrite the active data source.
    const settings = await readSettings();
    const useServer = Boolean(
      settings.serverSyncEnabled && settings.serverSyncFolderPath,
    );

    const text = JSON.stringify(parsed, null, 2);
    if (useServer) {
      const serverPath = getExternalDataJsonPath(settings.serverSyncFolderPath);
      await atomicWriteText(serverPath, text);
      lastWrittenHash = computeTextHash(text);
      lastWrittenAt = Date.now();
      return parsed;
    }

    const writablePath = getWritableDataJsonPath();
    await fs.mkdir(path.dirname(writablePath), { recursive: true });
    await fs.writeFile(writablePath, text, "utf8");

    return parsed;
  });

  ipcMain.handle("copy-text", async (_event, text) => {
    clipboard.writeText(String(text ?? ""));
    return true;
  });

  ipcMain.handle("open-path", async (_event, targetPath) => {
    const raw = normalizeOpenPathInput(targetPath);
    if (!raw) return false;

    const result = await shell.openPath(raw);
    if (result) throw new Error(result);
    return true;
  });

  ipcMain.handle("select-image", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"],
        },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (canceled || !filePaths?.length) return null;
    return filePaths[0];
  });

  ipcMain.handle("select-folder", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    if (canceled || !filePaths?.length) return null;
    return filePaths[0];
  });

  await createWindow();

  // Auto-reconnect watcher on app start if it was enabled previously.
  try {
    const settings = await readSettings();
    if (settings.serverSyncEnabled && settings.serverSyncFolderPath) {
      const dataPath = getExternalDataJsonPath(settings.serverSyncFolderPath);
      await fs.access(dataPath);
      await startServerSyncWatcher(settings.serverSyncFolderPath);
    }
  } catch {
    await disableServerSyncInternal({
      reason:
        "Server sync could not reconnect on startup. Switched back to local mode.",
    });
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
