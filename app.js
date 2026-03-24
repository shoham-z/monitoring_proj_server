// Import necessary modules
const express = require('express'); // Express framework for server handling
const path = require('path'); // Path module to manage file paths
const cors = require('cors'); // CORS (Cross-Origin Resource Sharing) middleware for enabling cross-origin requests
const logger = require('morgan'); // HTTP request logger middleware (For debugging)
const { isWhitelisted, getLogs, logSyncStatus } = require('./backend/server_functions'); // Import functions
const fs = require('fs'); // File system module (read/write files)
const { app: electronApp } = require('electron'); // Electron app lifecycle control
const https = require("https"); // add this at the top with other imports
const dotenv = require('dotenv'); // Load environment variables from .env file

const basePath = electronApp.isPackaged
  ? path.dirname(process.execPath) // If packaged, use install directory
  : __dirname; // If dev, use current directory
const dbPath = path.join(basePath, 'resources', 'database.db'); // Path to SQLite database
dotenv.config({ path: path.join(basePath, '.env'), quiet: true }); // Load .env config from basePath

// Import API router for handling API requests
const { router } = require('./backend/api');
const app = express(); // Create a new Express application

app.use((req, res, next) => {
  const host = req.headers.host;
  // Block access if the host header contains "localhost" or "127.0.0.1"
  if (host.includes('localhost') || host.includes('127.0.0.1')) {return;}
  next();
});

// Set up EJS as the view engine
app.set('view engine', 'ejs');

// Set up CORS to allow cross-origin requests with credentials
app.use(cors({
    origin: true, // Allow requests from all origins (can specify a domain in production)
    credentials: true  // Allow cookies and credentials in cross-origin requests
}));

// HTTP request logging middleware (logs all HTTP requests)
app.use(logger('dev'));

// Parse incoming JSON request bodies (up to 10MB)
app.use(express.json({ limit: '10mb' }));
// Middleware to parse URL-encoded data in requests (e.g., form submissions)
app.use(express.urlencoded({ extended: false }));

// // Middleware to check if the client's IP is whitelisted
app.use("/api", async (req, res, next) => {
    if (!(await isAllowed(req))) 
    {return res.status(403).json({ redirect: '/blocked.html' });} // Send 403 Forbidden if the IP is not whitelisted
    
    next(); // If whitelisted, continue to the next middleware/router
});

// Use the API router to handle requests under the /api path
app.use('/api', router);

// Prevent direct access to HTML files via URL; force users to use designated page routes
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    return res.status(404);
  }
  next();
});

// Serve the devices page for '/' and '/devices' if whitelisted; otherwise show blocked page
app.get(['/', '/devices'], async (req, res) => {
    if (await isAllowed(req)) {
        res.sendFile(path.join(__dirname, 'public', 'devices.html')); // Send devices page
    } else {
        res.status(403).sendFile(path.join(__dirname, 'public', 'blocked.html')); // Send blocked page
    }
});

// Serve the clients page if whitelisted; otherwise show blocked page
app.get('/clients', async (req, res) => {
    if (await isAllowed(req)){res.sendFile(path.join(__dirname, 'public', 'clients.html'));}
    else {res.status(403).sendFile(path.join(__dirname, 'public', 'blocked.html'));} // Send the clients.html page as a response
});

// Serve the logs page if whitelisted; otherwise show blocked page
app.get('/logs', async (req, res) => {
    if (await isAllowed(req)){res.sendFile(path.join(__dirname, 'public', 'logs.html'));}
    else {res.status(403).sendFile(path.join(__dirname, 'public', 'blocked.html'));} // Send the clients.html page as a response
});

// Serve static assets (images, CSS, JS) from 'public'; default page is devices.html
app.use(express.static(path.join(__dirname, 'public'), { index: 'devices.html' }));

(async () => {
switch (process.env.PROTOCOL.toLowerCase()){
  case "https": {
    //Load SSL certificate + key
    const options = {
      key: fs.readFileSync(path.join(basePath, "resources", "certificates", "server.key")),
      cert: fs.readFileSync(path.join(basePath, "resources", "certificates", "server.cert")),
    };

    // Start the server using HTTPS and listen on a specific port, accessible from all IP addresses (0.0.0.0)
    https.createServer(options, app).listen(process.env.PORT, "0.0.0.0", async () => {
      console.log("✅ HTTPS server is listening");
      await syncDatabase();
    });
    break;
  }
  case "http": {
    // Start the server using HTTP and listen on a specific port, accessible from all IP addresses (0.0.0.0)
    app.listen(process.env.PORT, '0.0.0.0', async () => {
      console.log("✅ HTTP server is listening");
      await syncDatabase();
    });
    break;
  }
}
})();

// Export the Express app to run the website from the main Electron process
module.exports = app;

// Check if the client IP is allowed to access the server
async function isAllowed(req) {
  const ip = req.socket.remoteAddress;  // Get client IP
  return process.env.HOST === ip || await isWhitelisted(ip); // Allow if matches host or in whitelist
}