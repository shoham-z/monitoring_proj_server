// Import necessary modules and functions
const express = require('express');
const router = express.Router();
// Import specific functions from 'server_functions.js' for handling device data, user authentication, etc.
const { addDevice, editDevice, deleteDevice, getDeviceIP, getDeviceID, getDeviceAll, toggleWhitelist, getWhitelistAll, saveLog, getLogs, ForwardToServer2, overwriteDatabase } = require('./server_functions'); 
const path = require('path');
const fs = require('fs');

let dbPath;
try {
  const { app } = require('electron');
  const isDev = !app || !app.isPackaged;
  dbPath = isDev
    ? path.join(__dirname, '../resources', 'database.db')
    : path.join(process.resourcesPath, 'database.db');
} catch (e) {
  dbPath = path.join(__dirname, 'database.db');
}

// Set to track the IP addresses of connected clients
const connectedClients = new Map();

// Middleware to track connected clients' IP addresses
router.use((req, res, next) => {
    const clientIp = req.socket.remoteAddress; // Get the IP address of the incoming request
    connectedClients.set(clientIp, Date.now()); // Add the IP and time to the connectedClients map to track active clients
    next(); // Pass the request to the next middleware or route handler
});

// 🟢 GET all devices
router.get('/getAll', async (req, res) => {
    try {
        const devices = await getDeviceAll(); // Fetch all devices from the database
        //await saveLog("Get Devices", req.headers['original-ip'] || req.socket.remoteAddress);
        res.status(200).json(devices); // Return the devices as JSON response
    } catch (error) {
        console.error("Error fetching devices:", error); // Log any errors
        res.status(500).json({ error: "Internal Server Error" }); // Return a 500 status if an error occurs
    }
});

// 🔵 GET a single device by IP
router.get('/get', async (req, res) => {
    try {
        const { ip } = req.body;
        const deviceData = await getDeviceIP(ip); // Fetch a single device based on the provided IP address
        if (!deviceData) {
            return res.status(404).json({ error: "device not found" }); // Return 404 if no device is found for the given IP
        }
        //await saveLog("Get Device", req.headers['original-ip'] || req.socket.remoteAddress);
        res.status(200).json(deviceData); // Return the device data as JSON response
    } catch (error) {
        console.error("Error fetching device:", error); // Log any errors
        res.status(500).json({ error: "Internal Server Error" }); // Return 500 status if an error occurs
    }
});

// 🟡 ADD a device (POST)
router.post('/add', async (req, res) => {
    const { ip, name } = req.body;
    if (!ip || !name) {
        return res.status(400).json({ error: "Missing required fields" }); // Return 400 if required fields are missing
    }
    
    try {
        await addDevice(ip, name); // Add the new device to the database
        await saveLog("Add Device", req.headers['original-ip'] || req.socket.remoteAddress, ip, name);
        res.status(201).json({ message: "Device added successfully" }); // Return a success message
        ForwardToServer2(req).catch(console.error);
    } catch (err) {
        if (err?.error) {
            res.status(409).json(err); // Return 409 if there's a conflict (e.g., device already exists)
        } else {
            console.error("Error adding device:", err); // Log any errors
            res.status(500).json({ err: "Internal Server Error" }); // Return 500 if an error occurs
        }
    }
});

// 🔴 DELETE a device
router.delete('/delete', async (req, res) => {
    try {
        const { ip } = req.body; // Extract the IP address of the device to be deleted from the request body
        const row = await getDeviceIP(ip);
        await deleteDevice(ip); // Call the function to delete the device from the database
        await saveLog("Delete Device", req.headers['original-ip'] || req.socket.remoteAddress, ip, row.name);
        res.status(200).json({ message: "Device deleted successfully" }); // Return a success message upon deletion
        ForwardToServer2(req).catch(console.error);
    } catch (error) {
        console.error("Error deleting device:", error); // Log any errors
        res.status(500).json({ error: "Internal Server Error" }); // Return 500 status if an error occurs
    }
});

// 🟠 EDIT a device (PUT)
router.put('/edit', async (req, res) => {
    const { id, ip, name } = req.body.data || req.body; // Extract data to edit the device
    try {
        const row = await getDeviceID(id);
        const result = await editDevice(id, ip, name); // Call the function to update the device in the database
        if (result?.error) {
            res.status(409).json(result); // Return 409 if there is a conflict (e.g., duplicate data)
        } else {
            await saveLog("Edit Device", req.headers['original-ip'] || req.socket.remoteAddress, row.ip, row.name, ip, name);
            res.status(200).json({ message: `Edited Successfully!` }); // Return success message if the update is successful
            ForwardToServer2(req).catch(console.error);
        }
    } catch (err) {
        if (err?.error) {
            res.status(409).json(err); // Return 409 if there's a conflict
        } else {
            console.error(err)
            res.status(400).json(err); // Return 400 if the data provided is invalid or incomplete
        }
    }
});

// GET /clients: Returns a list of connected clients based on IP address
router.get('/clients', async (req, res) => {
    //await saveLog("Get Clients", req.headers['original-ip'] || req.socket.remoteAddress);
    res.json(Array.from(connectedClients.entries())); // Return the set of connected client IPs as an array
});

// POST /whitelist: whitelist or unwhitelist a client based on the provided IP
router.post('/whitelist', async (req, res) => {
    const { isWhitelisted, clientIp, name } = req.body; // Extract whitelisting status and IP address from the request body
    try {
        await toggleWhitelist(isWhitelisted, clientIp, name); // Toggle the whitelist status of the client IP
        if (!isWhitelisted){connectedClients.delete(clientIp);}
        if (isWhitelisted){await saveLog("Unwhitelist", req.headers['original-ip'] || req.socket.remoteAddress, clientIp, name);}
        else {await saveLog("Whitelist", req.headers['original-ip'] || req.socket.remoteAddress, clientIp, name);}
        res.status(200).json({ message: `${isWhitelisted ? "Unhitelisted" : "Whitelisted"} Successfully!` });; // Return a success response if the whitelist action is completed
        ForwardToServer2(req).catch(console.error);
    } catch (err){
        if (err?.error){res.status(409).json(err.error)} 
        else {
            console.error(`Error whitelisting ip: ${clientIp}`); // Log any errors if whitelisting fails
            res.status(500).json({ error: "Internal Server Error" }); // Return 500 status if an error occurs
        }
    }
});

// GET /getIP: Returns the client's IP address
router.get('/getIP', (req, res) => {
    const ip = req.socket.remoteAddress; // Get the client's IP
    res.json({ ip }); // Return the client's IP address as JSON
});

// GET /isHost: Returns true if given the ip of a host
router.post('/isHost', (req, res) => {
    const { userIP } = req.body;
    res.json([process.env.HOST, process.env.OTHER_HOST].includes(userIP));
});

// 🟢 GET all whitelisted users
router.get('/getWhitelistAll', async (req, res) => {
    try {
        const whitelist = await getWhitelistAll(); // Fetch all whitelisted users from the database
        //await saveLog("Get Whitelist", req.headers['original-ip'] || req.socket.remoteAddress);
        res.status(200).json(whitelist); // Return the whitelisted users as JSON response
    } catch (error) {
        console.error("Error fetching whitelisted users:", error); // Log any errors
        res.status(500).json({ error: "Internal Server Error" }); // Return a 500 status if an error occurs
    }
});

// GET all logs
router.get('/getLogs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const search = req.query.search || "";
        const logs = await getLogs(page, search);
        res.status(200).json(logs);
    } catch (error) {
        console.error("Error fetching logs:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post('/sync', async (req, res) => {
    if (![process.env.HOST, process.env.OTHER_HOST].includes(req.socket.remoteAddress) || req.headers['x-sync-key'] !== process.env.SYNC_SECRET)
    {return res.status(403).send('Forbidden');}

    const IncomingTime = Number(req.headers['time']) || 0;
    const logs = await getLogs();
    const localTime = logs[0]?.time || 0;

    if (localTime > IncomingTime){
        try {
        const dbBuffer = fs.readFileSync(dbPath);

        // Forward the database to the other server
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', dbBuffer.length);
        res.setHeader('time', localTime); // Optional: send back the timestamp
        res.status(202).send(dbBuffer);
        
        } catch (err) {
        console.error("Failed to forward request to other server:", err);
        res.status(500).send("Failed to forward request to other server");
        }
    } else {await overwriteDatabase(req, res);}
})

// Export the router to be used in the main app
module.exports = { router };
