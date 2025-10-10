// Import necessary modules and functions
const express = require('express'); // Express framework for server handling
const router = express.Router(); // Router for API routes
// Import functions from 'server_functions.js'
const { addDevice, editDevice, deleteDevice, getDeviceIP, getDeviceID, getDeviceAll, toggleWhitelist, getWhitelistAll, saveLog, getLogs, ForwardToServer2, overwriteDatabase, logError, isValidIPv4 } = require('./server_functions'); 
const path = require('path'); // Path module to manage file paths
const fs = require('fs'); // File system module (read/write files)

let dbPath;
try {
  const { app } = require('electron'); // Import Electron's app module to check app environment
  const isDev = !app.isPackaged; // Determine if the app is in development mode (not packaged)

  // Set database path depending on environment
  dbPath = isDev
    ? path.join(__dirname, '../resources', 'database.db') // In dev: database is in ../resources relative to current file
    : path.join(process.resourcesPath, 'database.db');    // In production: database is in the app's resources folder
} catch (e) {
  // Fallback in case Electron app module is not available
  dbPath = path.join(__dirname, 'database.db'); // Use current directory as database path
}

// Set to track the IP addresses of active clients
const activeClients = new Map();

/** Middleware to track active clients' IP addresses
* @param {express.Request} req - HTTP request.
* @returns {void} This middleware does not return a value
*/
router.use((req, res, next) => {
    const clientIp = req.socket.remoteAddress; // Get the IP address of the incoming request
    activeClients.set(clientIp, Date.now()); // Add the IP and time to the activeClients map to track active clients
    next(); // Pass the request to the next middleware or route handler
});

/** 🟢 GET all devices
* @param {express.Request} req - HTTP request.
* @returns {express.Response} res - HTTP response (devices array as JSON).
*/
router.get('/getAll', async (req, res) => {
    try {
        const devices = await getDeviceAll(); // Fetch all devices from the database
        res.status(200).json(devices); // Return the devices as JSON response
    } catch (err) {
        await logError("Error fetching devices", err);
        res.status(500).json({ error: "Internal Server Error" }); // Return a 500 status if an error occurs
    }
});

/** 🔵 GET a single device by IP
* @param {express.Request} req - HTTP request (expects `ip` in body).
* @returns {express.Response} res - HTTP response (a device as JSON).
*/
router.get('/get', async (req, res) => {
    try {
        const { ip } = req.query;
        if (ip === undefined) return res.status(400).json({ error: "Missing required fields" }); // Return 400 if required fields are missing
        if (ip && !isValidIPv4(ip)) return res.status(400).json({ error: "Invalid IPv4 address" }); // Return 400 if required fields are missing
        const deviceData = await getDeviceIP(ip); // Fetch a single device based on the provided IP address
        if (!deviceData) {
            return res.status(404).json({ error: "Device not found" }); // Return 404 if no device is found for the given IP
        }
        res.status(200).json(deviceData); // Return the device data as JSON response
    } catch (err) {
        await logError("Error fetching device", err);
        res.status(500).json({ error: "Internal Server Error" }); // Return 500 status if an error occurs
    }
});

/** 🟡 ADD a device
* @param {express.Request} req - HTTP request (expects `ip` and `name` in body).
* @returns {express.Response} res - HTTP response.
*/
router.post('/add', async (req, res) => {
    const { ip, name } = req.body;
    if ([ip, name].includes(undefined)) return res.status(400).json({ error: "Missing required fields" }); // Return 400 if required fields are missin}
    if (ip && !isValidIPv4(ip)) return res.status(400).json({ error: "Invalid IPv4 address" }); // Return 400 if required fields are missing
    if (name.trim() === "") return res.status(400).json({ error: "Name cannot be empty" }); // Return 400 if required fields are missing

    try {
        await addDevice(ip, name); // Add the new device to the database
    } catch (err) {
        if (String(err).includes("UNIQUE constraint failed")) {
            return res.status(409).json({ error: err?.message }); // Return 409 if there's a conflict (e.g., device already exists)
        } else {
            await logError("Error adding device", err);
            return res.status(500).json({ error: "Internal Server Error" }); // Return 500 if an error occurs
        }
    }

    res.status(201).json({ message: "Device added successfully" }); // Return a success message

    try {
        await saveLog("Add Device", req.headers['original-ip'] || req.socket.remoteAddress, ip, name);
        await ForwardToServer2(req);
    } catch (err) {
        await logError("Error logging/syncing action", err);
    }
});

/** 🔴 DELETE a device
* @param {express.Request} req - HTTP request (expects `ip` in body).
* @returns {express.Response} res - HTTP response.
*/
router.delete('/delete', async (req, res) => {
    const { ip } = req.body; // Extract the IP address of the device to be deleted from the request body 
    if (ip === undefined) return res.status(400).json({ error: "Missing required fields" }); // Return 400 if required fields are missing
    if (ip && !isValidIPv4(ip)) return res.status(400).json({ error: "Invalid IPv4 address" }); // Return 400 if required fields are missing
    var row; 
    try {
        row = await getDeviceIP(ip); // Get device info before deleting (for logging)
        if (!row) return res.status(404).json({ error: "Device not found" });
        await deleteDevice(ip); // Call the function to delete the device from the database
        res.status(200).json({ message: "Device deleted successfully" }); // Return a success message upon deletion
    } catch (err) {
        await logError("Error deleting device", err)
        res.status(500).json({ error: "Internal Server Error" }); // Return 500 status if an error occurs
    }

    try {
        await saveLog("Delete Device", req.headers['original-ip'] || req.socket.remoteAddress, ip, row.name);
        await ForwardToServer2(req);
    } catch (err) {
        await logError("Error logging/syncing action", err);
    }
});

/** 🟠 EDIT a device
* @param {express.Request} req - HTTP request (expects `id`, `ip` and `name` in body).
* @returns {express.Response} res - HTTP response.
*/
router.put('/edit', async (req, res) => {
    const { id, ip, name } = req.body; // Extract data to edit the device
    if ([id, ip, name].includes(undefined)) return res.status(400).json({ error: "Missing required fields" }); // Return 400 if required fields are missing
    console.log(ip)
    if (ip && !isValidIPv4(ip)) return res.status(400).json({ error: "Invalid IPv4 address" }); // Return 400 if required fields are missing
    if (name.trim() === "") return res.status(400).json({ error: "Name cannot be empty" }); // Return 400 if required fields are missing
    var row;
    try {
        row = await getDeviceID(id); // Get device info before editing (for logging)
        if (!row) return res.status(404).json({ error: "Device not found" });
        await editDevice(id, ip, name); // Call the function to update the device in the database
    } catch (err) {
        if (String(err).includes("UNIQUE constraint failed")) {
            return res.status(409).json({ error: err?.message }); // Return 409 if there's a conflict (e.g., device already exists)
        } else {
            await logError("Error editing device", err);
            return res.status(500).json({ error: "Internal Server Error" }); // Return 500 if an error occurs
        }
    }

    res.status(200).json({ message: "Edited Successfully!" }); // Return success message if the update is successful

    try {
        await saveLog("Edit Device", req.headers['original-ip'] || req.socket.remoteAddress, row.ip, row.name, ip, name);
        await ForwardToServer2(req);
    } catch (err) {
        await logError("Error logging/syncing action", err);
    }
});

/** Returns a list of active clients based on IP address
* @param {express.Request} req - HTTP request.
* @returns {express.Response} res - HTTP response (active clients array as JSON).
*/
router.get('/clients', async (req, res) => {
    res.status(200).json(Array.from(activeClients.entries())); // Return the set of active client IPs as an array
});

/** Whitelist or unwhitelist a client based on the provided IP
* @param {express.Request} req - HTTP request (expects `isWhitelisted`, `clientIp` and `name` in body).
* @returns {express.Response} res - HTTP response.
*/
router.post('/whitelist', async (req, res) => {
    const { isWhitelisted, clientIp, name } = req.body; // Extract whitelisting status and IP address from the request body
    if ([isWhitelisted, clientIp, name].includes(undefined)) return res.status(400).json({ error: "Missing required fields" }); // Return 400 if required fields are missing
    if (clientIp && !isValidIPv4(clientIp)) return res.status(400).json({ error: "Invalid IPv4 address" }); // Return 400 if required fields are missing
    if (name.trim() === "") return res.status(400).json({ error: "Name cannot be empty" }); // Return 400 if required fields are missing

    const state = isWhitelisted ? "Unwhitelist" : "Whitelist";

    try {
        await toggleWhitelist(isWhitelisted, clientIp, name); // Toggle the whitelist status of the client IP
        if (!isWhitelisted) {activeClients.delete(clientIp);}
    } catch (err) {
        if (String(err).includes("UNIQUE constraint failed")){return res.status(409).json({ error: err });} 
        else {
            await logError(`Error ${state}ing user`, err);
            return res.status(500).json({ error: "Internal Server Error" }); // Return 500 status if an error occurs   
        }
    }

    res.status(200).json({ message: `${state}ed Successfully!` }); // Return a success response if the whitelist action is completed

    try {
        await saveLog(`${state}`, req.headers['original-ip'] || req.socket.remoteAddress, clientIp, name);
        await ForwardToServer2(req);
    } catch (err){
        await logError("Error logging/syncing action", err);
    }
});

/** GET /getIP: Returns the client's IP address
* @param {express.Request} req - HTTP request.
* @returns {express.Response} res - HTTP response (the client's IP address).
*/
router.get('/getIP', (req, res) => {
    const ip = req.socket.remoteAddress; // Get the client's IP
    res.json({ ip }); // Return the client's IP address as JSON
});

/** Returns true if given the ip of a host, false otherwise
* @param {express.Request} req - HTTP request (expects `userIP` in body).
* @returns {express.Response} res - HTTP response (true if given the ip of a host, false otherwise).
*/
router.post('/isHost', (req, res) => {
    const { userIP } = req.body;
    if (userIP && !isValidIPv4(userIP)) return res.status(400).json({ error: "Invalid IPv4 address" }); // Return 400 if required fields are missing
    res.json([process.env.HOST, process.env.OTHER_HOST].includes(userIP));
});

/** 🟢 GET all whitelisted users
* @param {express.Request} req - HTTP request.
* @returns {express.Response} res - HTTP response (whitelisted users array as JSON).
*/
router.get('/getWhitelistAll', async (req, res) => {
    try {
        const whitelist = await getWhitelistAll(); // Fetch all whitelisted users from the database
        res.status(200).json(whitelist); // Return the whitelisted users as JSON response
    } catch (error) {
        await logError("Error fetching whitelist", err);
        res.status(500).json({ error: "Internal Server Error" }); // Return a 500 status if an error occurs
    }
});

/** GET all logs (with pagination + search support)
* @param {express.Request} req - HTTP request (expects `page` and `search` in query params).
* @returns {express.Response} res - HTTP response (logs array as JSON).
*/
router.get('/getLogs', async (req, res) => {
    try {
        // Extract query params (default: page=1, search="")
        const page = parseInt(req.query.page) || 1;
        const search = req.query.search || "";

        // Fetch logs from database/service
        const logs = await getLogs(page, search);

        // Send logs back as JSON
        res.status(200).json(logs);
    } catch (error) {
        // Log and return server error if query fails
        await logError("Error fetching devices", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/** Sync database between servers
* @param {express.Request} req - HTTP request (expects `time` and `x-sync-key` in headers and DB octet-stream in body).
* @returns {express.Response} res - HTTP response (success message or DB file as octet-stream depending on which server has the newest data).
*/
router.post('/sync', async (req, res) => {
    // Allow only trusted hosts + check sync secret
    if (![process.env.HOST, process.env.OTHER_HOST].includes(req.socket.remoteAddress) || 
        req.headers['x-sync-key'] !== process.env.SYNC_SECRET)
            return res.status(403).json({ error: 'Forbidden' });

    // Compare incoming timestamp with local logs
    const IncomingTime = Number(req.headers['time']) || 0;
    const logs = await getLogs();
    const localTime = logs[0]?.time || 0;

    if (localTime > IncomingTime) {
        // Local DB is newer → send it to the requester
        try {
            const dbBuffer = fs.readFileSync(dbPath);

            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', dbBuffer.length);
            res.setHeader('time', localTime); // Send back local timestamp
            res.status(202).send(dbBuffer);

        } catch (err) {
            await logError("Error forwarding sync request to other server", err);
            res.status(500).send("Failed to forward request to other server");
        }
    } else {
        // Incoming DB is newer → overwrite local DB
        try {
            await overwriteDatabase(req, res);
        } catch (err) {
            await logError("error overwriting database", err);
        }
        
        res.status(200).send("Synced successfully!");
    }
});

// Export the router to be used in the main app
module.exports = { router };
