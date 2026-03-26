const { contextBridge, ipcRenderer } = require("electron");

console.log("Preload script loaded");

let printerListener = null;

contextBridge.exposeInMainWorld("electron", {
  onPrinterSelected: (callback) => {
    if (printerListener) {
      ipcRenderer.removeListener("printer-selected", printerListener);
    }

    printerListener = (_event, value) => {
      console.log("Preload received:", value);
      callback(value);
    };

    ipcRenderer.on("printer-selected", printerListener);

    return () => {
      if (printerListener) {
        ipcRenderer.removeListener("printer-selected", printerListener);
        printerListener = null;
      }
    };
  },

  printImage: (data) => {
    console.log("Sending print:", data);
    ipcRenderer.send("print-image", data);
  },

  getSelectedPrinter: () => {
    return ipcRenderer.invoke("get-selected-printer");
  }
});