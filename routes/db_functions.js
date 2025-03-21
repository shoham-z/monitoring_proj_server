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

function addSwitch(ip, name, reachable){
    db.run(`INSERT or IGNORE INTO switches (ip, name, lastActive, reachable) VALUES (?, ?, ?, ?)`, [ip, name, Date.now(), reachable]);
}

async function editSwitch(ip, name){
    const row = await getSwitch(ip);
    await db.run(`DELETE FROM switches WHERE ip = (?)`, [ip]);
    await db.run(`INSERT or IGNORE INTO switches (ip, name, lastActive, reachable) VALUES (?, ?, ?, ?)`, [ip, name, row.lastActive, row.reachable]);
}

function deleteSwitch(ip){
    db.run(`DELETE FROM switches WHERE ip = (?)`, ip);
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

module.exports = {
    addSwitch,
    editSwitch,
    deleteSwitch,
    getSwitch,
    getSwitchAll
}