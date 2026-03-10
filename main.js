import { app, BrowserWindow, protocol, net, session } from "electron";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register custom protocol BEFORE ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

function createWindow() {

  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const startUrl = app.isPackaged
    ? "app://index.html"
    : "http://localhost:5173";

  win.loadURL(startUrl);
}

app.whenReady().then(() => {

  // Serve files from dist
  protocol.handle("app", (request) => {

    const url = new URL(request.url);

    let filePath = url.pathname;

    if (filePath === "/") {
      filePath = "/index.html";
    }

    const fullPath = path.join(__dirname, "dist", filePath);

    return net.fetch(`file://${fullPath}`);
  });

  // Camera/Mic permissions
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return permission === "media" || permission === "camera";
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === "media" || permission === "camera");
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});