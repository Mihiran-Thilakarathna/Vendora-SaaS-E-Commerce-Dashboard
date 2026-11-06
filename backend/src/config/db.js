const mongoose = require("mongoose");

const STATES = ["disconnected", "connected", "connecting", "disconnecting"];

/** Human-readable connection state, used by the health check and the 503 guard. */
const dbState = () => STATES[mongoose.connection.readyState] || "unknown";
const isDbConnected = () => mongoose.connection.readyState === 1;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Connects to MongoDB, retrying with backoff instead of exiting.
 *
 * Exiting on the first failure meant the HTTP server never started, so on hosts like
 * Render every request hung until the platform gave up. Now the API stays up, answers
 * /api/health immediately, returns a fast 503 for data routes, and recovers on its own
 * as soon as the database becomes reachable.
 *
 * Resolves once connected.
 */
const connectDB = async ({ maxDelayMs = 30_000 } = {}) => {
  if (!process.env.MONGO_URI) {
    // eslint-disable-next-line no-console
    console.error("MONGO_URI is not set. Add it to the environment (see backend/.env.example).");
  }

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    try {
      const connection = await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
      // eslint-disable-next-line no-console
      console.log(`MongoDB connected: ${connection.connection.host}`);
      return connection;
    } catch (error) {
      const delay = Math.min(maxDelayMs, 2_000 * 2 ** Math.min(attempt - 1, 4));
      // eslint-disable-next-line no-console
      console.error(`MongoDB connection failed (attempt ${attempt}): ${error.message}. Retrying in ${delay / 1000}s.`);
      await wait(delay);
    }
  }
};

module.exports = connectDB;
module.exports.dbState = dbState;
module.exports.isDbConnected = isDbConnected;
