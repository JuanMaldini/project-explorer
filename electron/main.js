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
const fs = require("fs/promises");

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

const getBundledDataJsonPath = () => {
  return path.join(app.getAppPath(), "build", "data.json");
};

const getWritableDataJsonPath = () => {
  if (!isPackaged) return path.join(app.getAppPath(), "public", "data.json");
  return path.join(app.getPath("userData"), "data.json");
};

const readDataJsonText = async () => {
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

  const mainWindow = new BrowserWindow({
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
  });

  if (isDevServer) {
    await mainWindow.loadURL(startUrl);
  } else {
    await mainWindow.loadFile(
      path.join(app.getAppPath(), "build", "index.html"),
    );
  }
};

app.whenReady().then(async () => {
  ipcMain.handle("read-data-json", async () => {
    return await readDataJsonText();
  });

  ipcMain.handle("save-projects", async (_event, projects) => {
    if (!Array.isArray(projects)) {
      throw new Error("save-projects expects an array");
    }

    const writablePath = getWritableDataJsonPath();
    const text = JSON.stringify(projects, null, 2);
    await fs.mkdir(path.dirname(writablePath), { recursive: true });
    await fs.writeFile(writablePath, text, "utf8");
    return true;
  });

  ipcMain.handle("copy-text", async (_event, text) => {
    clipboard.writeText(String(text ?? ""));
    return true;
  });

  ipcMain.handle("open-path", async (_event, targetPath) => {
    const raw = String(targetPath ?? "").trim();
    if (!raw) return false;

    // Tries to open the folder/file using the OS shell.
    // Works with local paths and UNC paths.
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
});

app.on("window-all-closed", () => {
  app.quit();
});
