// Import necessary modules
const express = require('express'); // Express framework for server handling
const path = require('path'); // Path module to manage file paths
const logger = require('morgan'); // HTTP request logger middleware
const { isWhitelisted, getLogs } = require('./routes/server_functions'); // Import functions
const fs = require('fs');
const { app: electronApp } = require('electron');

const dotenv = require('dotenv');
const basePath = electronApp.isPackaged
  ? path.dirname(process.execPath)
  : __dirname;
const dbPath = path.join(basePath, 'resources', 'database.db');
dotenv.config({ path: path.join(basePath, '.env'), quiet: true });

// Import API router for handling API requests
const { router } = require('./routes/api');
const app = express(); // Create a new Express application

app.use((req, res, next) => {
  const host = req.headers.host;
  // Block access if the host header contains "localhost" or "127.0.0.1"
  if (host.includes('localhost') || host.includes('127.0.0.1')) {return res.status(404);}
  next();
});

// Middleware to disable caching in development (removes HTTP 304 responses)
// Remove this once the application is finished and optimized
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private'); // Prevent caching
    next(); // Continue to the next middleware
});

// Set up EJS as the view engine
app.set('view engine', 'ejs');

// HTTP request logging middleware (logs all HTTP requests)
app.use(logger('dev'));

// Middleware to parse JSON bodies in requests
app.use(express.json({ limit: '10mb' }));
// Middleware to parse URL-encoded data in requests (e.g., form submissions)
app.use(express.urlencoded({ extended: false }));

// // API-specific middleware to check if the client's IP is whitelisted
app.use("/api", async (req, res, next) => {
    if (!(await isAllowed(req))) 
    {return res.status(403).json({ redirect: '/blocked.html' });} // Send 403 Forbidden if the IP is not whitelisted
    
    next(); // If whitelisted, continue to the next middleware/router
});

// Use the API router to handle requests under the /api path
app.use('/api', router);

app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    return res.status(404);
  }
  next();
});

// Serve the device page when accessing the root URL ('/')
app.get('/', async (req, res) => {
    if (await isAllowed(req)){res.sendFile(path.join(__dirname, 'public', 'devices.html'));}
    else {res.status(403).sendFile(path.join(__dirname, 'public', 'blocked.html'));} // Send the devices.html file as a response
});

// Serve the devices page, only if the user is authenticated
app.get('/devices', async (req, res) => {
    if (await isAllowed(req)){res.sendFile(path.join(__dirname, 'public', 'devices.html'));}
    else {res.status(403).sendFile(path.join(__dirname, 'public', 'blocked.html'));} // Send the devices.html page as a response
});

// Serve the clients page, only if the user is authenticated
app.get('/clients', async (req, res) => {
    if (await isAllowed(req)){res.sendFile(path.join(__dirname, 'public', 'clients.html'));}
    else {res.status(403).sendFile(path.join(__dirname, 'public', 'blocked.html'));} // Send the clients.html page as a response
});

// Serve the logs page, only if the user is authenticated
app.get('/logs', async (req, res) => {
    if (await isAllowed(req)){res.sendFile(path.join(__dirname, 'public', 'logs.html'));}
    else {res.status(403).sendFile(path.join(__dirname, 'public', 'blocked.html'));} // Send the clients.html page as a response
});

// Serve static files (e.g., images, stylesheets) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public'), { index: 'devices.html' }));

// Start the server and listen on a specific port, accessible from all IP addresses (0.0.0.0)
app.listen(process.env.PORT, '0.0.0.0', async () => {
  console.log("✅ Server is listening");
  await syncDatabase(); // <-- call here!
});

// Export the app for potential testing or external use
module.exports = app;

async function syncDatabase(){
  {
  try {
    const dbBuffer = fs.readFileSync(dbPath);
    const logs = await getLogs();
    const time = logs[0]?.time || 0;

    const response = await fetch(`http://${process.env.OTHER_HOST}:${process.env.PORT}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': dbBuffer.length,
        'x-sync-key': process.env.SYNC_SECRET,
        'time': time
      },
      body: dbBuffer
    });

    if (response.status === 202){
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(dbPath, buffer);
      console.log("✅ Database successfully synced from other server.");
    }
  } catch (err) {
    console.error("❌ Failed to sync at startup:", err.message);
  }
}
}

async function isAllowed(req){
  const ip = req.socket.remoteAddress;  // Get the client IP
  return [process.env.HOST, process.env.OTHER_HOST].includes(ip) || await isWhitelisted(ip);
}