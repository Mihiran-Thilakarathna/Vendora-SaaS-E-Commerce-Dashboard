const express = require("express");
const {
  getStore,
  updateStore,
  listMembers,
  addMember,
  updateMemberRole,
  removeMember,
} = require("../controllers/storeController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", getStore);
router.patch("/", authorize("Admin"), updateStore);

router.get("/members", authorize("Admin"), listMembers);
router.post("/members", authorize("Admin"), addMember);
router.patch("/members/:id", authorize("Admin"), updateMemberRole);
router.delete("/members/:id", authorize("Admin"), removeMember);

module.exports = router;
