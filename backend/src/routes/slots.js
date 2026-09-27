const express = require("express");
const { getSlots } = require("../controllers/slotsController");

const router = express.Router();

router.get("/:pumpId", getSlots);

module.exports = router;
