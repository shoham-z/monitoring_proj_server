// Import necessary modules from Electron
const { app, BrowserWindow, Tray, Menu, dialog } = require('electron'); 
const path = require('path');  // Module for handling and transforming file paths
const fs = require('fs');
const archiver = require('archiver');
const unzipper = require('unzipper');
const os = require('os');
const { getDeviceAll, getLogs, getWhitelistAll, insertTable, saveLog} = require('./routes/server_functions.js');
require('dotenv').config({ quiet: true });

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
let menu; // Menu bar

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
  mainWindow.loadURL(`http://${process.env.HOST}:${process.env.PORT}`);

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

function getLocalIP(includeInternal = true) {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const iface of Object.values(interfaces)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4') {
        if (includeInternal || !addr.internal) {
          addresses.push(addr.address);
        }
      }
    }
  }

  return addresses.length > 0 ? addresses[0] : '127.0.0.1';
}

function removeNulls(obj) {
  if (Array.isArray(obj)) {
    return obj.map(removeNulls);
  } else if (obj && typeof obj === 'object') {
    const cleaned = {};
    for (const key in obj) {
      if (obj[key] !== null && obj[key] !== undefined) {
        cleaned[key] = removeNulls(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
}

async function exportTable(tableName) {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: tableName === 'all' ? 'Export All Tables (ZIP)' : `Export ${tableName}`,
    defaultPath: tableName === 'all' ? 'export_all.zip' : `${tableName}.json`,
    filters: tableName === 'all' ?
      [{ name: 'ZIP Archive', extensions: ['zip'] }] :
      [{ name: 'JSON', extensions: ['json'] }]
  });

  if (canceled || !filePath) return;

  if (tableName === 'all') {
    // Gather data
    const whitelist = await getWhitelistAll();
    const devices = await getDeviceAll();
    const logs = await getLogs(-1);

    // Create ZIP archive stream
    const output = fs.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Listen for errors
    archive.on('error', err => { throw err; });

    archive.pipe(output);

    // Append each JSON as a separate file inside the zip
    archive.append(JSON.stringify(removeNulls(whitelist), null, 2), { name: 'whitelist.json' });
    archive.append(JSON.stringify(removeNulls(devices), null, 2), { name: 'devices.json' });
    archive.append(JSON.stringify(removeNulls(logs), null, 2), { name: 'logs.json' });

    await archive.finalize();
    saveLog("Export All", getLocalIP(), "null", "null");

  } else {
    // Single JSON export (same as before)
    let data;

    if (tableName === 'whitelist') {
      data = await getWhitelistAll();
    } else if (tableName === 'devices') {
      data = await getDeviceAll();
    } else if (tableName === 'logs') {
      data = await getLogs(-1);
    }

    fs.writeFileSync(filePath, JSON.stringify(removeNulls(data), null, 2));
    saveLog(`Export ${tableName.charAt(0).toUpperCase() + tableName.slice(1)}`, getLocalIP(), "null", "null");
  }
}

async function importTable(tableName) {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: `Import ${tableName}`,
    filters: tableName === 'all'
      ? [{ name: 'ZIP Archive', extensions: ['zip'] }]
      : [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });

  if (canceled || !filePaths.length) return;

  const filePath = filePaths[0];

  if (tableName === 'all') {
    const tempDir = path.join(__dirname, 'tmp_import');
    fs.mkdirSync(tempDir, { recursive: true });

    await fs.createReadStream(filePath)
      .pipe(unzipper.Extract({ path: tempDir }))
      .promise();

    const tables = ['whitelist', 'devices', 'logs'];
    for (const tbl of tables) {
      const jsonPath = path.join(tempDir, `${tbl}.json`);
      if (fs.existsSync(jsonPath)) {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const data = JSON.parse(raw);
        await insertTable(tbl, data);  // Direct call, no HTTP needed
      }
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
    saveLog(`Import All`, getLocalIP(), "null", "null");

  } else {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    await insertTable(tableName, data);
    saveLog(`Import ${tableName.charAt(0).toUpperCase() + tableName.slice(1)}`, getLocalIP(), "null", "null");
  }

  console.log(`Imported data for ${tableName} successfully.`);
}

async function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Export',
          submenu: [
            {
              label: 'Whitelist',
              click: async () => await exportTable('whitelist')
            },
            {
              label: 'Devices',
              click: async () => await exportTable('devices')
            },
            {
              label: 'Logs',
              click: async () => await exportTable('logs')
            },
            { type: 'separator' },
            {
              label: 'All (ZIP)',
              click: async () => await exportTable('all')
            }
          ]
        },
        {
          label: 'Import',
          submenu: [
            {
              label: 'Whitelist',
              click: async () => await importTable('whitelist')
            },
            {
              label: 'Devices',
              click: async () => await importTable('devices')
            },
            {
              label: 'Logs',
              click: async () => await importTable('logs')
            },
                        { type: 'separator' },
            {
              label: 'All (ZIP)',
              click: async () => await importTable('all')
            }
          ]
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggledevtools' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}


// When the app is ready, set up the main window, tray, and start the server
app.whenReady().then(async () => {
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
