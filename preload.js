import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  sendData: (data) => ipcRenderer.send("my-channel", data),
  
  onPrinterSelected: (callback) => {
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on("printer-selected", subscription);
    
    // Returns a function to unsubscribe if needed
    return () => ipcRenderer.removeListener("printer-selected", subscription);
  }
});