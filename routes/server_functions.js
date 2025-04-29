const path = require('path');
let dbPath;
try {
  const { app } = require('electron');
  const isDev = !app || !app.isPackaged;

  dbPath = isDev
    ? path.join(path.join(__dirname, '..', 'switchesDB.db'))
    : path.join(process.resourcesPath, 'switchesDB.db');
} catch (e) {
  // Fallback for non-Electron usage
  dbPath = path.join(__dirname, 'switchesDB.db');
}

var sqlite = require('sqlite3').verbose();
let db = new sqlite.Database(dbPath , (err) => {
    if(err)
    {
        console.log("Error Occurred - " + err.message);
    }
    else
    {
        console.log("DataBase Connected");
    }
});

const argon2 = require('argon2');

async function addSwitch(ip, name){
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO switches (ip, name) VALUES (?, ?)`, [ip, name], function (err) {
      if (err){
        if (err.message.includes("UNIQUE")){reject({error: 'IP and name must be unique'});}
        else {reject(err);}
      } else {
        resolve();
      }
    });
  });
}

async function deleteSwitch(ip){
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM switches WHERE ip = (?)`, [ip], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function editSwitch(oldIp, newIp, name){
  if (oldIp !== newIp){
    const row = await getSwitch(newIp);
    if (row){return {error: 'IP and name must be unique'};}
    await deleteSwitch(oldIp);
    await addSwitch(newIp, name);
  } else {
    return new Promise((resolve, reject) => {
      db.run(`UPDATE switches SET name = "${name}" WHERE ip = "${oldIp}"`, function (err) {
        if (err){
          if (err.message.includes("UNIQUE")){reject({error: 'IP and name must be unique'});}
          else {reject(err);}
        } else {
          resolve();
        }
      });
    });
  }
}

async function getSwitch(ip){
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM switches WHERE ip = "${ip}"`, (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
}

async function getSwitchAll(){
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM switches`, (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
}

async function getUser(username) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE username = "${username}"`, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect('/');
  }
}

async function hashPassword(password) {
  try {
    const hashedPassword = await argon2.hash(password);
    console.log('Hashed Password:', hashedPassword);
    return hashedPassword; // Store this hashed password in your DB
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
    isAuthenticated,
    hashPassword
}