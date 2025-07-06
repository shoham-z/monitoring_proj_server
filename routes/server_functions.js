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

module.exports = {
  addSwitch,
  editSwitch,
  deleteSwitch,
  getSwitch,
  getSwitchAll,
  isWhitelisted,
  toggleWhitelist,
  getWhitelistAll,
  saveLog,
  getLogs,
  insertTable
};
