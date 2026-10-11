const express = require("express");
const controller = require("../controllers/analysisController");
const { analyzeRateLimit } = require("../middleware/analyzeRateLimit");

const router = express.Router();

router.post("/analyze", analyzeRateLimit, controller.analyzeCode);
router.get("/health", controller.checkHealth);
module.exports = router;
