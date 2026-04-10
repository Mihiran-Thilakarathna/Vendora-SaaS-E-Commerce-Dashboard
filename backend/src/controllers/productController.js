const Product = require("../models/Product");

const getProducts = async (req, res, next) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: products.length, data: products });
  } catch (error) {
    next(error);
  }
};

const LOW_STOCK_THRESHOLD = 10;

const getLowStockAlerts = async (req, res, next) => {
  try {
    const filter = { stockQuantity: { $lt: LOW_STOCK_THRESHOLD } };
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
    const product = await Product.findById(req.params.id);
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
    const { name, description, price, costPrice, stockQuantity, category, imageURL } = req.body;
    const product = await Product.create({
      name,
      description,
      price,
      costPrice,
      stockQuantity,
      category,
      imageURL,
    });
    return res.status(201).json({ success: true, message: "Product created.", data: product });
  } catch (error) {
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
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
    const product = await Product.findByIdAndDelete(req.params.id);
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
