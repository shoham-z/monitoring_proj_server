const express = require('express');
const router = express.Router();
const { addSwitch, editSwitch, deleteSwitch, getSwitch, getSwitchAll, getUser, hashPassword } = require('./server_functions'); // Import functions
const argon2 = require('argon2');

// 🟢 GET all switches
router.get('/getAll', async (req, res) => {
    try {
        const switches = await getSwitchAll();
        res.status(200).json(switches);
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
        res.status(200).json(switchData);
    } catch (error) {
        console.error("Error fetching switch:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🟡 ADD a switch (POST)
router.post('/add', async (req, res) => {
    const { ip, name } = req.body;
    if (!ip || !name) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    
    try {
        await addSwitch(ip, name);
        res.status(201).json({ message: "Switch added successfully" });
    } catch (err) {
        if (err?.error){
            res.status(409).json(err);
        } else {
            console.error("Error adding switch:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
});

// 🔴 DELETE a switch
router.delete('/delete', async (req, res) => {
    try {
        const { ip } = req.body;
        await deleteSwitch(ip);
        res.status(200).json({ message: "Switch deleted successfully" });
    } catch (error) {
        console.error("Error deleting switch:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🟠 EDIT a switch (PUT)
router.put('/edit', async (req, res) => {
    const { ip, name, oldIp } = req.body;
    try {
        const result = await editSwitch(oldIp, ip, name);  
        // Send a response back to the client
        if (result?.error){res.status(409).json(result);}
        else {res.status(200).json({message: `Edited Successfully!`});}
    } catch (err) {
        if (err?.error){res.status(409).json(err);}
        else {res.status(400).json(err);}
    }
});

//checks credentials and saves into session
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userData = await getUser(username);
        if (!userData) {
            return res.status(404).json(null);
        }
        const valid = await argon2.verify(userData.password, password);
        if (!valid){
            return res.status(401).json(null);
        }
        const user = userData.username;
        req.session.user = { user };
        res.status(200).json(userData);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
