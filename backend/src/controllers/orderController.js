const Order = require("../models/Order");
const Product = require("../models/Product");
const { notifyStaffAdmins } = require("../utils/notifyStaffAdmins");

const getOrders = async (req, res, next) => {
  try {
    // Optional ?limit=N (1-100) for callers that only need the newest few, e.g. the dashboard.
    const limit = Math.min(100, Math.max(0, Number.parseInt(req.query.limit, 10) || 0));
    let query = Order.find({ store: req.storeId })
      .populate("items.product", "name price category imageURL")
      .populate("createdBy", "name email avatarURL role")
      .sort({ createdAt: -1 });
    if (limit) query = query.limit(limit);
    const orders = await query.lean();

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

const mergeOrderItems = (items) => {
  const merged = new Map();
  for (const item of items) {
    const id = String(item.product);
    const qty = Number(item.quantity);
    merged.set(id, (merged.get(id) || 0) + qty);
  }
  return [...merged.entries()].map(([product, quantity]) => ({ product, quantity }));
};

const createOrder = async (req, res, next) => {
  const actorId = req.user?._id;
  const adjustments = [];
  try {
    const { customerName, items, totalAmount, status, shippingAddress } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order must include at least one item.",
      });
    }

    const normalizedItems = mergeOrderItems(items);
    for (const row of normalizedItems) {
      if (!Number.isFinite(row.quantity) || row.quantity < 1) {
        return res.status(400).json({ success: false, message: "Each item needs a valid quantity." });
      }
    }

    const productIds = normalizedItems.map((i) => i.product);
    // Only products from the caller's own store can be ordered.
    const products = await Product.find({ _id: { $in: productIds }, store: req.storeId });
    if (products.length !== new Set(productIds).size) {
      return res.status(400).json({ success: false, message: "One or more products were not found." });
    }

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    let computedTotal = 0;
    for (const item of normalizedItems) {
      const p = productMap.get(String(item.product));
      if (!p) {
        return res.status(400).json({ success: false, message: "Invalid product in order." });
      }
      if (p.stockQuantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${p.name}" (available: ${p.stockQuantity}).`,
        });
      }
      computedTotal += p.price * item.quantity;
    }

    const clientTotal = Number(totalAmount);
    if (!Number.isFinite(clientTotal) || Math.abs(clientTotal - computedTotal) > 0.01) {
      return res.status(400).json({
        success: false,
        message: "Total amount does not match line items.",
      });
    }

    const allowedStatus = ["Pending", "Processing", "Shipped", "Delivered"];
    const nextStatus = status && allowedStatus.includes(status) ? status : "Pending";

    try {
      for (const item of normalizedItems) {
        const updated = await Product.findOneAndUpdate(
          { _id: item.product, store: req.storeId, stockQuantity: { $gte: item.quantity } },
          { $inc: { stockQuantity: -item.quantity } },
          { new: true }
        );
        if (!updated) {
          for (const adj of adjustments) {
            await Product.findByIdAndUpdate(adj.id, { $inc: { stockQuantity: adj.qty } });
          }
          return res.status(400).json({
            success: false,
            message: "Could not reserve stock. Please retry.",
          });
        }
        adjustments.push({ id: item.product, qty: item.quantity });
      }

      const order = await Order.create({
        store: req.storeId,
        customerName,
        items: normalizedItems,
        totalAmount: computedTotal,
        status: nextStatus,
        shippingAddress,
        createdBy: actorId || null,
      });

      const populated = await Order.findById(order._id)
        .populate("items.product", "name price category imageURL")
        .populate("createdBy", "name email avatarURL role");

      const amountLabel = `Rs. ${Number(computedTotal).toLocaleString("en-LK")}`;
      await notifyStaffAdmins({
        storeId: req.storeId,
        title: "New order",
        message: `${customerName} · ${amountLabel}`,
        type: "order",
        meta: { orderId: order._id.toString() },
      });

      return res.status(201).json({
        success: true,
        message: "Order created.",
        data: populated,
      });
    } catch (error) {
      for (const adj of adjustments) {
        await Product.findByIdAndUpdate(adj.id, { $inc: { stockQuantity: adj.qty } });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, store: req.storeId })
      .populate("items.product", "name price category imageURL")
      .populate("createdBy", "name email avatarURL role");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

const updateOrder = async (req, res, next) => {
  try {
    // Line items and totals are fixed once stock is reserved; only these fields can change.
    const updates = Object.fromEntries(
      ["customerName", "shippingAddress", "status"]
        .filter((k) => req.body?.[k] !== undefined)
        .map((k) => [k, req.body[k]])
    );
    const order = await Order.findOneAndUpdate({ _id: req.params.id, store: req.storeId }, updates, {
      new: true,
      runValidators: true,
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    return res.status(200).json({ success: true, message: "Order updated.", data: order });
  } catch (error) {
    next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ["Pending", "Processing", "Shipped", "Delivered"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value." });
    }

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, store: req.storeId },
      { status },
      { new: true, runValidators: true }
    )
      .populate("items.product", "name price category imageURL")
      .populate("createdBy", "name email avatarURL role");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    await notifyStaffAdmins({
      storeId: req.storeId,
      title: "Order status updated",
      message: `${order.customerName} → ${status}`,
      type: "order_status",
      meta: { orderId: order._id.toString(), status },
    });

    return res.status(200).json({
      success: true,
      message: "Order status updated.",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

const deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findOneAndDelete({ _id: req.params.id, store: req.storeId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    return res.status(200).json({ success: true, message: "Order deleted." });
  } catch (error) {
    next(error);
  }
};

/** Calendar date in the server's local timezone (YYYY-MM-DD). */
const localDateKey = (d) => {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const STATUS_BREAKDOWN_COLORS = {
  Pending: "#E1FB15",
  Processing: "#32D583",
  Shipped: "#94A3B8",
  Delivered: "#7C5CFC",
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toEndOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getOrderAnalytics = async (req, res, next) => {
  try {
    const now = new Date();
    const startParam = req.query.startDate ? new Date(String(req.query.startDate)) : null;
    const endParam = req.query.endDate ? new Date(String(req.query.endDate)) : null;

    if ((startParam && Number.isNaN(startParam.getTime())) || (endParam && Number.isNaN(endParam.getTime()))) {
      return res.status(400).json({
        success: false,
        message: "Invalid date range. Use YYYY-MM-DD format.",
      });
    }

    const windowStart = startParam
      ? toStartOfDay(startParam)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    const windowEnd = endParam ? toEndOfDay(endParam) : toEndOfDay(now);

    if (windowEnd < windowStart) {
      return res.status(400).json({
        success: false,
        message: "End date must be on or after start date.",
      });
    }

    const rangeDays = Math.floor((toStartOfDay(windowEnd).getTime() - windowStart.getTime()) / DAY_MS) + 1;
    const prevWindowEnd = new Date(windowStart.getTime() - 1);
    const prevWindowStart = new Date(windowStart.getTime() - rangeDays * DAY_MS);

    const [orders, prevWeekOrders, lowStockCount] = await Promise.all([
      Order.find({ store: req.storeId, createdAt: { $gte: windowStart, $lte: windowEnd } })
        .populate("items.product", "costPrice name price")
        .sort({ createdAt: 1 }),
      Order.find({
        store: req.storeId,
        createdAt: { $gte: prevWindowStart, $lte: prevWindowEnd },
      }).sort({ createdAt: 1 }),
      Product.countDocuments({ store: req.storeId, stockQuantity: { $lt: 10 } }),
    ]);

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const buckets = [];
    for (let i = 0; i < rangeDays; i += 1) {
      const day = new Date(windowStart);
      day.setDate(windowStart.getDate() + i);
      const key = localDateKey(day);
      const shortWeekday = dayNames[day.getDay()];
      const label = day.toLocaleDateString("en-LK", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      buckets.push({
        key,
        day: shortWeekday,
        label,
        sales: 0,
      });
    }
    const bucketMap = new Map(buckets.map((item) => [item.key, item]));

    let totalRevenue = 0;
    let totalCost = 0;
    let trackedCostLineItems = 0;
    let totalLineItems = 0;
    const topProductsMap = new Map();
    const statusCounts = {
      Pending: 0,
      Processing: 0,
      Shipped: 0,
      Delivered: 0,
    };

    orders.forEach((order) => {
      const amount = Number(order.totalAmount || 0);
      totalRevenue += amount;

      if (Object.prototype.hasOwnProperty.call(statusCounts, order.status)) {
        statusCounts[order.status] += 1;
      }

      const key = localDateKey(order.createdAt);
      if (bucketMap.has(key)) {
        bucketMap.get(key).sales += amount;
      }

      (order.items || []).forEach((item) => {
        const qty = Number(item.quantity || 0);
        if (qty <= 0) return;
        totalLineItems += qty;
        const unitCost = Number(item?.product?.costPrice || 0);
        const unitPrice = Number(item?.product?.price || 0);
        if (unitCost > 0) trackedCostLineItems += qty;
        totalCost += unitCost * qty;

        const productId = String(item?.product?._id || item.product || "");
        const productName = item?.product?.name || "Unknown product";
        if (!productId) return;
        const existing = topProductsMap.get(productId) || {
          productId,
          name: productName,
          quantitySold: 0,
          revenue: 0,
        };
        existing.quantitySold += qty;
        existing.revenue += unitPrice * qty;
        topProductsMap.set(productId, existing);
      });
    });

    let previousWeekRevenue = 0;
    prevWeekOrders.forEach((order) => {
      previousWeekRevenue += Number(order.totalAmount || 0);
    });

    const ordersCount = orders.length;
    const avgOrderValue = ordersCount > 0 ? Math.round(totalRevenue / ordersCount) : 0;
    const grossProfit = totalRevenue - totalCost;
    const grossMarginPercent =
      totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 1000) / 10 : null;
    const costCoveragePercent =
      totalLineItems > 0 ? Math.round((trackedCostLineItems / totalLineItems) * 1000) / 10 : 0;

    let weekOverWeekChangePercent = null;
    if (previousWeekRevenue > 0) {
      weekOverWeekChangePercent =
        Math.round(((totalRevenue - previousWeekRevenue) / previousWeekRevenue) * 1000) / 10;
    }

    const salesTrendData = buckets.map((item) => ({
      day: item.day,
      label: item.label,
      dateKey: item.key,
      sales: item.sales,
    }));

    const statusBreakdown = ["Pending", "Processing", "Shipped", "Delivered"]
      .map((status) => ({
        name: status,
        count: statusCounts[status],
        color: STATUS_BREAKDOWN_COLORS[status],
      }))
      .filter((row) => row.count > 0);
    const topSellingProducts = [...topProductsMap.values()]
      .sort((a, b) => b.quantitySold - a.quantitySold || b.revenue - a.revenue)
      .slice(0, 5);

    return res.status(200).json({
      success: true,
      data: {
        salesTrendData,
        totalRevenue,
        previousWeekRevenue,
        weekOverWeekChangePercent,
        ordersCount,
        avgOrderValue,
        totalCost,
        grossProfit,
        grossMarginPercent,
        costCoveragePercent,
        lowStockCount,
        statusBreakdown,
        topSellingProducts,
        periodLabel: `${localDateKey(windowStart)} → ${localDateKey(windowEnd)}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrders,
  createOrder,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  getOrderAnalytics,
};
