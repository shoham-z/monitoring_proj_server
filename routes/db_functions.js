var sqlite = require('sqlite3').verbose();
let db = new sqlite.Database('./switchesDB.db' , (err) => {
    if(err)
    {
        console.log("Error Occurred - " + err.message);
    }
    else
    {
        console.log("DataBase Connected");
    }
});

async function addSwitch(ip, name){
  return new Promise((resolve, reject) => {
    db.run(`INSERT or IGNORE INTO switches (ip, name) VALUES (?, ?)`, [ip, name], function (err) {
      if (err) {
        reject(err);
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
    await deleteSwitch(oldIp);
    await addSwitch(newIp, name);
  } else {
    return new Promise((resolve, reject) => {
      db.run(`UPDATE switches SET name = "${name}" WHERE ip = "${oldIp}"`, function (err) {
        if (err) {
          reject(err);
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

async function getUser(username, password) {
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


module.exports = {
    addSwitch,
    editSwitch,
    deleteSwitch,
    getSwitch,
    getSwitchAll,
    getUser
}