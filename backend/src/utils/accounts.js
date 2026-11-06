const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Store = require("../models/Store");
const User = require("../models/User");

const MIN_PASSWORD_LENGTH = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email) => String(email || "").toLowerCase().trim();
const isValidEmail = (email) => EMAIL_RE.test(email);

/** Returns an error message, or null when the password is acceptable. */
const passwordProblem = (password) =>
  typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH
    ? null
    : `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;

/**
 * Creates a new store and its first Admin in one go. Used by email sign-up and by
 * first-time Google sign-in. If the user can't be created (e.g. the email was taken
 * a moment ago) the store is removed again so no orphan is left behind.
 */
const createStoreWithOwner = async ({ storeName, user }) => {
  const userId = new mongoose.Types.ObjectId();
  const store = await Store.create({ name: storeName, owner: userId });
  try {
    return await User.create({ ...user, _id: userId, store: store._id, role: "Admin", tokenVersion: 0 });
  } catch (error) {
    await Store.deleteOne({ _id: store._id });
    throw error;
  }
};

const hashPassword = (password) => bcrypt.hash(password, 10);

module.exports = {
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  isValidEmail,
  passwordProblem,
  createStoreWithOwner,
  hashPassword,
};
