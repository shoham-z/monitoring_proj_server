const { app, BrowserWindow, Tray, Menu, dialog } = require('electron');
const path = require('path');
const childProcess = require('child_process');

const appRoot = !app.isPackaged
  ? app.getAppPath() // works in dev + production
  : path.join(process.resourcesPath);

const RESOURCES_PATH = path.join(appRoot, 'public/assets');

const asset = (file) => path.join(RESOURCES_PATH, file);

const iconPath = asset("apple.png");

let tray = null;
let mainWindow = null;

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false, // safer, especially with server
      contextIsolation: true
    }
  });

  mainWindow.loadURL('http://localhost:3001'); // your Express server
}

function createTray() {
    tray = new Tray(iconPath);
  
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show App',
        click: () => mainWindow.show()
      },
      {
        label: 'Hide App',
        click: () => mainWindow.hide()
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit()
      }
    ]);
  
    tray.setToolTip('Apple Monitor Server');
    tray.setContextMenu(contextMenu);
  
    // Optional: Double-click to toggle
    tray.on('double-click', () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    });
  }

app.whenReady().then(async () => {
  // Start the Express server
  await childProcess.fork(path.join(__dirname, 'app.js'));

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
  tray.destroy();  // Cleanup tray icon when all windows are closed (macOS specific)
  app.quit();
});