const { app, BrowserWindow, Tray, Menu, dialog } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

const appRoot = isDev ? __dirname : path.join(process.resourcesPath);

let iconPath;
if (!isDev){
  iconPath = path.join(appRoot, 'apple.ico');
} else {
  iconPath = path.join(appRoot, 'public/assets/apple.ico');
}

let tray;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });
  mainWindow.loadURL('http://localhost:3001');

}

function createTray() {
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    { label: 'Hide App', click: () => mainWindow.hide() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        tray.destroy();
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Apple Monitor Server');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow.isVisible()) mainWindow.hide();
    else mainWindow.show();
  });
}

app.whenReady().then(async () => {
  require('./app.js'); // start server inside Electron

  createWindow();
  createTray();

  dialog.showMessageBox({
    type: 'none',
    title: "Apple Server",
    message: 'The monitoring server has been activated',
    buttons: ['OK'],
    icon: iconPath
  });
});

app.on('window-all-closed', () => {
  tray.destroy();
  app.quit();
});
