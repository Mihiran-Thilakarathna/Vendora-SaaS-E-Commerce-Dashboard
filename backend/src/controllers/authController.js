const bcrypt = require("bcryptjs");
const fs = require("fs");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const path = require("path");

const formatUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatarURL: user.avatarURL || "",
  address: user.address || "",
  telephone: user.telephone || "",
});

/** Old demo seed used remote stock images; strip so users only see photos they uploaded. */
const isLegacyAutoAvatar = (url) => {
  if (!url || typeof url !== "string") return false;
  const u = url.toLowerCase();
  return u.includes("images.unsplash.com") || u.includes("unsplash.com/photo");
};

const tryDeleteLocalAvatarFile = (avatarURL) => {
  if (!avatarURL || typeof avatarURL !== "string") return;
  const match = String(avatarURL).match(/\/uploads\/avatars\/([^/?#]+)/);
  if (!match) return;
  const filePath = path.join(__dirname, "..", "..", "uploads", "avatars", match[1]);
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore missing file */
  }
};

const stripLegacyAvatarIfNeeded = async (user) => {
  if (!user || !isLegacyAutoAvatar(user.avatarURL)) return user;
  user.avatarURL = "";
  await user.save();
  return user;
};

const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }

    const emailNorm = String(email).toLowerCase().trim();
    const existingUser = await User.findOne({ email: emailNorm });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "Email already in use." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: emailNorm,
      password: hashedPassword,
      role: role === "Admin" ? "Admin" : "Staff",
      tokenVersion: 0,
    });

    const token = generateToken({
      id: user._id,
      role: user.role,
      tv: user.tokenVersion || 0,
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      data: {
        user: formatUser(user),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    await stripLegacyAvatarIfNeeded(user);

    const tv = user.tokenVersion || 0;
    const token = generateToken({ id: user._id, role: user.role, tv });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        user: formatUser(user),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    await stripLegacyAvatarIfNeeded(req.user);
    return res.status(200).json({
      success: true,
      data: formatUser(req.user),
    });
  } catch (e) {
    next(e);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, avatarURL, address, telephone } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (name !== undefined && String(name).trim()) {
      user.name = String(name).trim();
    }
    if (avatarURL !== undefined) {
      const nextAvatar = String(avatarURL).trim();
      if (nextAvatar === "" && user.avatarURL) {
        tryDeleteLocalAvatarFile(user.avatarURL);
      }
      user.avatarURL = nextAvatar;
    }
    if (address !== undefined) {
      user.address = String(address).trim();
    }
    if (telephone !== undefined) {
      user.telephone = String(telephone).trim();
    }
    await user.save();
    return res.status(200).json({ success: true, message: "Profile updated.", data: formatUser(user) });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password (min 6 chars) are required.",
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return res.status(400).json({ success: false, message: "Current password is incorrect." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    const fresh = await User.findById(user._id).select("-password");
    const token = generateToken({
      id: fresh._id,
      role: fresh.role,
      tv: fresh.tokenVersion || 0,
    });

    return res.status(200).json({
      success: true,
      message: "Password updated. Use this session going forward.",
      data: { user: formatUser(fresh), token },
    });
  } catch (error) {
    next(error);
  }
};

const changeEmail = async (req, res, next) => {
  try {
    const { newEmail, currentPassword } = req.body;
    if (!newEmail || !currentPassword) {
      return res.status(400).json({
        success: false,
        message: "New email and current password are required.",
      });
    }

    const email = String(newEmail).toLowerCase().trim();
    const taken = await User.findOne({ email, _id: { $ne: req.user._id } });
    if (taken) {
      return res.status(409).json({ success: false, message: "That email is already in use." });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return res.status(400).json({ success: false, message: "Current password is incorrect." });
    }

    user.email = email;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    const fresh = await User.findById(user._id).select("-password");
    const token = generateToken({
      id: fresh._id,
      role: fresh.role,
      tv: fresh.tokenVersion || 0,
    });

    return res.status(200).json({
      success: true,
      message: "Email updated. Use this session going forward.",
      data: { user: formatUser(fresh), token },
    });
  } catch (error) {
    next(error);
  }
};

const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Avatar file is required." });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (user.avatarURL) {
      tryDeleteLocalAvatarFile(user.avatarURL);
    }

    const relPath = `/uploads/avatars/${req.file.filename}`;
    const absoluteUrl = `${req.protocol}://${req.get("host")}${relPath}`;

    user.avatarURL = absoluteUrl;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Avatar updated.",
      data: formatUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const deleteAvatar = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (user.avatarURL) {
      tryDeleteLocalAvatarFile(user.avatarURL);
    }
    user.avatarURL = "";
    await user.save();
    return res.status(200).json({
      success: true,
      message: "Profile photo removed.",
      data: formatUser(user),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  changeEmail,
  uploadAvatar,
  deleteAvatar,
};
