const express = require("express");
const { login } = require("../controllers/adminControllerSimple");

const router = express.Router();

router.post("/login", login);

module.exports = router;
