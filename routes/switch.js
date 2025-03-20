const express = require("express");
const router = express.Router();
const {responseGet} = require("../headers");
const { addSwitch, editSwitch, deleteSwitch } = require("./db_functions");

/* GET users section. */
router.get("/", function (req, res, _next) {
    //get all switches
});

router.get("/:switchIp", function (req, res, _next) {
    const switchIp = req.params.switchIp;
    responseGet(res, "get " + req.params.switchIp);
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
