const path = require('path');
const sqlite = require('sqlite3').verbose();
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

let db = new sqlite.Database(dbPath, (err) => {
  if (err) console.log("Error Occurred - " + err.message);
  else console.log("DataBase Connected");
});

db.exec(`
  CREATE TABLE IF NOT EXISTS "devices" (
	"id"	INTEGER NOT NULL UNIQUE,
	"ip"	TEXT NOT NULL UNIQUE,
	"name"	TEXT NOT NULL UNIQUE,
	PRIMARY KEY("id" AUTOINCREMENT)
  );

  CREATE TABLE IF NOT EXISTS "logs" (
	"id"	INTEGER NOT NULL UNIQUE,
	"type"	TEXT NOT NULL,
	"time"	INTEGER NOT NULL,
	"clientIP"	TEXT NOT NULL,
	"ip"	TEXT NOT NULL,
	"name"	TEXT NOT NULL,
	"newName"	TEXT,
	"newIP"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT)
  );

  CREATE TABLE IF NOT EXISTS "whitelist" (
	"ip"	TEXT NOT NULL UNIQUE,
	"name"	TEXT NOT NULL UNIQUE,
	PRIMARY KEY("ip")
  );
  `);

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

  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM logs ORDER BY time DESC`;
    let params = [];

    if (page !== -1) {
      const size = 100;
      const offset = (page - 1) * size;

      query += ` LIMIT ? OFFSET ?`;
      params = [size, offset];
    }

    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function ForwardToServer2(req){
  if (!req.headers['forwarded'] && [process.env.HOST, process.env.OTHER_HOST].includes(req.socket.remoteAddress)){
    try {
      // Forward the request to the other server
      await fetch(`http://${process.env.OTHER_HOST}:${process.env.PORT}/api${req.path}`, {
        method: req.method,
        headers: { 'Content-Type': 'application/json', 'forwarded': 'true', 'original-ip': req.socket.remoteAddress },
        body: JSON.stringify(req.body)
    });
    } catch (err) {
      console.error("Failed to forward request to other server: ", req.path);
    }
  }
  return;
}

async function overwriteDatabase(req, res) {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(dbPath);
    req.pipe(writeStream);

    req.on('aborted', () => {
      console.warn("Client aborted the request.");
      writeStream.destroy();
      if (!res.headersSent) res.status(400).send('Request aborted');
      reject(new Error('Request aborted'));
    });

    writeStream.on('finish', () => {
      console.log("Database saved to:", dbPath);
      res.status(200).send('Database file received successfully.');
      resolve();
    });

    writeStream.on('error', err => {
      console.error("Error saving DB:", err);
      res.status(500).send('Failed to save database.');
      reject(err);
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
  getLogs,
  ForwardToServer2,
  overwriteDatabase
};
