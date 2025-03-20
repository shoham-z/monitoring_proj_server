const express = require("express");
const router = express.Router();
const {
    getUsers, getUserPhone, changPassword, deleteUser,
} = require("../dbBridge");
const {responseGet} = require("../headers");

/* GET users section. */
router.get("/", function (req, res, _next) {
    getUsers().then((data) => responseGet(res, data));
});

router.get("/phone", function (req, res, _next) {
    getUserPhone(req.query.username).then((data) => responseGet(res, data));
});

router.post("/change-password", (req, res) => {
    console.log(req.body.userPhone, req.body.newPassword);
    changPassword(req.body.userPhone, req.body.newPassword)
        .then((response) => {
            if (response === 0) res.status(200).json({message: "changed successfully"});
        })
        .catch((err) => console.log(err));
});

router.delete("/delete-user", (req, res) => {
    let response = deleteUser(req.body.userPhone);

    if (response === 0) res.status(200);

});

module.exports = router;
