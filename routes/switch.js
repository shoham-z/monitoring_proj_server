const express = require("express");
const router = express.Router();
const {responseGet} = require("../headers");
const { addSwitch, editSwitch, deleteSwitch, getSwitch, getSwitchAll } = require("./db_functions");

/* GET a specific switch by IP */
router.get("/:switchIp", async (req, res) => {
    try {
        const switchIp = req.params.switchIp;
        const switchData = await getSwitch(switchIp);
        if (switchData) {
            res.json(switchData);
        } else {
            res.status(404).json({ error: "Switch not found" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/* GET all switches (alternative route, remove if unnecessary) */
router.get("/:switchIpAll", async (req, res) => {
    try {
        const switches = await getSwitchAll();
        res.json(switches);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post("/add/", (req, res) => {
    const {ip, name} = req.body;
    addSwitch(ip, name).then(()=> responseGet(res, "added " + ip));
});

router.put("/edit/", (req, res) => {
    const {ip, name} = req.body;
    editSwitch(ip, name).then(()=> responseGet(res, "edited " + ip));
});

router.delete("/remove/:switchIp", (req, res) => {
    const ip = req.params.switchIp;
    deleteSwitch(ip).then(()=> responseGet(res, "removed " + ip));
    //responseGet(res, "delete " + req.params.switchIp);
    // delete switch
});

module.exports = router;
