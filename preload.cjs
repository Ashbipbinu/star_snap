const { contextBridge, ipcRenderer } = require("electron");

console.log("Preload script loaded");

let printerListener = null;
let printResultListener = null;

contextBridge.exposeInMainWorld("electron", {
  onPrinterSelected: (callback) => {
    if (printerListener) {
      ipcRenderer.removeListener("printer-selected", printerListener);
    }

    printerListener = (_event, value) => {
      console.log("Preload received printer:", value);
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

  //  listen for print success/failure from main process
  onPrintResult: (callback) => {
    if (printResultListener) {
      ipcRenderer.removeListener("print-result", printResultListener);
    }

    printResultListener = (_event, value) => {
      console.log("Preload received print result:", value);
      callback(value);
    };

    ipcRenderer.on("print-result", printResultListener);

    return () => {
      if (printResultListener) {
        ipcRenderer.removeListener("print-result", printResultListener);
        printResultListener = null;
      }
    };
  },

  printImage: (data) => {
    console.log("Sending print:", data.printerName);
    ipcRenderer.send("print-image", data);
  },

  getSelectedPrinter: () => {
    return ipcRenderer.invoke("get-selected-printer");
  }
});
