const express = require("express");
const {
  getProducts,
  getLowStockAlerts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getProducts);
router.get("/alerts/low-stock", protect, authorize("Admin", "Staff"), getLowStockAlerts);
router.get("/:id", protect, getProductById);

router.post("/", protect, authorize("Admin"), createProduct);
router.put("/:id", protect, authorize("Admin"), updateProduct);
router.delete("/:id", protect, authorize("Admin"), deleteProduct);

module.exports = router;
