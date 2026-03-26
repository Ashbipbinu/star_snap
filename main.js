import { app, BrowserWindow, protocol, net, session, Menu } from "electron"; // Added Menu import
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Updated to use the modern Async method
async function createPrinterMenu(win) {
  try {
    // getPrinters() is deprecated in newer Electron; use getPrintersAsync()
    const printers = await win.webContents.getPrintersAsync();

    const printerMenuItems = printers.map((printer) => ({
      label: printer.name,
      type: "radio",
      checked: printer.isDefault,
      click: () => {
        win.webContents.send("printer-selected", printer.name);
      }
    }));

    const template = [
      {
        label: "Settings",
        submenu: [
          {
            label: "Connect Printer",
            submenu: printerMenuItems.length > 0 
              ? printerMenuItems 
              : [{ label: "No Printers Found", enabled: false }]
          },
          { type: "separator" },
          { label: "Reload Printers", click: () => createPrinterMenu(win) },
          { type: "separator" },
          { role: "quit" }
        ]
      },
      { label: "Edit", role: "editMenu" },
      { label: "View", role: "viewMenu" }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } catch (err) {
    console.error("Failed to get printers:", err);
  }
}

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

  // Build the menu once the window is ready
  win.webContents.on("did-finish-load", () => {
    createPrinterMenu(win);
  });
}

app.whenReady().then(() => {
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const fullPath = path.join(__dirname, "dist", filePath);
    return net.fetch(`file://${fullPath}`);
  });

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