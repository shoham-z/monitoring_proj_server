// Import necessary modules from Electron
const { app, BrowserWindow, Tray, Menu, dialog } = require('electron'); 
const path = require('path');  // Module for handling and transforming file paths

// Check if the app is in development mode or production
const isDev = !app.isPackaged;  // If the app is not packaged, it is in development mode
const appRoot = isDev ? __dirname : path.join(process.resourcesPath);  // Set the app root path based on the environment

// Set the appropriate icon path based on whether the app is in development or production
let iconPath;
if (!isDev){
  iconPath = path.join(appRoot, 'apple.ico'); // Production icon path
} else {
  iconPath = path.join(appRoot, 'public/assets/apple.ico'); // Development icon path
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
    autoHideMenuBar: true,  // Auto-hide the menu bar
    webPreferences: {
      nodeIntegration: false,  // Disable node integration in the renderer process
      contextIsolation: true,  // Isolate the renderer process context for security
    }
  });

  mainWindow.on('will-resize', (event) => {
  if (!mainWindow.isMaximized()) event.preventDefault();
  });

  // Load the app's URL or local server page
  mainWindow.loadURL('http://localhost:3001');

  // Event handler when the window is about to close
  mainWindow.on('close', (event) => {
    if (quit) {
      tray.destroy();  // Destroy the tray when quitting
      app.quit();  // Quit the app
    } else {
      event.preventDefault();  // Prevent the window from closing
      mainWindow.hide();  // Hide the window instead of closing it
    }
  });
}

// Function to create the system tray
function createTray() {
  tray = new Tray(iconPath);  // Create a tray with the specified icon

  // Create a context menu for the tray icon
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },  // Show the app window
    { label: 'Hide App', click: () => mainWindow.hide() },  // Hide the app window
    { type: 'separator' },  // Separator line in the context menu
    {
      label: 'Quit',
      click: () => {
        quit = true;  // Set the quit flag to true
        tray.destroy();  // Destroy the tray
        app.quit();  // Quit the app
      }
    }
  ]);

  tray.setToolTip('Apple Monitor Server');  // Set the tooltip for the tray icon
  tray.setContextMenu(contextMenu);  // Set the context menu for the tray icon

  // Toggle visibility of the window when the tray icon is double-clicked
  tray.on('double-click', () => {
    if (mainWindow.isVisible()) mainWindow.hide();  // Hide if visible
    else mainWindow.show();  // Show if hidden
  });
}

// When the app is ready, set up the main window, tray, and start the server
app.whenReady().then(async () => {
  require('./app.js');  // Start the server inside Electron (server script)

  createWindow();  // Create the main application window
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
