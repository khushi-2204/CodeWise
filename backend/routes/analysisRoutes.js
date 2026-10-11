const express = require("express");
const controller = require("../controllers/analysisController");

const router = express.Router();

router.post("/analyze", controller.analyzeCode);
router.get("/health", controller.checkHealth);
module.exports = router;