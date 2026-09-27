const express = require("express");
const { listPumps } = require("../controllers/publicPumpsController");

const router = express.Router();

router.get("/", listPumps);

module.exports = router;
