const express = require('express');
const router = express.Router();
const { addSwitch, editSwitch, deleteSwitch, getSwitch, getSwitchAll, getUser } = require('./server_functions'); // Import functions

// 🟢 GET all switches
router.get('/getAll', async (req, res) => {
    try {
        const switches = await getSwitchAll();
        res.json(switches);
    } catch (error) {
        console.error("Error fetching switches:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🔵 GET a single switch by IP
router.get('/get', async (req, res) => {
    try {
        const switchData = await getSwitch(req.params.ip);
        if (!switchData) {
            return res.status(404).json({ error: "Switch not found" });
        }
        res.json(switchData);
    } catch (error) {
        console.error("Error fetching switch:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🟡 ADD a switch (POST)
router.post('/add', async (req, res) => {
    const { ip, name } = req.body;
    if (!ip || !name === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    
    try {
        addSwitch(ip, name);
        res.json({ message: "Switch added successfully" });
    } catch (error) {
        console.error("Error adding switch:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🔴 DELETE a switch
router.delete('/delete', async (req, res) => {
    try {
        const { ip } = req.body;
        console.log(ip)
        await deleteSwitch(ip);
        res.json({ message: "Switch deleted successfully" });
    } catch (error) {
        console.error("Error deleting switch:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🟠 EDIT a switch (PUT)
router.put('/edit', async (req, res) => {
    const { ip, name, oldIp } = req.body;
    console.log(`Received IP: ${ip}, Name: ${name} oldIP: ${oldIp}`);
    editSwitch(oldIp, ip, name);
  
    // You can handle the data (e.g., save it to the database, etc.)
  
    // Send a response back to the client
    res.json({message: `Edited Successfully!`});
});

//Responds if the server is online
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(username + " " + password)
    console.log("ssssssssssssssssssssssssss")
    try {
        const userData = await getUser(username, password);
        if (!userData) {
            return res.json(null);
        }
        const user = userData.username;
        console.log(req.session)
        req.session.user = { user };
        console.log(req.session)
        res.json(userData);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
