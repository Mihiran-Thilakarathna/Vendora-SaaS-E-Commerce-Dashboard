const bcrypt = require("bcryptjs");
const fs = require("fs");
const User = require("../models/User");
const Store = require("../models/Store");
const generateToken = require("../utils/generateToken");
const path = require("path");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const {
  normalizeEmail,
  isValidEmail,
  passwordProblem,
  createStoreWithOwner,
  hashPassword,
} = require("../utils/accounts");

/** Public demo accounts: one-click sign-in for portfolio visitors. */
const DEMO_ACCOUNTS = {
  Admin: (process.env.DEMO_ADMIN_EMAIL || "admin@vendora.com").toLowerCase(),
  Staff: (process.env.DEMO_STAFF_EMAIL || "staff@vendora.com").toLowerCase(),
};
const isDemoEnabled = () => String(process.env.DEMO_LOGIN_ENABLED || "true").toLowerCase() !== "false";
/** True for the shared demo accounts, whether or not one-click demo sign-in is switched on. */
const isDemoAccount = (user) => Object.values(DEMO_ACCOUNTS).includes(String(user?.email || "").toLowerCase());
/** Drives the "live demo" banner in the UI, so it only applies while the demo is offered. */
const isDemoUser = (user) => isDemoEnabled() && isDemoAccount(user);

let googleClient = null;
const getGoogleClient = () => {
  if (!process.env.GOOGLE_CLIENT_ID) return null;
  if (!googleClient) googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return googleClient;
};

/** `user.store` is a populated store document when available, otherwise just its id. */
const formatStore = (store) => {
  if (!store) return null;
  if (store.name === undefined) return { _id: store, name: "", isDemo: false };
  return { _id: store._id, name: store.name, isDemo: Boolean(store.isDemo) };
};

const formatUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatarURL: user.avatarURL || "",
  address: user.address || "",
  telephone: user.telephone || "",
  authProvider: user.authProvider || "local",
  isDemo: isDemoUser(user),
  store: formatStore(user.store),
});

const withStore = (user) => user.populate("store", "name isDemo");

const sessionResponse = async (res, user, message, status = 200) => {
  await withStore(user);
  const token = generateToken({ id: user._id, role: user.role, tv: user.tokenVersion || 0 });
  return res.status(status).json({
    success: true,
    message,
    data: { user: formatUser(user), token },
  });
};

const isDuplicateEmail = (error) => error?.code === 11000 && error?.keyPattern?.email;

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

/**
 * POST /auth/signup { name, email, password, storeName }
 * Public sign-up: creates a brand-new store and makes the caller its Admin.
 * Nobody can join an existing store this way; Admins add their team from the Team page.
 */
const signup = async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    const storeName = String(req.body?.storeName || "").trim();
    const email = normalizeEmail(req.body?.email);
    const { password } = req.body || {};

    if (!name || !email || !password || !storeName) {
      return res.status(400).json({
        success: false,
        message: "Your name, store name, email and password are required.",
      });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }
    const weak = passwordProblem(password);
    if (weak) return res.status(400).json({ success: false, message: weak });
    if (storeName.length > 80) {
      return res.status(400).json({ success: false, message: "Store name must be 80 characters or fewer." });
    }

    if (await User.exists({ email })) {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    const user = await createStoreWithOwner({
      storeName,
      user: { name, email, password: await hashPassword(password) },
    });
    return sessionResponse(res, user, "Your store is ready.", 201);
  } catch (error) {
    if (isDuplicateEmail(error)) {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }
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
    return sessionResponse(res, user, "Login successful.");
  } catch (error) {
    next(error);
  }
};

/** POST /auth/demo { role: "Admin" | "Staff" } — passwordless sign-in to the shared demo accounts. */
const demoLogin = async (req, res, next) => {
  try {
    if (!isDemoEnabled()) {
      return res.status(403).json({ success: false, message: "Demo access is disabled." });
    }
    const role = req.body?.role === "Staff" ? "Staff" : "Admin";
    const user = await User.findOne({ email: DEMO_ACCOUNTS[role] });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Demo account not found. Run `npm run seed` in the backend first.",
      });
    }
    await stripLegacyAvatarIfNeeded(user);
    return sessionResponse(res, user, `Signed in to the ${role} demo.`);
  } catch (error) {
    next(error);
  }
};

/** POST /auth/google { credential } — verifies a Google ID token; first-time users get their own store. */
const googleLogin = async (req, res, next) => {
  try {
    const client = getGoogleClient();
    if (!client) {
      return res.status(503).json({ success: false, message: "Google sign-in is not configured." });
    }
    const { credential } = req.body || {};
    if (!credential) {
      return res.status(400).json({ success: false, message: "Missing Google credential." });
    }

    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ success: false, message: "Google sign-in could not be verified." });
    }

    if (!payload?.email || !payload.email_verified) {
      return res.status(401).json({ success: false, message: "Your Google email is not verified." });
    }

    const email = payload.email.toLowerCase();
    let user = await User.findOne({ email }).select("+googleId");
    if (!user) {
      const name = payload.name || email.split("@")[0];
      user = await createStoreWithOwner({
        storeName: `${name}'s Store`.slice(0, 80),
        user: {
          name,
          email,
          password: await hashPassword(crypto.randomBytes(24).toString("hex")),
          authProvider: "google",
          googleId: payload.sub,
          avatarURL: payload.picture || "",
        },
      });
    } else if (!user.googleId) {
      user.googleId = payload.sub;
      if (!user.avatarURL && payload.picture) user.avatarURL = payload.picture;
      await user.save();
    }

    return sessionResponse(res, user, "Signed in with Google.");
  } catch (error) {
    next(error);
  }
};

/** GET /auth/config — tells the login page which sign-in options are available. */
const authConfig = (req, res) =>
  res.status(200).json({
    success: true,
    data: { demoEnabled: isDemoEnabled(), googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID) },
  });

/**
 * Demo credentials are public, so they must never be changeable, even after DEMO_LOGIN_ENABLED
 * is switched off (otherwise anyone with the published password could take the account over).
 * Covers the demo emails and anyone who belongs to the demo store.
 */
const blockDemoCredentialChange = async (req, res) => {
  const locked = isDemoAccount(req.user) || Boolean(await Store.exists({ _id: req.user.store, isDemo: true }));
  if (!locked) return false;
  res.status(403).json({
    success: false,
    message: "Demo accounts are shared, so their email and password can't be changed.",
  });
  return true;
};

const getMe = async (req, res, next) => {
  try {
    await stripLegacyAvatarIfNeeded(req.user);
    await withStore(req.user);
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
    const user = await User.findById(req.user._id).populate("store", "name isDemo");
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
    if (await blockDemoCredentialChange(req, res)) return undefined;
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

    const fresh = await User.findById(user._id).select("-password").populate("store", "name isDemo");
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
    if (await blockDemoCredentialChange(req, res)) return undefined;
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

    const fresh = await User.findById(user._id).select("-password").populate("store", "name isDemo");
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

    const user = await User.findById(req.user._id).populate("store", "name isDemo");
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
    const user = await User.findById(req.user._id).populate("store", "name isDemo");
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
  signup,
  login,
  demoLogin,
  googleLogin,
  authConfig,
  getMe,
  updateProfile,
  changePassword,
  changeEmail,
  uploadAvatar,
  deleteAvatar,
};
