const Store = require("../models/Store");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Notification = require("../models/Notification");

const DEMO_ADMIN_EMAIL = () => (process.env.DEMO_ADMIN_EMAIL || "admin@vendora.com").toLowerCase();

/**
 * One-time upgrade for databases created before multi-tenancy existed.
 * Any user, product, order or notification without a `store` is moved into a single
 * legacy store, so existing data keeps working. Safe to run on every boot: when nothing
 * is missing a store it does no writes.
 */
const ensureTenancy = async () => {
  const missing = { store: { $exists: false } };
  const collections = [User, Product, Order, Notification];
  const counts = await Promise.all(collections.map((M) => M.collection.countDocuments(missing)));
  if (counts.every((n) => n === 0)) return null;

  const firstAdmin = await User.collection.findOne({ role: "Admin" }, { sort: { createdAt: 1 } });
  const isDemo = Boolean(firstAdmin && String(firstAdmin.email).toLowerCase() === DEMO_ADMIN_EMAIL());

  // Reuse the demo store if one already exists, so data never ends up split in two.
  let store = isDemo ? await Store.findOne({ isDemo: true }) : null;
  if (!store) {
    store = await Store.create({
      name: isDemo ? "Vendora Demo Store" : "My Store",
      owner: firstAdmin?._id || null,
      isDemo,
    });
  }

  // Raw driver updates: the documents being fixed would fail mongoose's `required` check.
  await Promise.all(collections.map((M) => M.collection.updateMany(missing, { $set: { store: store._id } })));

  // eslint-disable-next-line no-console
  console.log(
    `Tenancy migration: moved ${counts.reduce((a, b) => a + b, 0)} legacy records into store "${store.name}".`
  );
  return store;
};

module.exports = { ensureTenancy };
