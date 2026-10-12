require("dotenv").config();

const express = require("express");
const cors = require("cors");

const analysisRoutes = require("./routes/analysisRoutes");
const authRoutes = require("./routes/authRoutes");
const { allowedFrontendOrigins } = require("./middleware/csrfProtection");
const { createAuthSessionMiddleware } = require("./middleware/authSession");
const { requestLogger } = require("./middleware/requestLogger");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

// Middleware
const frontendOrigins = allowedFrontendOrigins();
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || frontendOrigins.has(origin));
  },
  credentials: true,
}));
app.use(requestLogger);
app.use(express.json({ limit: "100kb" }));
app.use(createAuthSessionMiddleware());

// API routes
app.use("/api", analysisRoutes);
app.use("/api/auth", authRoutes);
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`CodeWise server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
