const express = require("express");
const controller = require("../controllers/authController");
const { csrfProtection } = require("../middleware/csrfProtection");
const { authRateLimit } = require("../middleware/authRateLimit");

const router = express.Router();

router.get("/csrf", controller.getCsrfToken);
router.get("/me", controller.getCurrentUser);
router.post("/signup", authRateLimit, csrfProtection, controller.signup);
router.post("/login", authRateLimit, csrfProtection, controller.login);
router.post("/logout", csrfProtection, controller.logout);

module.exports = router;
