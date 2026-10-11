require("dotenv").config();

const express = require("express");
const cors = require("cors");

const analysisRoutes = require("./routes/analysisRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use("/api", analysisRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`CodeWise server running at http://localhost:${PORT}`);
});