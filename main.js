// Import necessary modules from Electron
const { app, BrowserWindow, Tray, Menu, dialog } = require('electron'); 
const path = require('path');  // Module for handling and transforming file paths
const { shell } = require('electron');

// Check if the app is in development mode or production
const isDev = !app.isPackaged;  // If the app is not packaged, it is in development mode
const appRoot = isDev ? __dirname : path.join(process.resourcesPath);  // Set the app root path based on the environment
if (isDev){require('dotenv').config({ quiet: true });}
else {require('dotenv').config({ path: path.join(process.resourcesPath, '.env'), quiet: true });}

// Set the appropriate icon and db path based on whether the app is in development or production
let iconPath;
let dbPath;
if (!isDev){
  iconPath = path.join(appRoot, 'apple.ico'); // Production icon path
  dbPath = path.join(appRoot, "database.db");
} else {
  iconPath = path.join(appRoot, 'public/assets/apple.ico'); // Development icon path
  dbPath = path.join(appRoot, "resources/database.db")
}

let tray;  // Tray object to handle the system tray icon
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

  mainWindow.on('will-resize', (event) => {
  if (!mainWindow.isMaximized()) event.preventDefault();
  });

  // Load the app's URL or local server page
  mainWindow.loadURL(`https://${process.env.HOST}:${process.env.PORT}`);

  // Event handler when the window is about to close
  mainWindow.on('close', (event) => {
    if (quit) {
      tray.destroy();
      app.quit();
    } else {
      event.preventDefault();       // Prevent full app quit
      mainWindow.destroy();         // Fully destroy the window
      mainWindow = null;            // Allow re-creation
    }
  });
}

// Function to create the system tray
function createTray() {
  tray = new Tray(iconPath);  // Create a tray with the specified icon

  // Create a context menu for the tray icon
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open App',
      click: () => {
        if (!mainWindow) {
          createWindow();           // Create a new window if none exists
          mainWindow.show();
        } else {
          mainWindow.show();        // Just show if already created
        }
      }
    },
    {
      label: 'Close App',
      click: () => {
        if (mainWindow) {
          mainWindow.close();       // Close (destroy) it
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        quit = true;
        tray.destroy();
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Apple Monitor Server');  // Set the tooltip for the tray icon
  tray.setContextMenu(contextMenu);  // Set the context menu for the tray icon

  // Toggle visibility of the window when the tray icon is double-clicked
  tray.on('double-click', () => {
    if (!mainWindow) {
      createWindow();
      mainWindow.show();
    }
    else mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });

  createMenu(); // Create the menu at the top
}

async function createMenu() {
  const template = [
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggledevtools' },
        { role: "togglefullscreen"},
        {
        label: 'Open Database',
        click: async () => {
          await shell.openPath(dbPath);
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}


// When the app is ready, set up the main window, tray, and start the server
app.whenReady().then(async () => {
  app.commandLine.appendSwitch('ignore-certificate-errors');
  require('./app.js');  // Start the server inside Electron (server script)

  createTray();  // Create the system tray icon

  // Show a message box indicating that the monitoring server has been activated
  dialog.showMessageBox({
    type: 'none',  // No icon type
    title: "Apple Server",  // Title of the dialog box
    message: 'The monitoring server has been activated',  // Message displayed
    buttons: ['OK'],  // Buttons in the dialog box
    icon: iconPath  // Set the icon for the dialog box
  });
});

// Event handler when all windows are closed (for macOS behavior)
app.on('window-all-closed', (event) => {
  event.preventDefault();  // Prevent the default behavior of closing the app
});
