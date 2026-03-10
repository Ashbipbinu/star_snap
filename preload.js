import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  sendData: (data) => ipcRenderer.send("my-channel", data)
});