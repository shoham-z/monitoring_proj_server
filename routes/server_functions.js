// Import the required path module to handle file and directory paths
const path = require('path');

// Declare a variable to store the database path
let dbPath;
try {
  // Try importing the 'app' module from Electron to handle paths in an Electron app
  const { app } = require('electron');
  const isDev = !app || !app.isPackaged; // Check if the app is running in development mode

  // Set the database path based on whether the app is in development or production
  dbPath = isDev
    ? path.join(path.join(__dirname, '..', 'database.db')) // In development, use the local path
    : path.join(process.resourcesPath, 'database.db'); // In production, use the resources path (packaged app)
} catch (e) {
  // Fallback for non-Electron usage (e.g., if the code is running outside of Electron)
  dbPath = path.join(__dirname, 'database.db'); // Use a local database file in the current directory
}

// Import the sqlite3 module to work with SQLite databases
var sqlite = require('sqlite3').verbose();

// Create a new SQLite database connection using the computed dbPath
let db = new sqlite.Database(dbPath, (err) => {
    if(err) {
        console.log("Error Occurred - " + err.message); // Log error if the connection fails
    } else {
        console.log("DataBase Connected"); // Log success message if the connection is successful
    }
});

// Import argon2 for secure password hashing and verification
const argon2 = require('argon2');

// Function to add a new switch to the database
async function addSwitch(ip, name, type) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO switches (ip, name, type) VALUES (?, ?, ?)`, [ip, name, type], function (err) {
      if (err) {
        // Handle specific error for unique constraint violation
        if (err.message.includes("UNIQUE")) {
          reject({error: 'IP and name must be unique'}); // Reject if IP or name is not unique
        } else {
          reject(err); // Reject with other error
        }
      } else {
        resolve(); // Resolve when insertion is successful
      }
    });
  });
}

// Function to delete a switch from the database by its IP address
async function deleteSwitch(ip) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM switches WHERE ip = (?)`, [ip], function (err) {
      if (err) {
        reject(err); // Reject with error if deletion fails
      } else {
        resolve(); // Resolve when deletion is successful
      }
    });
  });
}

// Function to edit an existing switch in the database by its ID
async function editSwitch(id, ip, name, type) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE switches SET name = "${name}", ip = "${ip}", type = "${type}" WHERE id = ${id}`, function (err) {
      if (err) {
        // Handle specific error for unique constraint violation
        if (err.message.includes("UNIQUE")) {
          reject({error: 'IP and name must be unique'}); // Reject if IP or name is not unique
        } else {
          reject(err); // Reject with other error
        }
      } else {
        resolve(); // Resolve when update is successful
      }
    });
  });
}

// Function to get a switch by its IP address
async function getSwitch(ip) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM switches WHERE ip = "${ip}"`, (err, row) => {
          if (err) {
            reject(err); // Reject with error if fetching the switch fails
          } else {
            resolve(row); // Resolve with the switch data if successful
          }
        });
      });
}

// Function to get all switches from the database
async function getSwitchAll() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM switches`, (err, row) => {
          if (err) {
            reject(err); // Reject with error if fetching switches fails
          } else {
            resolve(row); // Resolve with all switches if successful
          }
        });
      });
}

// Function to get a user from the database by username
async function getUser(username) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE username = "${username}"`, (err, row) => {
      if (err) {
        reject(err); // Reject with error if fetching user fails
      } else {
        resolve(row); // Resolve with user data if successful
      }
    });
  });
}

// Middleware to check if the user is authenticated (logged in)
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next(); // Allow access if the user is authenticated
  }

  // If it's an API request, return 401 Unauthorized instead of redirecting
  if (req.originalUrl.startsWith('/api')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Redirect to the login page if the user is not authenticated
  res.redirect('/');
}

// Function to check if an IP address is blocked
async function isBlocked(ip) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM blocked WHERE ip = "${ip}"`, (err, row) => {
      if (err) {
        reject(err); // Reject with error if checking block status fails
      } else {
        resolve(row); // Resolve with the block status if successful
      }
    });
  });
}

// Function to toggle the block status of a client IP
async function toggleBlock(isBlocked, clientIp) {
  if (isBlocked) {
    // If the client is being unblocked, delete from blocked table
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM blocked WHERE ip = (?)`, [clientIp], function (err) {
        if (err) {
          reject(err); // Reject if deletion fails
        } else {
          resolve(); // Resolve when unblocking is successful
        }
      });
    });
  } else {
    // If the client is being blocked, insert into blocked table
    return new Promise((resolve, reject) => {
      db.run(`INSERT INTO blocked (ip) VALUES (?)`, [clientIp], function (err) {
        if (err) {
          reject(err); // Reject if insertion fails
        } else {
          resolve(); // Resolve when blocking is successful
        }
      });
    });
  }
}

// Function to hash a password using argon2
async function hashPassword(password) {
  try {
    const hashedPassword = await argon2.hash(password); // Hash the password using argon2
    console.log('Hashed Password:', hashedPassword); // Log the hashed password (for debugging)
    return hashedPassword; // Return the hashed password (store it in the database)
  } catch (err) {
    console.error('Error hashing password:', err); // Log any error that occurs while hashing the password
  }
}

// Export all functions to be used elsewhere in the application
module.exports = {
    addSwitch,
    editSwitch,
    deleteSwitch,
    getSwitch,
    getSwitchAll,
    getUser,
    isAuthenticated,
    isBlocked,
    toggleBlock,
    hashPassword
}