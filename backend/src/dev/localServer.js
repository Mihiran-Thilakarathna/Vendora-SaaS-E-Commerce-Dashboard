/**
 * Zero-setup local run: starts a throwaway in-memory MongoDB, seeds demo data
 * (plus ~30 days of backdated orders so the dashboard charts have something to show),
 * then starts the API. Data is wiped when the process stops.
 *
 *   npm run dev:local
 */
require("dotenv").config();
const { MongoMemoryServer } = require("mongodb-memory-server-core");
const mongoose = require("mongoose");

const CUSTOMERS = [
  "Kasun Perera",
  "Dinithi Fernando",
  "Nimal Jayasinghe",
  "Ishara Silva",
  "Ruwan Bandara",
  "Sachini Dias",
  "Tharindu Wijesinghe",
  "Hiruni Rathnayake",
];
const CITIES = ["Colombo 03", "Dehiwala", "Kandy", "Galle", "Negombo", "Kurunegala", "Matara"];
const STATUSES = ["Pending", "Processing", "Shipped", "Delivered"];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const addHistoricalOrders = async ({ store, products, users }) => {
  const Order = require("../models/Order");
  const admin = users.find((u) => u.role === "Admin") || users[0];
  const staff = users.find((u) => u.role === "Staff") || admin;
  const now = Date.now();
  const docs = [];

  for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
    const perDay = 1 + Math.floor(Math.random() * 3);
    for (let n = 0; n < perDay; n += 1) {
      const lineCount = 1 + Math.floor(Math.random() * 2);
      const items = [];
      for (let i = 0; i < lineCount; i += 1) {
        const product = pick(products);
        if (!items.some((it) => String(it.product) === String(product._id))) {
          items.push({ product: product._id, quantity: 1 + Math.floor(Math.random() * 3) });
        }
      }
      const totalAmount = items.reduce(
        (sum, it) => sum + products.find((p) => String(p._id) === String(it.product)).price * it.quantity,
        0
      );
      const createdAt = new Date(now - daysAgo * 86_400_000 - Math.floor(Math.random() * 10) * 3_600_000);
      // Older orders are mostly delivered; recent ones are still moving through the pipeline.
      const status = daysAgo > 7 ? (Math.random() < 0.85 ? "Delivered" : "Shipped") : pick(STATUSES);
      docs.push({
        store: store._id,
        customerName: pick(CUSTOMERS),
        items,
        totalAmount,
        status,
        shippingAddress: `No. ${10 + Math.floor(Math.random() * 180)}, Main Street, ${pick(CITIES)}`,
        createdBy: Math.random() < 0.6 ? admin._id : staff._id,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  // Raw driver insert so our backdated createdAt values are kept as-is.
  await Order.collection.insertMany(docs);
  return docs.length;
};

const start = async () => {
  // eslint-disable-next-line no-console
  console.log("Starting in-memory MongoDB (first run downloads the MongoDB binary once)...");
  const mongod = await MongoMemoryServer.create({ instance: { dbName: "vendora" } });

  process.env.MONGO_URI = mongod.getUri("vendora");
  process.env.JWT_SECRET = process.env.JWT_SECRET || "local-dev-only-secret";

  const connectDB = require("../config/db");
  await connectDB();

  const { seedDatabase } = require("../seed/seedData");
  const seeded = await seedDatabase();
  const extra = await addHistoricalOrders(seeded);
  // eslint-disable-next-line no-console
  console.log(`Added ${extra} backdated orders across the last 30 days.`);

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
