import { app, BrowserWindow, protocol, net, session, Menu, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow; 
let selectedPrinter = "";

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

function isVirtualPrinter(name) {
  const n = name.toLowerCase();
  return (
    n.includes("pdf") ||
    n.includes("onenote") ||
    n.includes("fax") ||
    n.includes("xps") ||
    n.includes("anydesk")
  );
}

// ✅ ALWAYS SEND TO MAIN WINDOW
function sendToRenderer(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    console.log(" Sending to React:", data);
    mainWindow.webContents.send(channel, data);
  } else {
    console.error("mainWindow not available");
  }
}

// 🔥 Printer Menu
async function createPrinterMenu() {
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();

    const printerMenuItems = printers.map((printer) => ({
      label: printer.name,
      type: "radio",
      checked: printer.name === selectedPrinter || printer.isDefault,
      click: () => {
        selectedPrinter = printer.name;

        console.log("Selected:", printer.name);

        sendToRenderer("printer-selected", printer.name);
      }
    }));

    const template = [
      {
        label: "Settings",
        submenu: [
          {
            label: "Connect Printer",
            submenu:
              printerMenuItems.length > 0
                ? printerMenuItems
                : [{ label: "No Printers Found", enabled: false }]
          },
          { type: "separator" },
          { label: "Reload Printers", click: () => createPrinterMenu() },
          { type: "separator" },
          { role: "quit" }
        ]
      },
      { label: "Edit", role: "editMenu" },
      { label: "View", role: "viewMenu" }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  } catch (err) {
    console.error("Failed to get printers:", err);
  }
}

//  expose current printer
ipcMain.handle("get-selected-printer", () => selectedPrinter);

//  PRINT
ipcMain.on("print-image", async (_, { image, printerName }) => {
  const printWindow = new BrowserWindow({ show: false });

  await printWindow.loadURL(`
    data:text/html,
    <html>
      <body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;">
        <img src="${image}" style="max-width:100%;max-height:100%;" />
      </body>
    </html>
  `);

  printWindow.webContents.on("did-finish-load", () => {
    const virtual = isVirtualPrinter(printerName);

    printWindow.webContents.print(
      {
        silent: !virtual,
        deviceName: printerName
      },
      () => printWindow.close()
    );
  });
});

function createWindow() {
  const preloadPath = path.resolve(__dirname, "preload.js");

  console.log("PRELOAD PATH:", preloadPath);

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.resolve(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false  
    }
  });

  const startUrl = app.isPackaged
    ? "app://index.html"
    : "http://localhost:5173";

  mainWindow.loadURL(startUrl);

  mainWindow.webContents.on("did-finish-load", () => {
    createPrinterMenu();
  });
}

app.whenReady().then(() => {
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const fullPath = path.join(__dirname, "dist", filePath);
    return net.fetch(`file://${fullPath}`);
  });

  session.defaultSession.setPermissionCheckHandler((_, permission) => {
    return permission === "media" || permission === "camera";
  });

  session.defaultSession.setPermissionRequestHandler((_, permission, callback) => {
    callback(permission === "media" || permission === "camera");
  });

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});