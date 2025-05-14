// Import necessary modules
const express = require('express'); // Express framework for server handling
const path = require('path'); // Path module to manage file paths
const cors = require('cors'); // CORS (Cross-Origin Resource Sharing) middleware for enabling cross-origin requests
const cookieParser = require('cookie-parser'); // Middleware to parse cookies
const logger = require('morgan'); // HTTP request logger middleware
const session = require('express-session'); // Middleware to handle sessions
const { isAuthenticated, isBlocked } = require('./routes/server_functions'); // Import functions for authentication and IP blocking

// Import API router for handling API requests
const apiRouter = require('./routes/api');
const app = express(); // Create a new Express application

// Configure session management
app.use(session({
    secret: 'ae1fc790fb0b1c435e6a9c40cb9c44a4a2e35fbcac61e7c7e3a44b68f65f86d3f0d3c5d394c79fd2aa964f76e6c4dc5f0b6e30e0b6a786dc0e472ad51ad9be66y',  // Secret key for session encryption
    resave: false,    // Don't force session to be saved back to the session store
    saveUninitialized: false,  // Don't create sessions until something is stored
    cookie: {
        maxAge: 1000 * 60 * 10 // Set session cookie to expire in 10 minutes
    }
}));

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
// Serve static files (e.g., images, stylesheets) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public'), { index: 'login.html' }));

// // API-specific middleware to check if the client's IP is blocked
app.use('/api', async (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;  // Get the client IP
    const row = await isBlocked(ip); // Check if the IP is blocked
    if (row) {
        return res.status(403).send("Your IP is blocked."); // Send 403 Forbidden if the IP is blocked
    }
    next(); // If not blocked, continue to the next middleware/router
});

// Use the API router to handle requests under the /api path
app.use('/api', apiRouter);

// Serve the login page when accessing the root URL ('/')
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html')); // Send the login.html file as a response
});

// Serve the switches page, only if the user is authenticated
app.get('/switches', isAuthenticated, (req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private', // Prevent caching of the page
        'Pragma': 'no-cache', // Prevent caching
        'Expires': '0' // Set expiration to 0, making the page non-cacheable
    });
    res.sendFile(path.join(__dirname, 'views_secure/switches.html')); // Send the switches.html page as a response
});

// Serve the clients page, only if the user is authenticated
app.get('/clients', isAuthenticated, (req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private', // Prevent caching of the page
        'Pragma': 'no-cache', // Prevent caching
        'Expires': '0' // Set expiration to 0, making the page non-cacheable
    });
    res.sendFile(path.join(__dirname, 'views_secure/clients.html')); // Send the clients.html page as a response
});

// Start the server and listen on port 3001, accessible from all IP addresses (0.0.0.0)
app.listen(3001, '0.0.0.0');

// Export the app for potential testing or external use
module.exports = app;
