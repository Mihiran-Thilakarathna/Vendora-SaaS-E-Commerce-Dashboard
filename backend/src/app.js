const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const storeRoutes = require("./routes/storeRoutes");
const { dbState, isDbConnected } = require("./config/db");

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

// Serve uploaded files (profile avatars, product images, etc.)
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Always answers, even while the database is still connecting, so hosts and the
// frontend's warm-up ping can tell "server awake" apart from "database ready".
app.get("/api/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ success: true, message: "Vendora API is running", db: dbState() });
});

// Fail fast with a clear message instead of letting requests hang while the DB is down.
app.use("/api", (req, res, next) => {
  if (isDbConnected()) return next();
  res.set("Retry-After", "10");
  return res.status(503).json({
    success: false,
    code: "DB_UNAVAILABLE",
    message: "The server is starting up or can't reach its database. Please try again in a moment.",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/store", storeRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Server error",
  });
});

module.exports = app;
