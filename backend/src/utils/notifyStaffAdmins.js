const User = require("../models/User");
const Notification = require("../models/Notification");

/**
 * Creates the same in-app notification for every Admin and Staff user of one store.
 * `storeId` is required so an alert never reaches another store's team.
 */
async function notifyStaffAdmins({ storeId, title, message, type = "info", meta = {} }) {
  if (!storeId) throw new Error("notifyStaffAdmins needs a storeId.");
  const users = await User.find({ store: storeId, role: { $in: ["Admin", "Staff"] } }).select("_id").lean();
  if (!users.length) return;
  await Notification.insertMany(
    users.map((u) => ({
      store: storeId,
      user: u._id,
      title,
      message,
      type,
      read: false,
      meta,
    }))
  );
}

module.exports = { notifyStaffAdmins };
