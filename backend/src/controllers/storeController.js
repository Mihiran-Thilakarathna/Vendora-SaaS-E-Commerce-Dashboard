const Store = require("../models/Store");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { normalizeEmail, isValidEmail, passwordProblem, hashPassword } = require("../utils/accounts");

const ROLES = ["Admin", "Staff"];

const formatMember = (user, store, me) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatarURL: user.avatarURL || "",
  authProvider: user.authProvider || "local",
  createdAt: user.createdAt,
  isOwner: String(store.owner) === String(user._id),
  isYou: String(me._id) === String(user._id),
});

const loadStore = (req) => Store.findById(req.storeId);

/** The shared demo store is visited by many people at once, so its team and name stay fixed. */
const rejectDemo = (store, res) => {
  if (!store?.isDemo) return false;
  res.status(403).json({
    success: false,
    message: "Team and store settings are locked in the shared demo. Sign up to create your own store.",
  });
  return true;
};

/** GET /store — the signed-in user's store. */
const getStore = async (req, res, next) => {
  try {
    const store = await loadStore(req);
    if (!store) return res.status(404).json({ success: false, message: "Store not found." });
    const memberCount = await User.countDocuments({ store: store._id });
    return res.status(200).json({
      success: true,
      data: { _id: store._id, name: store.name, isDemo: store.isDemo, createdAt: store.createdAt, memberCount },
    });
  } catch (error) {
    next(error);
  }
};

/** PATCH /store { name } — Admin renames the store. */
const updateStore = async (req, res, next) => {
  try {
    const store = await loadStore(req);
    if (!store) return res.status(404).json({ success: false, message: "Store not found." });
    if (rejectDemo(store, res)) return undefined;

    const name = String(req.body?.name || "").trim();
    if (!name || name.length > 80) {
      return res.status(400).json({ success: false, message: "Store name must be 1 to 80 characters." });
    }
    store.name = name;
    await store.save();
    return res.status(200).json({
      success: true,
      message: "Store renamed.",
      data: { _id: store._id, name: store.name, isDemo: store.isDemo },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /store/members — everyone in the caller's store. */
const listMembers = async (req, res, next) => {
  try {
    const store = await loadStore(req);
    if (!store) return res.status(404).json({ success: false, message: "Store not found." });
    const users = await User.find({ store: store._id }).sort({ role: 1, createdAt: 1 });
    return res.status(200).json({ success: true, data: users.map((u) => formatMember(u, store, req.user)) });
  } catch (error) {
    next(error);
  }
};

/** POST /store/members { name, email, role, password } — Admin adds a teammate with a starting password. */
const addMember = async (req, res, next) => {
  try {
    const store = await loadStore(req);
    if (!store) return res.status(404).json({ success: false, message: "Store not found." });
    if (rejectDemo(store, res)) return undefined;

    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const role = ROLES.includes(req.body?.role) ? req.body.role : "Staff";
    const { password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and a starting password are required." });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }
    const weak = passwordProblem(password);
    if (weak) return res.status(400).json({ success: false, message: weak });

    // Emails are global: one account belongs to one store.
    if (await User.exists({ email })) {
      return res.status(409).json({ success: false, message: "That email already has a Vendora account." });
    }

    const user = await User.create({
      store: store._id,
      name,
      email,
      role,
      password: await hashPassword(password),
      tokenVersion: 0,
    });
    return res.status(201).json({
      success: true,
      message: `${user.name} was added as ${user.role}.`,
      data: formatMember(user, store, req.user),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "That email already has a Vendora account." });
    }
    next(error);
  }
};

/** Finds a member of the caller's store and applies the rules shared by role change and removal. */
const loadEditableMember = async (req, res, verb) => {
  const store = await loadStore(req);
  if (!store) {
    res.status(404).json({ success: false, message: "Store not found." });
    return null;
  }
  if (rejectDemo(store, res)) return null;

  // Scoped by store: an id from another store simply isn't found.
  const member = await User.findOne({ _id: req.params.id, store: store._id }).catch(() => null);
  if (!member) {
    res.status(404).json({ success: false, message: "Team member not found." });
    return null;
  }
  if (String(member._id) === String(req.user._id)) {
    res.status(400).json({ success: false, message: `You can't ${verb} yourself.` });
    return null;
  }
  if (String(store.owner) === String(member._id)) {
    res.status(403).json({ success: false, message: `The store owner can't be ${verb === "remove" ? "removed" : "changed"}.` });
    return null;
  }
  return { store, member };
};

/** PATCH /store/members/:id { role } — Admin changes a teammate's role. */
const updateMemberRole = async (req, res, next) => {
  try {
    const role = req.body?.role;
    if (!ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: "Role must be Admin or Staff." });
    }
    const found = await loadEditableMember(req, res, "change the role of");
    if (!found) return undefined;
    const { store, member } = found;

    if (member.role !== role) {
      member.role = role;
      // Sign them out so their next session carries the new permissions.
      member.tokenVersion = (member.tokenVersion || 0) + 1;
      await member.save();
    }
    return res.status(200).json({
      success: true,
      message: `${member.name} is now ${role}.`,
      data: formatMember(member, store, req.user),
    });
  } catch (error) {
    next(error);
  }
};

/** DELETE /store/members/:id — Admin removes a teammate. Orders they created are kept. */
const removeMember = async (req, res, next) => {
  try {
    const found = await loadEditableMember(req, res, "remove");
    if (!found) return undefined;
    const { member } = found;

    await Promise.all([
      User.deleteOne({ _id: member._id }),
      Notification.deleteMany({ user: member._id }),
    ]);
    return res.status(200).json({ success: true, message: `${member.name} was removed from the store.` });
  } catch (error) {
    next(error);
  }
};

module.exports = { getStore, updateStore, listMembers, addMember, updateMemberRole, removeMember };
