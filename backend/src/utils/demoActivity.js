const Store = require("../models/Store");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Notification = require("../models/Notification");

/**
 * Keeps the shared demo store looking like a busy, real shop.
 *
 * A one-off seed goes stale: after a week the "last 7 days" charts are empty. This tops up
 * the demo store with realistic orders for every day that has none yet (up to `days` back),
 * moves older orders along the fulfilment pipeline, keeps the catalogue stocked (with a
 * couple of deliberately low items so the alerts show), and adds a few notifications.
 *
 * Only ever touches the store flagged `isDemo`. Safe to run repeatedly: each run only fills
 * the gap since the newest existing order.
 */

const DAY = 86_400_000;

const EXTRA_PRODUCTS = [
  { name: "USB-C Fast Charger 65W", description: "Compact GaN charger for laptops and phones.", price: 7900, costPrice: 4300, stockQuantity: 64, category: "Electronics" },
  { name: "Noise Cancelling Headphones", description: "Over-ear wireless headphones with 30-hour battery.", price: 28500, costPrice: 19800, stockQuantity: 18, category: "Electronics" },
  { name: "Smartwatch Pro", description: "AMOLED smartwatch with GPS and sleep tracking.", price: 34900, costPrice: 24500, stockQuantity: 12, category: "Wearables" },
  { name: "Linen Summer Shirt", description: "Breathable linen shirt for warm days.", price: 5400, costPrice: 2500, stockQuantity: 46, category: "Clothing" },
  { name: "Canvas Weekender Bag", description: "Water-resistant canvas bag for short trips.", price: 11800, costPrice: 6900, stockQuantity: 7, category: "Bags" },
  { name: "Stainless Steel Water Bottle", description: "Insulated 750 ml bottle, keeps drinks cold for 24 hours.", price: 3900, costPrice: 1800, stockQuantity: 120, category: "Home" },
  { name: "Aromatherapy Diffuser", description: "Ultrasonic diffuser with ambient light.", price: 6800, costPrice: 3700, stockQuantity: 33, category: "Home" },
  { name: "Vitamin C Face Serum", description: "Brightening serum for daily use, 30 ml.", price: 4600, costPrice: 1900, stockQuantity: 5, category: "Beauty" },
  { name: "Webcam 1080p", description: "Full-HD webcam with dual microphones.", price: 9900, costPrice: 6200, stockQuantity: 26, category: "Accessories" },
  { name: "Wireless Charging Pad", description: "Slim 15W Qi charging pad.", price: 4200, costPrice: 2100, stockQuantity: 58, category: "Accessories" },
];

const CUSTOMERS = [
  "Kasun Perera", "Dinithi Fernando", "Nimal Jayasinghe", "Ishara Silva", "Ruwan Bandara",
  "Sachini Dias", "Tharindu Wijesinghe", "Hiruni Rathnayake", "Chamath Gunawardena", "Nethmi Senanayake",
  "Lahiru Abeysekara", "Sanduni Karunaratne", "Pasindu Herath", "Malsha Weerasinghe", "Dilshan Kumara",
  "Yashodha Rajapaksha", "Isuru Madushanka", "Kavindi Peiris", "Thilina Samarasinghe", "Ayesha Mendis",
];
const STREETS = ["Galle Road", "Kandy Road", "Lake Drive", "Temple Lane", "Station Road", "Hill Street", "Park Avenue", "Flower Road"];
const CITIES = ["Colombo 03", "Colombo 07", "Dehiwala", "Nugegoda", "Kandy", "Galle", "Negombo", "Kurunegala", "Matara", "Maharagama"];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const startOfDay = (t) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Status that fits an order of this age, so the pipeline looks alive. */
const statusForAge = (ageDays) => {
  const r = Math.random();
  if (ageDays >= 8) return r < 0.92 ? "Delivered" : "Shipped";
  if (ageDays >= 4) return r < 0.55 ? "Delivered" : r < 0.9 ? "Shipped" : "Processing";
  if (ageDays >= 2) return r < 0.45 ? "Shipped" : r < 0.85 ? "Processing" : "Pending";
  return r < 0.55 ? "Pending" : "Processing";
};

const BASE_DAILY_REVENUE = 80_000;

/**
 * Revenue a day should reach: a growth curve that rises towards today, busier Fri-Sun,
 * and +/-8% noise. Orders are added until the day hits its target, so weekly totals follow
 * the trend instead of swinging wildly with which products happen to be picked.
 */
const targetRevenueForDay = (dayTime, daysAgo, windowDays) => {
  const weekday = new Date(dayTime).getDay();
  const weekendFactor = weekday === 5 || weekday === 6 || weekday === 0 ? 1.25 : 0.9;
  const progress = 1 - Math.min(daysAgo, windowDays) / Math.max(windowDays, 1);
  const trend = 0.6 + 0.9 * progress ** 1.6;
  return BASE_DAILY_REVENUE * trend * weekendFactor * (1 + (Math.random() - 0.5) * 0.16);
};

let running = false;

const ensureDemoActivity = async ({ days = 90, now = Date.now() } = {}) => {
  if (String(process.env.DEMO_LOGIN_ENABLED || "true").toLowerCase() === "false") return null;
  if (running) return null;
  running = true;
  try {
    const store = await Store.findOne({ isDemo: true }).lean();
    if (!store) return null;
    const storeId = store._id;

    // 1. A fuller catalogue (adds any missing extra products once).
    const existing = await Product.find({ store: storeId }).select("name").lean();
    const names = new Set(existing.map((p) => p.name));
    const toAdd = EXTRA_PRODUCTS.filter((p) => !names.has(p.name)).map((p) => ({ ...p, store: storeId }));
    if (toAdd.length) await Product.insertMany(toAdd);

    // Restock anything a visitor sold out, but leave genuinely low items low for the alerts.
    await Product.updateMany({ store: storeId, stockQuantity: { $lte: 0 } }, { $set: { stockQuantity: 30 } });

    const products = (await Product.find({ store: storeId }).select("price").lean()).filter((p) => p.price > 0);
    if (!products.length) return null;
    const staff = await User.find({ store: storeId }).select("role").lean();
    const admin = staff.find((u) => u.role === "Admin");
    const staffer = staff.find((u) => u.role === "Staff") || admin;

    // 2. Fill every day in the window that has no orders yet, up to now.
    const today = startOfDay(now);
    const windowStart = today - (days - 1) * DAY;
    const inWindow = await Order.find({ store: storeId, createdAt: { $gte: new Date(windowStart) } })
      .select("createdAt")
      .lean();
    const busyDays = new Set(inWindow.map((o) => startOfDay(o.createdAt)));

    const docs = [];
    for (let day = windowStart; day <= today; day += DAY) {
      if (busyDays.has(day)) continue;
      const daysAgo = Math.round((today - day) / DAY);
      let target = targetRevenueForDay(day, daysAgo, days);
      // Today is still in progress: aim for most of a normal day so the week doesn't look slow.
      if (day === today) target *= Math.max(0.8, new Date(now).getHours() / 24);
      let dayRevenue = 0;
      let guard = 0;
      while (dayRevenue < target - 8_000 && guard < 40) {
        guard += 1;
        // Mostly single-item orders, and only products that fit what's left of the day's
        // target, so a single big order can't blow a quiet weekday out of proportion.
        const lineCount = Math.random() < 0.75 ? 1 : 2;
        const items = [];
        let room = target - dayRevenue + 8_000;
        for (let line = 0; line < lineCount; line += 1) {
          const fits = products.filter(
            (p) => p.price <= room && !items.some((it) => String(it.product) === String(p._id))
          );
          if (!fits.length) break;
          const p = pick(fits);
          const quantity = Math.random() < 0.85 || p.price * 2 > room ? 1 : 2;
          items.push({ product: p._id, quantity, price: p.price });
          room -= p.price * quantity;
        }
        if (!items.length) break;
        const latestHour = day === today ? Math.max(9, new Date(now).getHours()) : 21;
        let createdAt = new Date(day + randInt(8, latestHour) * 3_600_000 + randInt(0, 59) * 60_000);
        if (createdAt.getTime() > now) createdAt = new Date(now - randInt(5, 90) * 60_000);
        const totalAmount = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
        dayRevenue += totalAmount;
        docs.push({
          store: storeId,
          customerName: pick(CUSTOMERS),
          items: items.map(({ product, quantity }) => ({ product, quantity })),
          totalAmount,
          status: statusForAge(daysAgo),
          shippingAddress: `No. ${randInt(4, 240)}, ${pick(STREETS)}, ${pick(CITIES)}`,
          createdBy: Math.random() < 0.6 ? admin?._id || null : staffer?._id || null,
          createdAt,
          updatedAt: createdAt,
          __v: 0,
        });
      }
    }
    // Raw driver insert so the backdated createdAt values are kept.
    if (docs.length) await Order.collection.insertMany(docs);

    // 3. Move older orders along the pipeline (visitors can still change statuses by hand).
    await Order.updateMany(
      { store: storeId, status: { $in: ["Pending", "Processing", "Shipped"] }, createdAt: { $lt: new Date(now - 9 * DAY) } },
      { $set: { status: "Delivered" } }
    );
    await Order.updateMany(
      { store: storeId, status: "Pending", createdAt: { $lt: new Date(now - 4 * DAY) } },
      { $set: { status: "Shipped" } }
    );

    // 4. A few fresh notifications for the newest orders.
    if (docs.length && staff.length) {
      const newest = [...docs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
      const notes = [];
      newest.forEach((o) => {
        staff.forEach((u) =>
          notes.push({
            store: storeId,
            user: u._id,
            title: "New order",
            message: `${o.customerName} placed an order for Rs. ${o.totalAmount.toLocaleString("en-LK")}.`,
            type: "order",
            read: false,
            meta: {},
            createdAt: o.createdAt,
            updatedAt: o.createdAt,
            __v: 0,
          })
        );
      });
      await Notification.collection.insertMany(notes);
    }

    if (docs.length || toAdd.length) {
      // eslint-disable-next-line no-console
      console.log(`Demo activity: added ${docs.length} orders and ${toAdd.length} products to "${store.name}".`);
    }
    return { orders: docs.length, products: toAdd.length };
  } finally {
    running = false;
  }
};

/** Runs now, then every `intervalHours` hours, without blocking shutdown. */
const scheduleDemoActivity = ({ intervalHours = 3 } = {}) => {
  const run = () =>
    ensureDemoActivity().catch((error) => {
      // eslint-disable-next-line no-console
      console.error("Demo activity failed:", error.message);
    });
  run();
  const timer = setInterval(run, intervalHours * 3_600_000);
  if (timer.unref) timer.unref();
  return timer;
};

module.exports = { ensureDemoActivity, scheduleDemoActivity };
