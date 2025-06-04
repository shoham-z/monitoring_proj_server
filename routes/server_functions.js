const path = require('path');
const sqlite = require('sqlite3').verbose();
const argon2 = require('argon2');

let dbPath;
try {
  const { app } = require('electron');
  const isDev = !app || !app.isPackaged;
  dbPath = isDev
    ? path.join(__dirname, '..', 'database.db')
    : path.join(process.resourcesPath, 'database.db');
} catch (e) {
  dbPath = path.join(__dirname, 'database.db');
}

let db = new sqlite.Database(dbPath, (err) => {
  if (err) console.log("Error Occurred - " + err.message);
  else console.log("DataBase Connected");
});

db.run("DELETE FROM sessions", (err) => {
  if (err) console.error("Failed to clear sessions on startup:", err);
  else console.log("All sessions deleted on startup.");
});

const pruneExpired = () => {
  db.run(
    `DELETE FROM sessions WHERE CAST(strftime('%s','now') AS INTEGER) * 1000 > CAST(expired AS INTEGER)`,
    (err) => {
      if (err) console.error('Failed to delete expired sessions:', err);
      else console.log('Expired sessions deleted');
    }
  );
};
pruneExpired();
setInterval(pruneExpired, 1000 * 60 * 5);

// Add new switch
async function addSwitch(ip, name) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO switches (ip, name) VALUES (?, ?)`, [ip, name], function (err) {
      if (err) {
        if (err.message.includes("UNIQUE")) reject({ error: 'IP and name must be unique' });
        else reject(err);
      } else resolve();
    });
  });
}

// Delete switch by IP
async function deleteSwitch(ip) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM switches WHERE ip = ?`, [ip], function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Edit switch by ID
async function editSwitch(id, ip, name) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE switches SET ip = ?, name = ? WHERE id = ?`, [ip, name, id], function (err) {
      if (err) {
        if (err.message.includes("UNIQUE")) reject({ error: 'IP and name must be unique' });
        else reject(err);
      } else resolve();
    });
  });
}

// Get switch by IP
async function getSwitch(ip) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM switches WHERE ip = ?`, [ip], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Get all switches
async function getSwitchAll() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM switches`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Get user by username
async function getUser(username) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Check if IP is whitelisted
async function isWhitelisted(ip) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM whitelist WHERE ip = ?`, [ip], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Toggle whitelist
async function toggleWhitelist(isWhitelist, clientIp, name) {
  return new Promise((resolve, reject) => {
    if (isWhitelist) {
      db.run(`DELETE FROM whitelist WHERE ip = ?`, [clientIp], function (err) {
        if (err) reject(err);
        else resolve();
      });
    } else {
      db.run(`INSERT INTO whitelist (ip, name) VALUES (?, ?)`, [clientIp, name], function (err) {
        if (err) {
          if (err.message.includes("UNIQUE")) reject({ error: 'IP and name must be unique' });
          else reject(err);
        } else resolve();
      });
    }
  });
}

// Get all whitelisted entries
async function getWhitelistAll() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM whitelist`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Get all sessions
async function getSessionAll() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM sessions`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Check if a session exists for a username
function doesSessionExist(rows, username) {
  for (const row of rows) {
    const session = JSON.parse(row.sess);
    if (session.user === username) return true;
  }
  return false;
}

// Secure password hashing
async function hashPassword(password) {
  try {
    const hashedPassword = await argon2.hash(password);
    console.log('Hashed Password:', hashedPassword);
    return hashedPassword;
  } catch (err) {
    console.error('Error hashing password:', err);
  }
}

module.exports = {
  addSwitch,
  editSwitch,
  deleteSwitch,
  getSwitch,
  getSwitchAll,
  getUser,
  isWhitelisted,
  toggleWhitelist,
  getWhitelistAll,
  getSessionAll,
  doesSessionExist,
  hashPassword,
};
