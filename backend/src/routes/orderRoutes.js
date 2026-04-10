const express = require("express");
const {
  getOrders,
  createOrder,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  getOrderAnalytics,
} = require("../controllers/orderController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Both Admin and Staff can view orders
router.get("/", protect, authorize("Admin", "Staff"), getOrders);
router.get("/analytics/summary", protect, authorize("Admin", "Staff"), getOrderAnalytics);
router.get("/:id", protect, authorize("Admin", "Staff"), getOrderById);

// Admin and Staff can create orders; stock is validated and decremented on the server
router.post("/", protect, authorize("Admin", "Staff"), createOrder);
router.put("/:id", protect, authorize("Admin"), updateOrder);
router.delete("/:id", protect, authorize("Admin"), deleteOrder);

// Admin and Staff can update status only
router.patch(
  "/:id/status",
  protect,
  authorize("Admin", "Staff"),
  updateOrderStatus
);

module.exports = router;
