import {
  app,
  BrowserWindow,
  protocol,
  net,
  session,
  Menu,
  ipcMain,
} from "electron";
import path from "path";
import fs from "fs";
import os from "os";
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
      corsEnabled: true,
    },
  },
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

function sendToRenderer(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    console.log("Sending to React:", data);
    mainWindow.webContents.send(channel, data);
  } else {
    console.error("mainWindow not available");
  }
}

async function createPrinterMenu() {
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();

    const printerMenuItems = printers.map((printer) => ({
      label: printer.name,
      type: "radio",
      checked:
        printer.name === selectedPrinter ||
        (!selectedPrinter && printer.isDefault),
      click: () => {
        selectedPrinter = printer.name;
        console.log("Selected:", printer.name);
        sendToRenderer("printer-selected", printer.name);
      },
    }));

    if (!selectedPrinter) {
      const defaultPrinter = printers.find((p) => p.isDefault);
      if (defaultPrinter) {
        selectedPrinter = defaultPrinter.name;
        console.log("Auto-selected default printer:", selectedPrinter);
        sendToRenderer("printer-selected", selectedPrinter);
      }
    }

    const template = [
      {
        label: "Settings",
        submenu: [
          {
            label: "Connect Printer",
            submenu:
              printerMenuItems.length > 0
                ? printerMenuItems
                : [{ label: "No Printers Found", enabled: false }],
          },
          { type: "separator" },
          { label: "Reload Printers", click: () => createPrinterMenu() },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      { label: "Edit", role: "editMenu" },
      { label: "View", role: "viewMenu" },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  } catch (err) {
    console.error("Failed to get printers:", err);
  }
}

ipcMain.handle("get-selected-printer", () => selectedPrinter);

ipcMain.removeAllListeners("print-image");
ipcMain.on("print-image", async (event, { image, printerName }) => {
  console.log("Print request received for printer:", printerName);

  const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { 
         width: 100%;
         height: 100%;
        overflow: hidden;
      }
      body {
        background: white;
      }
      img {
        width: 100vw;
        height: 100vh;
        display: block;
        object-fit: fill;
      }
      @page { 
        size: 101.6mm 152.4mm portrait;
        margin: 0; 
      }
    </style>
  </head>
  <body>
    <img id="photo" src="${image}" />
    <script>
      const img = document.getElementById('photo');
      if (img.complete) {
        document.title = 'ready';
      } else {
        img.onload = () => { document.title = 'ready'; };
        img.onerror = () => { document.title = 'error'; };
      }
    </script>
  </body>
</html>`;

  const tmpFile = path.join(os.tmpdir(), `print_${Date.now()}.html`);
  fs.writeFileSync(tmpFile, htmlContent, "utf-8");

  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  try {
    await printWindow.loadFile(tmpFile);
  } catch (err) {
    console.error("Failed to load print file:", err);
    fs.unlink(tmpFile, () => {});
    if (!printWindow.isDestroyed()) printWindow.close();
    event.sender.send("print-result", { success: false, reason: err.message });
    return;
  }

  // Properly cleared promise — interval AND timeout are BOTH cleared
  // before resolving, so it's physically impossible to resolve twice
  await new Promise((resolve) => {
    let interval = null;
    let timeout = null;

    const done = () => {
      // clear both before resolving — prevents any second resolution
      clearInterval(interval);
      clearTimeout(timeout);
      resolve();
    };

    interval = setInterval(() => {
      if (printWindow.isDestroyed()) {
        done();
        return;
      }
      const title = printWindow.webContents.getTitle();
      if (title === "ready" || title === "error") {
        done();
      }
    }, 100);

    // Fallback after 4 seconds
    timeout = setTimeout(done, 4000);
  });

  if (printWindow.isDestroyed()) {
    fs.unlink(tmpFile, () => {});
    return;
  }

  const virtual = isVirtualPrinter(printerName);
  console.log("Printing to:", printerName, "| Silent:", !virtual);

  printWindow.webContents.print(
    {
      silent: !virtual,
      printBackground: true,
      deviceName: printerName,
      pageSize: { width: 101600, height: 152400 }, // ← 4×6 inch - DNP format is required not A4
      margins: { marginType: "none" },
      scaleFactor: 100,
      landscape: false,
    },
    (success, failureReason) => {
      fs.unlink(tmpFile, () => {});
      if (success) {
        console.log("Print job sent successfully");
        event.sender.send("print-result", { success: true });
      } else {
        console.error("Print failed:", failureReason);
        event.sender.send("print-result", {
          success: false,
          reason: failureReason,
        });
      }
      if (!printWindow.isDestroyed()) printWindow.close();
    },
  );
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.resolve(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
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

  session.defaultSession.setPermissionRequestHandler(
    (_, permission, callback) => {
      callback(permission === "media" || permission === "camera");
    },
  );

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
