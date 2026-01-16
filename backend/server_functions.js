const path = require('path'); // Path module to manage file paths
const sqlite = require('sqlite3').verbose(); // SQLite3 module for interacting with SQLite databases (verbose mode for detailed errors)
const fs = require('fs/promises'); // File system module (read/write files)
const cron = require('node-cron'); //Scheduales weekly backups 

const { app } = require('electron'); // Import Electron's app module to check app environment
const isDev = !app.isPackaged; // Determine if the app is in development mode (not packaged)

// Set database path depending on environment
const dbPath = isDev
  ? path.join(__dirname, '../resources', 'database.db') // In dev: database is in ../resources relative to current file
  : path.join(process.resourcesPath, 'database.db');    // In production: database is in the app's resources folder
const errorFolder = isDev
  ? path.join(__dirname, '../resources', 'error_logs') // In dev: database is in ../resources relative to current file
  : path.join(process.resourcesPath, 'error_logs');    // In production: database is in the app's resources folder
const syncStatusPath = isDev
  ? path.join(__dirname, '../resources', 'sync_status.log') // In dev: database is in ../resources relative to current file
  : path.join(process.resourcesPath, 'sync_status.log');    // In production: database is in the app's resources folder

// Open the SQLite database
let db = new sqlite.Database(dbPath, (err) => {
  if (err) console.error("Error Occurred: ", err); // Log error if database cannot be opened
  else console.log("DataBase Connected"); // Log success message when database is connected
});

(async () => {await fs.appendFile(syncStatusPath, "", "utf8");})()

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
      err ? reject(err) : resolve()
    });
  });
}

/**
 * Delete device by IP
 * @param {string} ip - IP address of the device to be deleted
 * @returns {Promise<void>} Resolves on success, rejects with error on failure
 */
async function deleteDevice(ip) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM devices WHERE ip = ?`, [ip], function (err) {
      err ? reject(err) : resolve()
    });
  });
}

/**
 * Edit device by IP
 * @param {string} id - ID of the device (Primary Key)
 * @param {string} ip - IP address of the device to be edited
 * @param {string} name Name of the device to be edited
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
      err ? reject(err) : resolve()
    });
  });
}

/**
 * Get device by IP
 * @param {string} ip - IP address of the device
 * @returns {Promise<Object|undefined>} Resolves with the device row (or undefined if not found)
 */
async function getDeviceIP(ip) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM devices WHERE ip = ?`, [ip], (err, row) => {
      err ? reject(err) : resolve(row)
    });
  });
}

/**
 * Get device by ID
 * @param {string} id - ID of the device
 * @returns {Promise<Object|undefined>} Resolves with the device row (or undefined if not found)
 */
async function getDeviceID(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM devices WHERE id = ?`, [id], (err, row) => {
      err ? reject(err) : resolve(row)
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
      err ? reject(err) : resolve(rows)
    });
  });
}

/**
 * Check if IP is whitelisted
 * @param {string} ip - IP address of the client 
 * @returns {Promise<boolean>} Resolves with true if the client is whitelisted, false otherwise
 */
async function isWhitelisted(ip) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM whitelist WHERE ip = ?`, [ip], (err, row) => {
      err ? reject(err) : resolve(Boolean(row))
    });
  });
}

/**
 * Add or remove a client from the "whitelist" table
 * @param {boolean} isWhitelist - Current whitelist status of the client (true if already whitelisted)
 * @param {string} clientIp - The IP address of the client
 * @param {string} name - The name of the client
 * @returns {Promise<void>} Resolves on success, rejects with error on failure
 */
async function toggleWhitelist(isWhitelist, clientIp, name) {
  const query = isWhitelist
    ? `DELETE FROM whitelist WHERE ip = ?`
    : `INSERT INTO whitelist (ip, name) VALUES (?, ?)`;
  const params = isWhitelist ? [clientIp] : [clientIp, name];

  return new Promise((resolve, reject) =>
    db.run(query, params, err => (err ? reject(err) : resolve()))
  );
}

/**
 * Get all whitelisted clients
 * @returns {Promise<Array<Object>>} Resolves with an array of whitelist entries (empty array if none found)
 */
async function getWhitelistAll() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM whitelist`, (err, rows) => {
      err ? reject(err) : resolve(rows);
    });
  });
}

/**
 * Save a new log entry
 * @param {string} type - The type of action or event
 * @param {string} clientIP - The IP address of the client who performed the action
 * @param {string} ip - The IP address affected by the action
 * @param {string} name - The name associated with the affected IP
 * @param {String|null} newIP - The new IP after the action (if applicable)
 * @param {String|null} newName - The new name after the action (if applicable)
 * @returns {Promise<void>} Resolves on success, rejects with error on failure
 */
async function saveLog(type, clientIP, ip, name, newIP, newName){
  return new Promise((resolve, reject) => {
  db.run(`INSERT INTO logs (type, time, clientIP, ip, name, newIP, newName) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [type, Date.now(), clientIP, ip, name, newIP, newName],
    function (err) {
      err ? reject(err) : resolve()
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
      err ? reject(err) : resolve(rows)
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
      await logSyncStatus(`Success`, req.path, JSON.stringify(req.body), `${process.env.PROTOCOL.toLowerCase()}://${process.env.OTHER_HOST}:${process.env.PORT}`);
    } catch (err) {
      await logSyncStatus(err.stack || err.toString(), req.path, JSON.stringify(req.body), `${process.env.PROTOCOL.toLowerCase()}://${process.env.OTHER_HOST}:${process.env.PORT}`);
    }
  }
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
  return new Promise(async (resolve, reject) => {
    // Create a writable stream to save the incoming database file
    const writeStream = await fs.createWriteStream(dbPath);

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
    writeStream.on('finish', async () => {
      console.log("Database saved to:", dbPath);
      res.status(200).send('Database file received successfully.'); // Response
      resolve(); // Resolve the promise
    });

    // Handle errors during file writing
    writeStream.on('error', async err => {
      console.error("Error saving DB:", err);
      res.status(500).send('Failed to save database.'); // Respond with error
      reject(err); // Reject the promise
    });
  });
}

/**
 * Logs any error message or object to a file in the "errors" directory.
 * Creates the directory and file if they don't exist.
 * @param {string} context - Short label describing where the error occurred (e.g. "Add Device", "Save Log").
 * @param {Error|string} error - The error object or message to log.
 */
async function logError(context, error) {

  if (error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT") return;
  console.error(error);

  try {
    // Ensure directory exists
    await fs.mkdir(errorFolder, { recursive: true, mode: 0o777 }); 

    // Unique log filename per error (timestamp + random suffix)
    const now = new Date().toLocaleString("en-IL", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    // Format for file name
    const fileTimestamp = now.trim()
      .replace(/\//g, "-")
      .replace(",", "")
      .replace(/ /g, "__")
      .replace(/:/g, ".");

    const logFile = path.join(errorFolder,`${fileTimestamp}__error-${Math.random().toString(36).slice(2, 8)}.log`);

    // 🔥 Format error to include stack + cause if present
    let fullError = error.stack || String(error);
    if (error.cause) {
      fullError += `\nCaused by: ${error.cause.stack || error.cause}`;
    }

    const message = `[${now}] [${context}] ${fullError}\n`;

    await fs.writeFile(logFile, message, "utf8");
  } catch (err) {
    // If logging itself fails, output to console
    console.error("Failed to log error:", err);
  }
}

/**
 * Append a timestamped sync status message to a log file.
 * 
 * Format: [DD-MM-YYYY HH:MM:SS] message
 *
 * @param {string} err - Error to log
 * @param {string} action - Action synced
 * @param {string} body - The body of the attempted request
 * @param {string} ip - The IPv4 address of the other server
 */
async function logSyncStatus(err, action, body, ip) {
  try {

    const now = new Date();

    const israel = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })
    );

    const years = String(israel.getFullYear()).padStart(4, "0");
    const months = String(israel.getMonth() + 1).padStart(2, "0");
    const days = String(israel.getDate()).padStart(2, "0");
    const hours = String(israel.getHours()).padStart(2, "0");
    const minutes = String(israel.getMinutes()).padStart(2, "0");
    const seconds = String(israel.getSeconds()).padStart(2, "0");

    let message;
    let state = err === "Success" ? "Successfully synced" : "Failed to sync";

    if (action === "start") {
      message = `${state} at startup:`;
    } else {
      message = `${state} ${action} action:\n   Body: ${body}`;
    }

    message += `\n   Other server IP address: ${ip}`

    if (JSON.stringify(err)?.includes("fetch failed")) {
      message += "\n   Reason: Couldn't reach other server";
    } else {
      message += `\n   Reason: ${err.stack || err.toString()}`;
    }

    const logLine = `[${days}-${months}-${years} ${hours}:${minutes}:${seconds}] ${message}`;

    let cleaned = "";
    let prefix = "";
    try {
      const existing = await fs.readFile(syncStatusPath, "utf8");

      const lines = existing.split("\n").filter(line => line.trim().length > 0); // remove empty lines
      cleaned = lines.join("\n");

      // Add a newline at the start if the last line in the file is not empty
      if (lines.length > 0) {
        prefix = "\n";
      }

    } catch (err) {
      // file doesn't exist → cleaned stays ""
    }

    // --- Write cleaned log + new line ---
    await fs.writeFile(syncStatusPath, cleaned + prefix + logLine, "utf8");

  } catch (err) {
    await logError("Failed to write sync log:", err);
  }
}


/**
 * Function to validate if an input is a valid IPv4 address
 * @param {string} ip An IPv4 address
 * @returns {boolean} True if given a valid IPv4 address
 */
function isValidIPv4(ip) {
  const validFormat = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(ip);
  if (!validFormat) return false;

  // Reject 0.0.0.0 and 255.255.255.255
  if (ip === "0.0.0.0" || ip === "255.255.255.255") return false;

  return true;
}

async function backupDatabase() {
  console.log('⏰ Starting weekly database backup at 6:00 AM local time...');

  const uniqueBackupFilename = `db_${new Date().toLocaleString('en-GB', { 
      hour12: false, 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit', 
      timeZone: 'Asia/Jerusalem' 
  }).replace(/\//g, '-').replace(/, /g, '_').replace(/:/g, '-')}.db`;

  const backupDir = isDev
  ? path.join(__dirname, '../resources', 'backups') // In dev: database is in ../resources relative to current file
  : path.join(process.resourcesPath, 'backups');    // In production: database is in the app's resources folder
  const destinationPath = path.join(backupDir, uniqueBackupFilename);
    
  // Ensure the 'backups' directory exists
try {
    // 1. Ensure the 'backups' directory exists (using async fs.mkdir)
    //    The recursive: true and mode: 0777 are standard, no need to check 'existsSync' first
    await fs.mkdir(backupDir, { recursive: true, mode: 0o777 }); 

    // 2. Safely copy the file using the Promise-based API
    await fs.copyFile(dbPath, destinationPath); // 👈 Await the copy operation
    
    console.log(`✅ Database was backed up successfully`);
    
  } catch (error) {
    console.error('❌ Database backup failed:', error.message);
    // You can re-throw the error to notify the caller (node-cron) if necessary
    throw error; 
  }
}

/**
 * Inserts rows from a JSON file into the specified table (excluding 'id').
 * @param {string} tableName - The table to insert into: 'whitelist', 'switches', or 'logs'.
 * @param {string} filePath - Absolute path to the JSON file to import.
 */
async function insertTable(tableName, rows) {
  return new Promise((resolve, reject) => {
    if (!rows || rows.length === 0) return resolve();

    let columns;
    switch (tableName) {
      case 'whitelist':
        columns = ['ip', 'name'];
        break;
      case 'switches':
        columns = ['ip', 'name'];
        break;
      case 'logs':
        columns = ['type', 'time', 'clientIP', 'ip', 'name', 'newIP', 'newName'];
        break;
      default:
        return reject(new Error(`Unknown table: ${tableName}`));
    }

    const placeholders = columns.map(() => '?').join(',');
    const sql = `INSERT OR IGNORE INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      const stmt = db.prepare(sql);

      for (const row of rows) {
        const values = columns.map(col => (col in row ? row[col] : null));
        stmt.run(values);
      }

      stmt.finalize(err => {
        if (err) {
          db.run('ROLLBACK');
          return reject(err);
        }
        db.run('COMMIT', commitErr => {
          if (commitErr) reject(commitErr);
          else resolve();
        });
      });
    });
  });
}

cron.schedule('0 6 * * 0', () => {
  backupDatabase();
}, {
  scheduled: true,
  // Ensure this matches the timezone where you want the 6:00 AM to occur
  timezone: "Asia/Jerusalem" 
});

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
  overwriteDatabase,
  logError,
  isValidIPv4,
  logSyncStatus,
  insertTable
};
