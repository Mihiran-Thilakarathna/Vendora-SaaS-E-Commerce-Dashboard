require('dotenv').config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Store = require("../models/Store");
const Notification = require("../models/Notification");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    // eslint-disable-next-line no-console
    console.log("MongoDB connected for seeding.");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

const productsData = [
  {
    name: "Wireless Bluetooth Earbuds",
    description: "Compact earbuds with noise isolation and long battery life.",
    price: 12500,
    costPrice: 7600,
    stockQuantity: 45,
    category: "Electronics",
    imageURL:
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Smart Fitness Band",
    description: "Water-resistant fitness tracker with heart-rate monitoring.",
    price: 8900,
    costPrice: 5400,
    stockQuantity: 38,
    category: "Wearables",
    imageURL:
      "https://images.unsplash.com/photo-1575311373937-040b8e1fd6b0?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Mechanical Keyboard",
    description: "RGB backlit keyboard with tactile switches for productivity.",
    price: 18500,
    costPrice: 12400,
    stockQuantity: 22,
    category: "Accessories",
    imageURL:
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Portable SSD 1TB",
    description: "High-speed external SSD ideal for backups and media work.",
    price: 32000,
    costPrice: 25100,
    stockQuantity: 14,
    category: "Storage",
    imageURL:
      "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Oversized Cotton T-Shirt",
    description: "Premium breathable cotton tee with relaxed fit.",
    price: 3500,
    costPrice: 1700,
    stockQuantity: 80,
    category: "Clothing",
    imageURL:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Denim Jacket",
    description: "Classic unisex denim jacket for casual daily wear.",
    price: 7900,
    costPrice: 4300,
    stockQuantity: 27,
    category: "Clothing",
    imageURL:
      "https://images.unsplash.com/photo-1495105787522-5334e3ffa0ef?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Leather Office Backpack",
    description: "Sleek laptop backpack with padded compartments.",
    price: 11500,
    costPrice: 7300,
    stockQuantity: 19,
    category: "Bags",
    imageURL:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Ceramic Coffee Mug Set",
    description: "Set of 4 minimalist mugs for home and office use.",
    price: 4200,
    costPrice: 2200,
    stockQuantity: 52,
    category: "Home",
    imageURL:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcf93a?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Bluetooth Speaker",
    description: "Portable speaker with deep bass and 12-hour playback.",
    price: 9900,
    costPrice: 6200,
    stockQuantity: 31,
    category: "Electronics",
    imageURL:
      "https://images.unsplash.com/photo-1585386959984-a41552262f99?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Gaming Mouse",
    description: "Ergonomic mouse with adjustable DPI and macro buttons.",
    price: 6500,
    costPrice: 3600,
    stockQuantity: 9,
    category: "Accessories",
    imageURL:
      "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=400&q=80",
  },
];

const createOrders = (products, storeId) => {
  const orderAItems = [
    { product: products[0]._id, quantity: 2 },
    { product: products[4]._id, quantity: 3 },
  ];
  const orderBItems = [
    { product: products[2]._id, quantity: 1 },
    { product: products[8]._id, quantity: 2 },
  ];
  const orderCItems = [
    { product: products[3]._id, quantity: 1 },
    { product: products[9]._id, quantity: 2 },
    { product: products[7]._id, quantity: 1 },
  ];

  const calcTotal = (items) =>
    items.reduce((sum, item) => {
      const matchedProduct = products.find(
        (p) => p._id.toString() === item.product.toString()
      );
      return sum + matchedProduct.price * item.quantity;
    }, 0);

  return [
    {
      store: storeId,
      customerName: "Kasun Perera",
      items: orderAItems,
      totalAmount: calcTotal(orderAItems), // Rs. 35,500
      status: "Pending",
      shippingAddress: "No. 14, Lake Road, Colombo 08",
    },
    {
      store: storeId,
      customerName: "Dinithi Fernando",
      items: orderBItems,
      totalAmount: calcTotal(orderBItems), // Rs. 38,300
      status: "Processing",
      shippingAddress: "No. 88, Galle Road, Dehiwala",
    },
    {
      store: storeId,
      customerName: "Nimal Jayasinghe",
      items: orderCItems,
      totalAmount: calcTotal(orderCItems), // Rs. 49,200
      status: "Shipped",
      shippingAddress: "No. 21, Kandy Road, Kadawatha",
    },
  ];
};

/**
 * Demo account credentials. Emails match the API's DEMO_*_EMAIL settings. Passwords come from
 * DEMO_ADMIN_PASSWORD / DEMO_STAFF_PASSWORD; the fallbacks are for local development only and
 * are publicly known, so always set your own in production.
 */
const DEMO_CREDENTIALS = {
  admin: {
    email: (process.env.DEMO_ADMIN_EMAIL || "admin@vendora.com").toLowerCase(),
    password: process.env.DEMO_ADMIN_PASSWORD || "Admin@123",
  },
  staff: {
    email: (process.env.DEMO_STAFF_EMAIL || "staff@vendora.com").toLowerCase(),
    password: process.env.DEMO_STAFF_PASSWORD || "Staff@123",
  },
};

/**
 * Resets only the shared demo store (its two demo accounts, products and orders) on the
 * current mongoose connection. Stores that real users signed up for are left untouched.
 * Records from before multi-tenancy (no `store` at all) are treated as old demo data.
 */
const seedDatabase = async () => {
    const demoStoreIds = (await Store.find({ isDemo: true }).select("_id").lean()).map((s) => s._id);
    const demoData = { $or: [{ store: { $in: demoStoreIds } }, { store: { $exists: false } }] };
    await Promise.all([
      Store.deleteMany({ _id: { $in: demoStoreIds } }),
      User.deleteMany({ $or: [...demoData.$or, { email: { $in: [DEMO_CREDENTIALS.admin.email, DEMO_CREDENTIALS.staff.email] } }] }),
      Product.deleteMany(demoData),
      Order.deleteMany(demoData),
      Notification.deleteMany(demoData),
    ]);
    // eslint-disable-next-line no-console
    console.log("Demo store cleared.");

    const adminPassword = await bcrypt.hash(DEMO_CREDENTIALS.admin.password, 10);
    const staffPassword = await bcrypt.hash(DEMO_CREDENTIALS.staff.password, 10);

    const adminId = new mongoose.Types.ObjectId();
    const store = await Store.create({ name: "Vendora Demo Store", owner: adminId, isDemo: true });

    const users = await User.insertMany([
      {
        _id: adminId,
        store: store._id,
        name: "Vendora Admin",
        email: DEMO_CREDENTIALS.admin.email,
        password: adminPassword,
        role: "Admin",
        tokenVersion: 0,
      },
      {
        store: store._id,
        name: "Order Staff",
        email: DEMO_CREDENTIALS.staff.email,
        password: staffPassword,
        role: "Staff",
        tokenVersion: 0,
      },
    ]);

    const products = await Product.insertMany(productsData.map((p) => ({ ...p, store: store._id })));
    const orders = await Order.insertMany(createOrders(products, store._id));

    // eslint-disable-next-line no-console
    console.log("Seed completed successfully.");
    // eslint-disable-next-line no-console
    console.log(`Users: ${users.length}, Products: ${products.length}, Orders: ${orders.length}`);
    const usingDefaults = !process.env.DEMO_ADMIN_PASSWORD || !process.env.DEMO_STAFF_PASSWORD;
    // eslint-disable-next-line no-console
    console.log(`Demo accounts: ${DEMO_CREDENTIALS.admin.email} (Admin), ${DEMO_CREDENTIALS.staff.email} (Staff)`);
    if (usingDefaults) {
      // eslint-disable-next-line no-console
      console.warn(
        "Using the default demo passwords (Admin@123 / Staff@123). Set DEMO_ADMIN_PASSWORD and DEMO_STAFF_PASSWORD before seeding a production database."
      );
    }
    return { store, users, products, orders };
};

const seed = async () => {
  await connectDB();

  try {
    await seedDatabase();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Seeding failed:", error.message);
  } finally {
    await mongoose.connection.close();
    // eslint-disable-next-line no-console
    console.log("MongoDB connection closed.");
  }
};

if (require.main === module) {
  seed();
}

module.exports = { seedDatabase };
