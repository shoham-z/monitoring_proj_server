// Import necessary modules
const express = require('express'); // Express framework for server handling
const path = require('path'); // Path module to manage file paths
const cors = require('cors'); // CORS (Cross-Origin Resource Sharing) middleware for enabling cross-origin requests
const cookieParser = require('cookie-parser'); // Middleware to parse cookies
const logger = require('morgan'); // HTTP request logger middleware
const session = require('express-session'); // Middleware to handle sessions
const SQLiteStore = require('connect-sqlite3')(session);
const { isWhitelisted } = require('./routes/server_functions'); // Import functions for authentication and IP blocking
const { isAuthenticated } = require('./routes/api');

// Import API router for handling API requests
const { router } = require('./routes/api');
const app = express(); // Create a new Express application

// Configure session management
app.use(session({
    store: new SQLiteStore({
         db: 'database.db',
         table: 'sessions'
        }),
    secret: "5594943a2e780abdc9a9932f74045036537f2ace0a41cdc020db52c5def3c9d33be0cdbfb7b153a343141e576736f4e0db77b5dbc4027a5b54ca4369d406aaa8",  // Secret key for session encryption
    resave: false,    // Don't force session to be saved back to the session store
    saveUninitialized: false,  // Don't create sessions until something is stored
    cookie: {
        maxAge: 1000 * 60 * 10, // Set session cookie to expire in 10 minutes
        httpOnly: true
    },
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

app.set('trust proxy', true);

// // API-specific middleware to check if the client's IP is whitelisted
app.use('/api', async (req, res, next) => {
    const ip = req.socket.remoteAddress;  // Get the client IP
    const row = await isWhitelisted(ip); // Check if the IP is whitelisted
    if (ip !== "127.0.0.1" && !row) {
        return res.status(403).send("Your IP is blocked."); // Send 403 Forbidden if the IP is not whitelisted
    }
    next(); // If whitelisted, continue to the next middleware/router
});

// Use the API router to handle requests under the /api path
app.use('/api', router);

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
