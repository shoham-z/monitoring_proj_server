const path = require('path');
const sqlite = require('sqlite3').verbose();

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

let db = new sqlite.Database(dbPath, (err) => {
  if (err) console.log("Error Occurred - " + err.message);
  else console.log("DataBase Connected");
});

// Add new switch
async function addDevice(ip, name) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO devices (ip, name) VALUES (?, ?)`, [ip, name], function (err) {
      if (err) {
        if (err.message.includes("UNIQUE")) reject({ error: 'IP and name must be unique' });
        else reject(err);
      } else resolve();
    });
  });
}

// Delete device by IP
async function deleteDevice(ip) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM devices WHERE ip = ?`, [ip], function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Edit device by ID
async function editDevice(id, ip, name) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE devices SET ip = ?, name = ? WHERE id = ?`, [ip, name, id], function (err) {
      if (err) {
        if (err.message.includes("UNIQUE")) reject({ error: 'IP and name must be unique' });
        else reject(err);
      } else resolve();
    });
  });
}

// Get devce by IP
async function getDevice(ip) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM devices WHERE ip = ?`, [ip], (err, row) => {
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

async function getLogs(page = 1) {
  const size = 100;
  const offset = (page - 1) * size;

  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM logs ORDER BY time DESC`;
    let params = [];

    if (page !== -1) {
      query += ` LIMIT ? OFFSET ?`;
      params = [size, offset];
    }

    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  addDevice,
  editDevice,
  deleteDevice,
  getDevice,
  getDeviceAll,
  isWhitelisted,
  toggleWhitelist,
  getWhitelistAll,
  saveLog,
  getLogs
};
