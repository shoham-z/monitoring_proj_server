// Import necessary modules
const express = require('express'); // Express framework for server handling
const path = require('path'); // Path module to manage file paths
const cors = require('cors'); // CORS (Cross-Origin Resource Sharing) middleware for enabling cross-origin requests
const cookieParser = require('cookie-parser'); // Middleware to parse cookies
const logger = require('morgan'); // HTTP request logger middleware
const { isWhitelisted } = require('./routes/server_functions'); // Import functions for authentication and IP blocking
require('dotenv').config({ quiet: true });

// Import API router for handling API requests
const { router } = require('./routes/api');
const app = express(); // Create a new Express application

app.use((req, res, next) => {
  const host = req.headers.host;
  const ip = req.ip || req.socket.remoteAddress;

  // Block access if the host header contains "localhost" or "127.0.0.1"
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    console.warn(`Blocked localhost access: ${host} from ${ip}`);
    return res.status(404);
  }
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

// Set up CORS to allow cross-origin requests with credentials
app.use(cors({
    origin: true, // Allow requests from all origins (can specify a domain in production)
    credentials: true  // Allow cookies and credentials in cross-origin requests
}));

// HTTP request logging middleware (logs all HTTP requests)
app.use(logger('dev'));

// Middleware to parse JSON bodies in requests
app.use(express.json());
// Middleware to parse URL-encoded data in requests (e.g., form submissions)
app.use(express.urlencoded({ extended: false }));
// Middleware to parse cookies from requests
app.use(cookieParser());

// // API-specific middleware to check if the client's IP is whitelisted
app.use("/api", async (req, res, next) => {
    if (await isAllowed(req)) {next();} // If whitelisted, continue to the next middleware/router
    else {return res.status(403).json({ redirect: '/blocked.html' });} // Send 403 Forbidden if the IP is not whitelisted
});

// Use the API router to handle requests under the /api path
app.use('/api', router);

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

// Start the server and listen on port 3001, accessible from all IP addresses (0.0.0.0)
app.listen(process.env.PORT, '0.0.0.0');

// Export the app for potential testing or external use
module.exports = app;

async function isAllowed(req){
    const ip = req.socket.remoteAddress;  // Get the client IP
    const row = await isWhitelisted(ip); // Check if the IP is whitelisted
    return ip === "127.0.0.1" || Boolean(row);
}