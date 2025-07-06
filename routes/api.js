// Import necessary modules and functions
const express = require('express');
const router = express.Router();
// Import specific functions from 'server_functions.js' for handling switch data, user authentication, etc.
const { addSwitch, editSwitch, deleteSwitch, getSwitch, getSwitchAll, toggleWhitelist, getWhitelistAll, saveLog, getLogs } = require('./server_functions'); 

// Set to track the IP addresses of connected clients
const connectedClients = new Map();

// Middleware to track connected clients' IP addresses
router.use((req, res, next) => {
    const clientIp = req.socket.remoteAddress; // Get the IP address of the incoming request
    connectedClients.set(clientIp, Date.now()); // Add the IP and time to the connectedClients map to track active clients
    next(); // Pass the request to the next middleware or route handler
});

// 🟢 GET all switches
router.get('/getAll', async (req, res) => {
    try {
        const switches = await getSwitchAll(); // Fetch all switches from the database
        //await saveLog("Get Switches", req.socket.remoteAddress);
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
        //await saveLog("Get Switch", req.socket.remoteAddress);
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
        await saveLog("Add Switch", req.socket.remoteAddress, ip, name);
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
        const { ip, name } = req.body; // Extract the IP address of the switch to be deleted from the request body
        await deleteSwitch(ip); // Call the function to delete the switch from the database
        await saveLog("Delete Switch", req.socket.remoteAddress, ip, name);
        res.status(200).json({ message: "Switch deleted successfully" }); // Return a success message upon deletion
    } catch (error) {
        console.error("Error deleting switch:", error); // Log any errors
        res.status(500).json({ error: "Internal Server Error" }); // Return 500 status if an error occurs
    }
});

// 🟠 EDIT a switch (PUT)
router.put('/edit', async (req, res) => {
    const { id, ip, name, oldIP, oldName } = req.body.data || req.body; // Extract data to edit the switch
    try {
        const result = await editSwitch(id, ip, name); // Call the function to update the switch in the database
        if (result?.error) {
            res.status(409).json(result); // Return 409 if there is a conflict (e.g., duplicate data)
        } else {
            await saveLog("Edit Switch", req.socket.remoteAddress, oldIP, oldName, ip, name);
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

// GET /clients: Returns a list of connected clients based on IP address
router.get('/clients', async (req, res) => {
    //await saveLog("Get Clients", req.socket.remoteAddress);
    res.json(Array.from(connectedClients.entries())); // Return the set of connected client IPs as an array
});

// POST /whitelist: whitelist or unwhitelist a client based on the provided IP
router.post('/whitelist', async (req, res) => {
    const { isWhitelisted, clientIp, name } = req.body; // Extract whitelisting status and IP address from the request body
    try {
        await toggleWhitelist(isWhitelisted, clientIp, name); // Toggle the whitelist status of the client IP
        if (!isWhitelisted){connectedClients.delete(clientIp);}
        if (isWhitelisted){await saveLog("Unwhitelist", req.socket.remoteAddress, clientIp, name);}
        else {await saveLog("Whitelist", req.socket.remoteAddress, clientIp, name);}
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

// 🟢 GET all whitelisted users
router.get('/getWhitelistAll', async (req, res) => {
    try {
        const whitelist = await getWhitelistAll(); // Fetch all whitelisted users from the database
        //await saveLog("Get Whitelist", req.socket.remoteAddress);
        res.status(200).json(whitelist); // Return the whitelisted users as JSON response
    } catch (error) {
        console.error("Error fetching whitelisted users:", error); // Log any errors
        res.status(500).json({ error: "Internal Server Error" }); // Return a 500 status if an error occurs
    }
});

// GET all logs
router.get('/getLogs', async (req, res) => {
    try {
        const switches = await getLogs(); // Fetch all logs from the database
        //await saveLog("Get Logs", req.socket.remoteAddress);
        res.status(200).json(switches); // Return the switches as JSON response
    } catch (error) {
        console.error("Error fetching logs:", error); // Log any errors
        res.status(500).json({ error: "Internal Server Error" }); // Return a 500 status if an error occurs
    }
});

// Export the router to be used in the main app
module.exports = { router };
