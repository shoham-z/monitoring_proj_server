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

// Add new device
async function addDevice(ip, name) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO devices (ip, name) VALUES (?, ?)`, [ip, name], function (err) {
      if (err) {
        // Handle UNIQUE constraint errors (duplicate IP or name)
        if (err.message.includes("UNIQUE")) reject({ error: 'IP and name must be unique' });
        else reject(err); // Handle other errors
      } else resolve(); // Successfully updated device
    });
  });
}

// Delete device by IP
async function deleteDevice(ip) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM devices WHERE ip = ?`, [ip], function (err) {
      if (err) reject(err); // Error during deletion
      else resolve(); // Successfully deleted device
    });
  });
}

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
        // Handle UNIQUE constraint errors (duplicate IP or name)
        if (err.message.includes("UNIQUE")) reject({ error: 'IP and name must be unique' });
        else reject(err); // Handle other errors
      } else resolve(); // Successfully updated device
    });
  });
}


// Get device by IP
async function getDeviceIP(ip) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM devices WHERE ip = ?`, [ip], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Get device by ID
async function getDeviceID(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM devices WHERE id = ?`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Get all devices
async function getDeviceAll() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM devices`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Check if IP is whitelisted
async function isWhitelisted(ip) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM whitelist WHERE ip = ?`, [ip], (err, row) => {
      if (err) reject(err);
      else resolve(Boolean(row));
    });
  });
}

// Add or remove a client from the "whitelist" table
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
          if (err.message.includes("UNIQUE")) reject({ error: 'IP and name must be unique' });
          else reject(err); // Handle other errors
        } else resolve(); // Successfully added to whitelist
      });
    }
  });
}

// Get all whitelisted IP addresses
async function getWhitelistAll() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM whitelist`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Save a new log entry
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

// Retrieve logs from the "logs" table, with optional pagination and search
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

// Forward incoming requests to another server if conditions are met
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

  // Return nothing; function only forwards requests if needed
  return;
}

// Overwrite the current database file with the incoming data from a request
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
