const Notification = require("../models/Notification");

const listNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(80)
      .lean();
    const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
    return res.status(200).json({
      success: true,
      data: { notifications, unreadCount },
    });
  } catch (error) {
    next(error);
  }
};

const markOneRead = async (req, res, next) => {
  try {
    const doc = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    ).lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }
    const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
    return res.status(200).json({ success: true, data: { notification: doc, unreadCount } });
  } catch (error) {
    next(error);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    return res.status(200).json({ success: true, message: "All notifications marked read." });
  } catch (error) {
    next(error);
  }
};

module.exports = { listNotifications, markOneRead, markAllRead };
