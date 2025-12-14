const { app, BrowserWindow, Tray, Menu, dialog } = require('electron');  // Electron modules for app lifecycle, windows, tray, menus, and dialogs
const path = require('path');  // Path module to manage file paths
const { shell } = require('electron');  // Electron module to open files/URLs with the system default apps
const net = require('net'); // Node.js module for TCP/IPC networking (used to check if a port is in use)
const { isValidIPv4 } = require('./backend/server_functions'); // Import functions

// Check if the app is in development mode or production
const isDev = !app.isPackaged;  // If the app is not packaged, it is in development mode
const appRoot = isDev ? __dirname : path.join(process.resourcesPath);  // Set the app root path based on the environment

// Set the appropriate icon and db path based on whether the app is in development or production
let iconPath;
let dbPath;
let syncStatusPath;
let envPath;
if (!isDev){
  iconPath = path.join(appRoot, 'apple.ico');  // Production icon path
  dbPath = path.join(appRoot, "database.db");  // Production database path
  syncStatusPath = path.join(appRoot, "sync_status.log");
  envPath = path.join(appRoot, ".env");
} else {
  iconPath = path.join(appRoot, 'public/assets/apple.ico'); // Development icon path
  dbPath = path.join(appRoot, "resources/database.db");  // Development database path
  syncStatusPath = path.join(appRoot, "resources/sync_status.log");  // Development database path
  envPath = path.join(appRoot, ".env");
}

// Load environment variables from .env file
require('dotenv').config({path: envPath, quiet: true });

let tray;  // Tray object to handle the app's tray icon
let mainWindow;  // Main application window

let quit = false;  // Flag to track whether the user wants to quit the app

// Function to create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,  // Set the window width
    height: 1000,  // Set the window height
    show: false,  // Initially hide the window when created
    icon: iconPath,  // Set the window icon
    webPreferences: {
      nodeIntegration: false,  // Disable node integration in the renderer process
      contextIsolation: true,  // Isolate the renderer process context for security
    }
  });

  // Prevent window from being resized
  mainWindow.on('will-resize', (event) => {
  if (!mainWindow.isMaximized()) event.preventDefault();
  });

  // Load the app's URL or local server page
  mainWindow.loadURL(`${process.env.PROTOCOL.toLowerCase()}://${process.env.HOST}:${process.env.PORT}`);

  // Event handler when the window is about to close
  mainWindow.on('close', (event) => {
    if (quit) {
      tray.destroy();  // Destroys the tray icon
      app.quit();  //  Closes the app and the server
    } else {
      event.preventDefault();  // Prevent full app quit
      mainWindow.destroy();  // Fully destroy the window
      mainWindow = null;  // Allow re-creation
    }
  });
}

// Function to create the tray icon and its behavior
function createTray() {
  tray = new Tray(iconPath);  // Create a tray icon with the specified image

  // Create a context menu for the tray icon
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open App',
      click: () => {
        if (!mainWindow) {
          createWindow();  // Create a new window if none exists
          mainWindow.show();
        } else {
          mainWindow.show();  // Just show if already created
        }
      }
    },
    {
      label: 'Close App',
      click: () => {
        if (mainWindow) {
          mainWindow.close();  // Close (destroy) it
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        quit = true;  // Flag to prevent re-creation on close
        tray.destroy();  // Remove tray icon
        app.quit();  // Quit the app
      }
    }
  ]);

  tray.setToolTip('Apple Monitor Server');  // Tooltip on hover
  tray.setContextMenu(contextMenu);  // Attach context menu

  // Toggle window visibility on double-click
  tray.on('double-click', () => {
    if (!mainWindow) {
      createWindow();
      mainWindow.show();
    }
    else mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });

  createMenu(); // Set the top application menu
}

// Function to create the top application menu
async function createMenu() {
  const template = [
    {
      label: 'View',
      submenu: [
        { role: 'reload' },  // Reload the window
        { role: 'toggledevtools' },  // Open/close dev tools
        { role: "togglefullscreen" },  // Toggle fullscreen mode
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Open Server Configuration',
          click: async () => {
            await shell.openPath(envPath);  // Open the SQLite database file
          }
        },
        {
          label: 'Open Database',
          click: async () => {
            await shell.openPath(dbPath);  // Open the SQLite database file
          }
        },
        {
          label: 'Show Sync Status',
          click: async () => {
            await shell.openPath(syncStatusPath);  // Open the SQLite database file
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);  // Build menu from template
  Menu.setApplicationMenu(menu);  // Apply as application menu
}

function showErrorAndExit(message) {
  console.error(message); // Log for debugging if console is visible
  dialog.showErrorBox("Server Startup Error", message); // Show GUI error to user
  process.exit(1); // Stop the app
}

async function isPortInUse(port) {
  return new Promise((resolve, reject) => {
    const tester = net.createServer()
      .once('error', err => {
        if (err.code === 'EADDRINUSE') resolve(true); // Port is taken
        else reject(err); // Other error
      })
      .once('listening', () => {
        tester.close();      // Close immediately — we just wanted to check
        resolve(false);      // Port is free
      })
      .listen(port, '0.0.0.0'); // Try binding to check
  });
}

// When the app is ready, start the server, create the tray, and show activation message
app.whenReady().then(async () => {
  if (!["http","https"].includes(process.env.PROTOCOL.toLowerCase())) {
    showErrorAndExit(`Invalid PROTOCOL [${process.env.PROTOCOL}]. Please set it to [HTTP] or [HTTPS] in the .env file.`);
  }

  const HOST = process.env.HOST;
  const OTHER_HOST = process.env.OTHER_HOST;

  if (HOST.toLowerCase().includes("localhost") || !isValidIPv4(HOST)){
    showErrorAndExit(`Invalid HOST [${HOST}]. Please use a valid IPv4 address.`);
  }

    if (OTHER_HOST.toLowerCase().includes("localhost") || !isValidIPv4(OTHER_HOST)){
    showErrorAndExit(`Invalid OTHER_HOST [${OTHER_HOST}]. Please use a valid IPv4 address.`);
  }

  if (await isPortInUse(process.env.PORT)){
    showErrorAndExit(`Port ${process.env.PORT} is already in use. Please close the other app.`);
  }
  
  app.commandLine.appendSwitch('ignore-certificate-errors'); // Ignore SSL errors (self-signed certificates)

  require('./app.js');  // Start the monitoring server

  createTray();  // Create system tray icon and menu

  // Notify the user that the server has started
  dialog.showMessageBox({
    type: 'none',  
    title: "Apple Server",  
    message: 'The monitoring server has been activated',  
    buttons: ['OK'],  
    icon: iconPath  
  });
});

// Prevent app from quitting when all windows are closed
app.on('window-all-closed', (event) => {
  event.preventDefault();
});
