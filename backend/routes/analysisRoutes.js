const express = require("express");
const controller = require("../controllers/analysisController");
const { analyzeRateLimit } = require("../middleware/analyzeRateLimit");
const { requireAuth } = require("../middleware/requireAuth");
const { csrfProtection } = require("../middleware/csrfProtection");

const router = express.Router();

router.post("/analyze", requireAuth, csrfProtection, analyzeRateLimit, controller.analyzeCode);
router.get("/health", controller.checkHealth);
module.exports = router;
