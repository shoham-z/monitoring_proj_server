// Import necessary modules and functions
const express = require('express');
const router = express.Router();
// Import specific functions from 'server_functions.js' for handling switch data, user authentication, etc.
const { addSwitch, editSwitch, deleteSwitch, getSwitch, getSwitchAll, getUser, hashPassword, toggleWhitelist, getWhitelistAll, getSessionAll, doesSessionExist } = require('./server_functions'); 
const argon2 = require('argon2'); // Import argon2 for secure password hashing and verification

// Set to track the IP addresses of connected clients
const connectedClients = new Map();

// Middleware to track connected clients' IP addresses
router.use((req, res, next) => {
    const clientIp = req.ip; // Get the IP address of the incoming request
    connectedClients.set(clientIp, Date.now()); // Add the IP and time to the connectedClients map to track active clients
    next(); // Pass the request to the next middleware or route handler
});
setInterval(() => {
    const now = Date.now();
    for (const [ip, lastSeen] of connectedClients.entries()) {
        if (now - lastSeen > 60 * 1_000) {
            connectedClients.delete(ip); // Remove inactive IPs
        }
    }
}, 30 * 1_000 * 5); // Run cleanup every 5 minutes

// Middleware to check if the user is authenticated (logged in)
async function isAuthenticated(req, res, next) {

    if (req.session?.user && await getUser(req.session.user)) {
        return next();
    }

    // If it's an API request, return 401 Unauthorized instead of redirecting
    if (req.originalUrl.startsWith('/api')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Redirect to the login page if the user is not authenticated
    res.redirect('/');
}

// 🟢 GET all switches
router.get('/getAll', isAuthenticated, async (req, res) => {
    try {
        const switches = await getSwitchAll(); // Fetch all switches from the database
        res.status(200).json(switches); // Return the switches as JSON response
    } catch (error) {
        console.error("Error fetching switches:", error); // Log any errors
        res.status(500).json({ error: "Internal Server Error" }); // Return a 500 status if an error occurs
    }
});

// 🔵 GET a single switch by IP
router.get('/get', async (req, res) => {
    try {
        const { ip } = req.body;
        const switchData = await getSwitch(ip); // Fetch a single switch based on the provided IP address
        if (!switchData) {
            return res.status(404).json({ error: "Switch not found" }); // Return 404 if no switch is found for the given IP
        }
        res.status(200).json(switchData); // Return the switch data as JSON response
    } catch (error) {
        console.error("Error fetching switch:", error); // Log any errors
        res.status(500).json({ error: "Internal Server Error" }); // Return 500 status if an error occurs
    }
});

// 🟡 ADD a switch (POST)
router.post('/add', async (req, res) => {
    const { ip, name } = req.body; // Destructure necessary data from the request body
    if (!ip || !name) {
        return res.status(400).json({ error: "Missing required fields" }); // Return 400 if required fields are missing
    }
    
    try {
        await addSwitch(ip, name); // Add the new switch to the database
        res.status(201).json({ message: "Switch added successfully" }); // Return a success message
    } catch (err) {
        if (err?.error) {
            res.status(409).json(err); // Return 409 if there's a conflict (e.g., switch already exists)
        } else {
            console.error("Error adding switch:", err); // Log any errors
            res.status(500).json({ err: "Internal Server Error" }); // Return 500 if an error occurs
        }
    }
});

// 🔴 DELETE a switch
router.delete('/delete', async (req, res) => {
    try {
        const { ip } = req.body; // Extract the IP address of the switch to be deleted from the request body
        await deleteSwitch(ip); // Call the function to delete the switch from the database
        res.status(200).json({ message: "Switch deleted successfully" }); // Return a success message upon deletion
    } catch (error) {
        console.error("Error deleting switch:", error); // Log any errors
        res.status(500).json({ error: "Internal Server Error" }); // Return 500 status if an error occurs
    }
});

// 🟠 EDIT a switch (PUT)
router.put('/edit', async (req, res) => {
    const { id, ip, name } = req.body.data || req.body; // Extract data to edit the switch
    try {
        const result = await editSwitch(id, ip, name); // Call the function to update the switch in the database
        if (result?.error) {
            res.status(409).json(result); // Return 409 if there is a conflict (e.g., duplicate data)
        } else {
            res.status(200).json({ message: `Edited Successfully!` }); // Return success message if the update is successful
        }
    } catch (err) {
        if (err?.error) {
            res.status(409).json(err); // Return 409 if there's a conflict
        } else {
            res.status(400).json(err); // Return 400 if the data provided is invalid or incomplete
        }
    }
});

// POST /login: Handles user login by checking credentials and saving session
router.post('/login', async (req, res) => {
    const { username, password } = req.body; // Extract the username and password from the request body
    try {
        const row = await getUser(username); // Retrieve the user data from the database
        if (!row) {
            return res.status(404).json(null); // Return 404 if the user doesn't exist
        }
        const valid = await argon2.verify(row.password, password); // Verify the password using argon2
        if (!valid) {
            return res.status(401).json(null); // Return 401 if the password is incorrect
        }
        const sessions = await getSessionAll();
        if (doesSessionExist(sessions, row.username)){
            res.status(409).json(null);
        } else {
            req.session.user = row.username; // Set the user session to the authenticated user's username
            res.status(200).json(row.username); // Return the username if the login is successful
        }
    } catch (error) {
        console.error("Error fetching user:", error); // Log any errors
        res.status(500).json({ error: "Internal Server Error" }); // Return 500 if an error occurs
    }
});

// GET /clients: Returns a list of connected clients based on IP address
router.get('/clients', (req, res) => {
    res.json(Array.from(connectedClients.entries())); // Return the set of connected client IPs as an array
});

// POST /whitelist: whitelist or unwhitelist a client based on the provided IP
router.post('/whitelist', async (req, res) => {
    const { isWhitelisted, clientIp, name } = req.body; // Extract whitelisting status and IP address from the request body
    try {
        await toggleWhitelist(isWhitelisted, clientIp, name); // Toggle the whitelist status of the client IP
        if (!isWhitelisted){connectedClients.delete(clientIp)}
        res.status(200).json(null); // Return a success response if the whitelist action is completed
    } catch (err){
        if (err?.error){res.status(409).json(err.error)} 
        else {
            console.error(`Error whitelisting ip: ${clientIp}`); // Log any errors if whitelisting fails
            res.status(500).json({ error: "Internal Server Error" }); // Return 500 status if an error occurs
        }
    }
});

// GET /getIP: Returns the client's IP address (useful for identifying the user)
router.get('/getIP', (req, res) => {
    if (req.originalUrl.startsWith('/switches') || req.originalUrl.startsWith('/clients')){
        const forwarded = req.headers['x-forwarded-for']; // Check for forwarded IP address
        const ip = forwarded ? forwarded.split(',')[0] : req.connection.remoteAddress; // Get the client's IP
        res.json({ ip }); // Return the client's IP address as JSON
    }
});

// 🟢 GET all blocked users
router.get('/getWhitelistAll', async (req, res) => {
    try {
        const whitelist = await getWhitelistAll(); // Fetch all whitelisted users from the database
        res.status(200).json(whitelist); // Return the whitelisted users as JSON response
    } catch (error) {
        console.error("Error fetching whitelisted users:", error); // Log any errors
        res.status(500).json({ error: "Internal Server Error" }); // Return a 500 status if an error occurs
    }
});

// Export the router to be used in the main app
module.exports = {
    router,
    isAuthenticated
}
