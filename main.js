const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');
const childProcess = require('child_process');

let tray = null;
let mainWindow = null;

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    icon: 'public/assets/apple.png',
    webPreferences: {
      nodeIntegration: false, // safer, especially with server
      contextIsolation: true
    }
  });

  mainWindow.loadURL('http://localhost:3001'); // your Express server
}

function createTray() {
    tray = new Tray('public/assets/apple.png');
  
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

app.whenReady().then(() => {
  // Start the Express server
  childProcess.fork(path.join(__dirname, 'app.js'));

  createWindow();
  createTray();
});