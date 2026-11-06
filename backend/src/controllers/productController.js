const Product = require("../models/Product");

/** Fields a client may set on a product. `store` is never taken from the request. */
const EDITABLE_FIELDS = ["name", "description", "price", "costPrice", "stockQuantity", "category", "imageURL"];

const pickEditable = (body = {}) =>
  Object.fromEntries(EDITABLE_FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

const getProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ store: req.storeId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: products.length, data: products });
  } catch (error) {
    next(error);
  }
};

const LOW_STOCK_THRESHOLD = 10;

const getLowStockAlerts = async (req, res, next) => {
  try {
    const filter = { store: req.storeId, stockQuantity: { $lt: LOW_STOCK_THRESHOLD } };
    const [count, items] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .select("name stockQuantity category")
        .sort({ stockQuantity: 1 })
        .limit(10)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        threshold: LOW_STOCK_THRESHOLD,
        count,
        items,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, store: req.storeId });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }
    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const product = await Product.create({ ...pickEditable(req.body), store: req.storeId });
    return res.status(201).json({ success: true, message: "Product created.", data: product });
  } catch (error) {
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, store: req.storeId },
      pickEditable(req.body),
      { new: true, runValidators: true }
    );
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }
    return res.status(200).json({ success: true, message: "Product updated.", data: product });
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, store: req.storeId });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }
    return res.status(200).json({ success: true, message: "Product deleted." });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getLowStockAlerts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
