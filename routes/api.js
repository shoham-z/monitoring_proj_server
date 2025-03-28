const express = require('express');
const router = express.Router();
const { addSwitch, editSwitch, deleteSwitch, getSwitch, getSwitchAll } = require('./db_functions'); // Import functions

// 🟢 GET all switches
router.get('/switches', async (req, res) => {
    try {
        const switches = await getSwitchAll();
        res.json(switches);
    } catch (error) {
        console.error("Error fetching switches:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🔵 GET a single switch by IP
router.get('/switch/:ip', async (req, res) => {
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
router.post('/switch', async (req, res) => {
    const { ip, name, reachable } = req.body;
    if (!ip || !name || reachable === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    
    try {
        addSwitch(ip, name, reachable);
        res.json({ message: "Switch added successfully" });
    } catch (error) {
        console.error("Error adding switch:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🟠 EDIT a switch (PUT)
router.put('/switch', async (req, res) => {
    const { ip, name } = req.body;
    if (!ip || !name) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        await editSwitch(ip, name);
        res.json({ message: "Switch updated successfully" });
    } catch (error) {
        console.error("Error updating switch:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🔴 DELETE a switch
router.delete('/switch/:ip', async (req, res) => {
    try {
        deleteSwitch(req.params.ip);
        res.json({ message: "Switch deleted successfully" });
    } catch (error) {
        console.error("Error deleting switch:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
