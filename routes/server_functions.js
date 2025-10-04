const path = require('path'); // Path module to manage file paths
const sqlite = require('sqlite3').verbose(); // SQLite3 module for interacting with SQLite databases (verbose mode for detailed errors)
const fs = require('fs'); // File system module (read/write files)

let dbPath;
try {
  const { app } = require('electron'); // Import Electron's app module to check app environment
  const isDev = !app || !app.isPackaged; // Determine if the app is in development mode (not packaged)

  // Set database path depending on environment
  dbPath = isDev
    ? path.join(__dirname, '../resources', 'database.db') // In dev: database is in ../resources relative to current file
    : path.join(process.resourcesPath, 'database.db');    // In production: database is in the app's resources folder
} catch (e) {
  // Fallback in case Electron app module is not available
  dbPath = path.join(__dirname, 'database.db'); // Use current directory as database path
}

// Open the SQLite database
let db = new sqlite.Database(dbPath, (err) => {
  if (err) console.log("Error Occurred - " + err.message); // Log error if database cannot be opened
  else console.log("DataBase Connected"); // Log success message when database is connected
});

db.exec(`
  -- Create "devices" table if it doesn't exist
  CREATE TABLE IF NOT EXISTS "devices" (
    "id"    INTEGER NOT NULL UNIQUE,   -- Unique numeric ID for each device
    "ip"    TEXT NOT NULL UNIQUE,      -- Device IP address (must be unique)
    "name"  TEXT NOT NULL UNIQUE,      -- Device name (must be unique)
    PRIMARY KEY("id" AUTOINCREMENT)    -- "id" is the primary key and auto-increments
  );

  -- Create "logs" table if it doesn't exist
  CREATE TABLE IF NOT EXISTS "logs" (
    "id"        INTEGER NOT NULL UNIQUE,  -- Unique numeric ID for each log entry
    "type"      TEXT NOT NULL,            -- Type of log (e.g., "add", "edit", "delete")
    "time"      INTEGER NOT NULL,         -- Timestamp of the log (epoch time)
    "clientIP"  TEXT NOT NULL,            -- IP of the client that performed the action
    "ip"        TEXT NOT NULL,            -- IP of the device affected
    "name"      TEXT NOT NULL,            -- Name of the device affected
    "newName"   TEXT,                     -- New name if device was renamed (optional)
    "newIP"     INTEGER,                  -- New IP if device IP changed (optional)
    PRIMARY KEY("id" AUTOINCREMENT)       -- "id" is primary key and auto-increments
  );

  -- Create "whitelist" table if it doesn't exist
  CREATE TABLE IF NOT EXISTS "whitelist" (
    "ip"    TEXT NOT NULL UNIQUE,         -- Whitelisted IP address (must be unique)
    "name"  TEXT NOT NULL UNIQUE,         -- Name associated with the IP (must be unique)
    PRIMARY KEY("ip")                     -- Use IP as the primary key
  );
`);

/**
 * Add new device
 * @param {string} ip - IP address of the new device
 * @param {string} name - Name of the new device
 * @returns {Promise<void>} Resolves on success, rejects with error on failure
 */
async function addDevice(ip, name) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO devices (ip, name) VALUES (?, ?)`, [ip, name], function (err) {
      if (err) reject(err); // Handle errors
      else resolve(); // Successfully updated device
    });
  });
}

/**
 * Delete device by IP
 * @param {String} ip - IP address of the device to be deleted
 * @returns {Promise<void>} Resolves on success, rejects with error on failure
 */
async function deleteDevice(ip) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM devices WHERE ip = ?`, [ip], function (err) {
      if (err) reject(err); // Error during deletion
      else resolve(); // Successfully deleted device
    });
  });
}

/**
 * Edit device by IP
 * @param {String} id - ID of the device (Primary Key)
 * @param {String} ip - IP address of the device to be edited
 * @param {String} name Name of the device to be edited
 * @returns {Promise<void>} Resolves on success, rejects with error on failure
 */
async function editDevice(id, ip, name) {
  return new Promise((resolve, reject) => {
    const updates = []; // Array to store columns to update
    const values = []; // Array to store corresponding values

    // Only include the fields that are not empty strings
    if (ip.trim() !== "") {
      updates.push("ip = ?"); // Add IP column to update
      values.push(ip); // Add new IP value
    }
    if (name.trim() !== "") {
      updates.push("name = ?"); // Add name column to update
      values.push(name); // Add new name value
    }

    // If no fields are provided, nothing to update; resolve immediately
    if (updates.length === 0) return resolve();

    // Add the device ID for the WHERE clause
    values.push(id);

    // Construct the UPDATE query dynamically based on fields to update
    const query = `UPDATE devices SET ${updates.join(", ")} WHERE id = ?`;

    // Run the query
    db.run(query, values, function (err) {
      if (err) {
      if (err) reject(err); // Handle errors
      else resolve(); // Successfully updated device
      } else resolve(); // Successfully updated device
    });
  });
}

/**
 * Get device by IP
 * @param {String} ip - IP address of the device
 * @returns {Promise<Object|undefined>} Resolves with the device row (or undefined if not found)
 */
async function getDeviceIP(ip) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM devices WHERE ip = ?`, [ip], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

/**
 * Get device by ID
 * @param {String} id - ID of the device
 * @returns {Promise<Object|undefined>} Resolves with the device row (or undefined if not found)
 */
async function getDeviceID(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM devices WHERE id = ?`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

/**
 * Get all devices
 * @returns {Promise<Array<Object>>} Resolves with an array of device rows (empty array if none found)
 */
async function getDeviceAll() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM devices`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * Check if IP is whitelisted
 * @param {String} ip - IP address of the client 
 * @returns {Promise<Boolean>} Resolves with true if the client is whitelisted, false otherwise
 */
async function isWhitelisted(ip) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM whitelist WHERE ip = ?`, [ip], (err, row) => {
      if (err) reject(err);
      else resolve(Boolean(row));
    });
  });
}

/**
 * Add or remove a client from the "whitelist" table
 * @param {Boolean} isWhitelist - Current whitelist status of the client (true if already whitelisted)
 * @param {String} clientIp - The IP address of the client
 * @param {String} name - The name of the client
 * @returns {Promise<void>} Resolves on success, rejects with error on failure
 */
async function toggleWhitelist(isWhitelist, clientIp, name) {
  return new Promise((resolve, reject) => {
    if (isWhitelist) {
      // If currently whitelisted, remove the client from the whitelist
      db.run(`DELETE FROM whitelist WHERE ip = ?`, [clientIp], function (err) {
        if (err) reject(err); // Reject promise if deletion fails
        else resolve(); // Successfully removed from whitelist
      });
    } else {
      // If not whitelisted, add the client to the whitelist
      db.run(`INSERT INTO whitelist (ip, name) VALUES (?, ?)`, [clientIp, name], function (err) {
        if (err) {
          // Handle UNIQUE constraint errors (duplicate IP or name)
          if (err.message.includes("UNIQUE")) reject(err.message);
          else reject(err); // Handle other errors
        } else resolve(); // Successfully added to whitelist
      });
    }
  });
}

/**
 * Get all whitelisted clients
 * @returns {Promise<Array<Object>>} Resolves with an array of whitelist entries (empty array if none found)
 */
async function getWhitelistAll() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM whitelist`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * Save a new log entry
 * @param {String} type - The type of action or event
 * @param {String} clientIP - The IP address of the client who performed the action
 * @param {String} ip - The IP address affected by the action
 * @param {String} name - The name associated with the affected IP
 * @param {String|null} newIP - The new IP after the action (if applicable)
 * @param {String|null} newName - The new name after the action (if applicable)
 * @returns {Promise<void>} Resolves on success, rejects with error on failure
 */
async function saveLog(type, clientIP, ip, name, newIP, newName){
  return new Promise((resolve, reject) => {
  db.run(`INSERT INTO logs (type, time, clientIP, ip, name, newIP, newName) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [type, Date.now(), clientIP, ip, name, newIP, newName],
    function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Retrieve logs from the "logs" table, with optional pagination and search
 * @param {number} [page=1] - Page number for pagination (use -1 to disable pagination)
 * @param {string} [search=""] - Optional search term to filter logs by type, time, IPs, or names
 * @returns {Promise<Array<Object>>} Resolves with an array of log entries (empty array if none found)
 */
async function getLogs(page = 1, search = "") {
  return new Promise((resolve, reject) => {
    // Base query: select all columns and format the timestamp
    let query = `
      SELECT *,
        strftime('%d/%m/%Y %H:%M:%S', time/1000, 'unixepoch', 'localtime') AS formattedTime
      FROM logs
    `;
    const params = []; // Parameters for the SQL query

    // If a search term is provided, filter results
    if (search) {
      query += ` WHERE 
        type LIKE ? OR
        formattedTime LIKE ? OR
        clientIP LIKE ? OR
        ip LIKE ? OR
        name LIKE ? OR
        newIP LIKE ? OR
        newName LIKE ?`;
      
      const searchPattern = `%${search}%`; // Use wildcards for partial matches
      params.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    }

    // Order logs by time in descending order (most recent first)
    query += ` ORDER BY time DESC`;

    // Handle pagination if page is not -1
    if (page !== -1) {
      const size = 100;                      // Number of logs per page
      const offset = (page - 1) * size;      // Calculate offset based on page
      query += ` LIMIT ? OFFSET ?`;          // Add LIMIT and OFFSET to query
      params.push(size, offset);             // Add pagination values to parameters
    }

    // Execute the query and return the results
    db.all(query, params, (err, rows) => {
      if (err) reject(err);  // Reject promise if an error occurs
      else resolve(rows);    // Resolve with the retrieved rows
    });
  });
}

/**
 * Forward incoming requests to another server if certain conditions are met.
 * 
 * Conditions:
 * - The request has not already been forwarded (no 'forwarded' header).
 * - The request originates from an allowed host (process.env.HOST or process.env.OTHER_HOST).
 * 
 * @param {express.Request} req - HTTP request to be forwarded to the other server.
 * @returns {Promise<void>} Resolves on success, rejects with error on failure
 */
async function ForwardToServer2(req) {
  // Check if request has not already been forwarded
  // and if the request originates from one of the allowed hosts
  if (
    !req.headers['forwarded'] &&
    [process.env.HOST, process.env.OTHER_HOST].includes(req.socket.remoteAddress)
  ) {
    try {
      // Forward the request to the other server
      await fetch(`${process.env.PROTOCOL.toLowerCase()}://${process.env.OTHER_HOST}:${process.env.PORT}/api${req.path}`, {
        method: req.method, // Use the same HTTP method as the original request
        headers: {
          'Content-Type': 'application/json',
          'forwarded': 'true',          // Mark the request as forwarded to avoid loops
          'original-ip': req.socket.remoteAddress // Pass the original client's IP
        },
        body: JSON.stringify(req.body)   // Forward the request body as JSON
      });
    } catch (err) {
      // Log any errors that occur while forwarding
      console.error("Failed to forward request to other server: ", req.path);
    }
  }
  return;
}

/**
 * Overwrite the current database file with data from an incoming HTTP request.
 * Pipes the request body directly into the database file.
 * 
 * Handles client aborts and file write errors, sending appropriate HTTP responses.
 * 
 * @param {express.Request} req - The incoming HTTP request
 * @param {Express.Response} res - The HTTP response object
 * @returns {Promise<void>} Resolves when the database has been successfully overwritten, rejects on error or if the client aborts
 */
async function overwriteDatabase(req, res) {
  return new Promise((resolve, reject) => {
    // Create a writable stream to save the incoming database file
    const writeStream = fs.createWriteStream(dbPath);

    // Pipe the request data directly into the file
    req.pipe(writeStream);

    // Handle case where client aborts the request
    req.on('aborted', () => {
      console.warn("Client aborted the request.");
      writeStream.destroy(); // Stop writing to file
      if (!res.headersSent) res.status(400).send('Request aborted'); // Send HTTP response if possible
      reject(new Error('Request aborted')); // Reject the promise
    });

    // Handle successful completion of writing the file
    writeStream.on('finish', () => {
      console.log("Database saved to:", dbPath);
      res.status(200).send('Database file received successfully.'); // Respond to client
      resolve(); // Resolve the promise
    });

    // Handle errors during file writing
    writeStream.on('error', err => {
      console.error("Error saving DB:", err);
      res.status(500).send('Failed to save database.'); // Respond with error
      reject(err); // Reject the promise
    });
  });
}

module.exports = {
  addDevice,
  editDevice,
  deleteDevice,
  getDeviceIP,
  getDeviceID,
  getDeviceAll,
  isWhitelisted,
  toggleWhitelist,
  getWhitelistAll,
  saveLog,
  getLogs,
  ForwardToServer2,
  overwriteDatabase
};
