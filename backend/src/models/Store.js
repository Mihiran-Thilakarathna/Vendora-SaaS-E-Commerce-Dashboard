const mongoose = require("mongoose");

/**
 * A tenant. Every user, product, order and notification belongs to exactly one store,
 * and every query is scoped to the signed-in user's store.
 */
const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Store", storeSchema);
