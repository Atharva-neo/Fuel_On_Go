const express = require("express");
const { createBooking } = require("../controllers/bookController");

const router = express.Router();

router.post("/", createBooking);

module.exports = router;
