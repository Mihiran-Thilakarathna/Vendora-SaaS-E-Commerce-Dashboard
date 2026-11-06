const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized. Token missing." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized. User not found." });
    }

    const tokenTv = decoded.tv !== undefined && decoded.tv !== null ? decoded.tv : 0;
    const currentTv = user.tokenVersion || 0;
    if (tokenTv !== currentTv) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please sign in again with your updated credentials.",
      });
    }

    if (!user.store) {
      return res.status(403).json({ success: false, message: "Your account is not linked to a store." });
    }

    req.user = user;
    // Every data query must filter on this. It comes from the database, never from the request.
    req.storeId = user.store;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized. Invalid token." });
  }
};

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Forbidden. You do not have permission for this action.",
    });
  }
  next();
};

module.exports = { protect, authorize };
