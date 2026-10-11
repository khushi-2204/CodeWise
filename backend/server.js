require("dotenv").config();

const express = require("express");
const cors = require("cors");

const analysisRoutes = require("./routes/analysisRoutes");
const { requestLogger } = require("./middleware/requestLogger");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(requestLogger);
app.use(express.json({ limit: "100kb" }));

// API routes
app.use("/api", analysisRoutes);
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`CodeWise server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
