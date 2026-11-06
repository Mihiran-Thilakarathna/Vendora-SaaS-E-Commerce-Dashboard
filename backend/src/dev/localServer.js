/**
 * Zero-setup local run: starts a throwaway in-memory MongoDB, seeds demo data
 * (plus 90 days of realistic orders from the demo-activity job, so the charts are full),
 * then starts the API. Data is wiped when the process stops.
 *
 *   npm run dev:local
 */
require("dotenv").config();
const { MongoMemoryServer } = require("mongodb-memory-server-core");
const mongoose = require("mongoose");

const start = async () => {
  // eslint-disable-next-line no-console
  console.log("Starting in-memory MongoDB (first run downloads the MongoDB binary once)...");
  const mongod = await MongoMemoryServer.create({ instance: { dbName: "vendora" } });

  process.env.MONGO_URI = mongod.getUri("vendora");
  process.env.JWT_SECRET = process.env.JWT_SECRET || "local-dev-only-secret";

  const connectDB = require("../config/db");
  await connectDB();

  const { seedDatabase } = require("../seed/seedData");
  await seedDatabase();
  const { ensureDemoActivity } = require("../utils/demoActivity");
  const activity = await ensureDemoActivity();
  // eslint-disable-next-line no-console
  console.log(`Demo store ready: ${activity?.orders ?? 0} orders across the last 90 days.`);

  const app = require("../app");
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`\nVendora API (in-memory DB) listening on http://localhost:${PORT}`);
    // eslint-disable-next-line no-console
    console.log("Data resets every time you restart this command.\n");
  });

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    await mongod.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Local server failed to start:", err);
  process.exit(1);
});
