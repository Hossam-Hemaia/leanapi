const express = require("express");
const authController = require("../controllers/authController");
const isAuth = require("../middleware/isAuth");

const router = express.Router();

router.post("/login", authController.userLogin);

router.get("/verify/token", authController.getVerifyToken);

//router.post("/logout", isAuth.userIsAuth, authController.userLoggedOut);

module.exports = router;
