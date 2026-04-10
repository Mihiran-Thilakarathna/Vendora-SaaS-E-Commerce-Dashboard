const User = require("../models/User");
const Notification = require("../models/Notification");

/**
 * Creates the same notification row for every Admin and Staff user (in-app alerts).
 */
async function notifyStaffAdmins({ title, message, type = "info", meta = {} }) {
  const users = await User.find({ role: { $in: ["Admin", "Staff"] } }).select("_id").lean();
  if (!users.length) return;
  await Notification.insertMany(
    users.map((u) => ({
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
