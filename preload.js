const { contextBridge, ipcRenderer } = require('electron');

// Expose the 'ipcRenderer' methods to the renderer process in a safe way
contextBridge.exposeInMainWorld('electron', {
    invoke: (channel, args) => ipcRenderer.invoke(channel, args),
    send: (channel, args) => ipcRenderer.send(channel, args)
});