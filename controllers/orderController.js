
 // controllers/orderController.js
const getNextOrderNo = require("../utils/getNextOrderNo");


// ✅ GET all orders with pagination & live filters
exports.getOrders = async (req, res) => {
  try {
    if (!req.shop?._id) {
      return res.status(400).json({ message: "Shop context missing" });
    }

    const { Order } = req.tenantModels;
    const shopId = req.shop._id;

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filters
    const { orderNo, productName, status, startDate, endDate } = req.query;

    // Base query
    const query = { shop: shopId };

    // 🔹 Combined live search: orderNo OR productName
    if (orderNo || productName) {
      const searchTerm = orderNo || productName;
      query.$or = [
        { orderNo: { $regex: searchTerm, $options: "i" } },
        { "items.name": { $regex: searchTerm, $options: "i" } },
      ];
    }

    // 🔹 Status filter
    if (status) query.status = status.toLowerCase();



    // ✅ Use createdAt for accurate date range filtering
if (startDate || endDate) {
  query.createdAt = {};
  if (startDate) query.createdAt.$gte = new Date(`${startDate}T00:00:00Z`);
  if (endDate) query.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
}



    // 🔹 Fetch total
    const totalDocs = await Order.countDocuments(query);

    // 🔹 Fetch paginated orders
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalDocs / limit);

    res.json({
      shop: { _id: shopId, shopname: req.shop.shopname },
      orders,
      totalDocs,
      page,
      limit,
      totalPages,
    });
  } catch (err) {
    console.error("getOrders error:", err);
    res.status(500).json({
      message: "Failed to fetch orders",
      error: err.message,
    });
  }
};





// GET single order
exports.getOrderById = async (req, res) => {
  try {
    const { Order } = req.tenantModels;
    const order = await Order.findOne({ _id: req.params.id, shop: req.shop._id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    console.error("getOrderById error:", err);
    res.status(500).json({ message: "Failed to fetch order", error: err.message });
  }
};

// CREATE new order (increments counter)
exports.createOrder = async (req, res) => {
  try {
    const { Order } = req.tenantModels;
    const shopname = req.shop?.shopname;
    if (!shopname) return res.status(400).json({ message: "Shop not found" });

    // 🔹 Increment only when creating an actual order
    const nextNo = await getNextOrderNo(shopname, true);

    const order = new Order({
      shop: req.shop._id,
      orderNo: nextNo,
      date: req.body.date,
      items: req.body.items,
      status: req.body.status || "placed",
    });

    const saved = await order.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("createOrder error:", err);
    res.status(500).json({ message: "Failed to create order", error: err.message });
  }
};

// PREVIEW next order number (no increment)
exports.previewNextOrderNo = async (req, res) => {
  try {
    if (!req.shop?.shopname)
      return res.status(400).json({ message: "Shop not found" });

    const nextNo = await getNextOrderNo(req.shop.shopname, false);
    res.json({ orderNo: nextNo });
  } catch (err) {
    console.error("previewNextOrderNo error:", err);
    res.status(500).json({ message: "Failed to preview next order number", error: err.message });
  }
};

// UPDATE order
exports.updateOrder = async (req, res) => {
  try {
    const { Order } = req.tenantModels;
    const updated = await Order.findOneAndUpdate(
      { _id: req.params.id, shop: req.shop._id },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Order not found" });
    res.json(updated);
  } catch (err) {
    console.error("updateOrder error:", err);
    res.status(500).json({ message: "Failed to update order", error: err.message });
  }
};

// CONFIRM order
exports.confirmOrder = async (req, res) => {
  try {
    const { Order } = req.tenantModels;
    const order = await Order.findOne({ _id: req.params.id, shop: req.shop._id });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status === "confirmed")
      return res.status(400).json({ message: "Already confirmed" });

    const now = new Date();
    order.status = "confirmed";
    order.confirmedAt = now;
    order.confirmedDate = now.toLocaleDateString("en-GB");

    await order.save();
    res.json(order);
  } catch (err) {
    console.error("confirmOrder error:", err);
    res.status(500).json({ message: "Failed to confirm order", error: err.message });
  }
};

// UPDATE order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { Order } = req.tenantModels;
    const { status } = req.body;

    const order = await Order.findOne({ _id: req.params.id, shop: req.shop._id });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const now = new Date();
    order.status = status;

    if (status === "confirmed") {
      order.confirmedAt = now;
      order.confirmedDate = now.toLocaleDateString("en-GB");
    } else if (status === "cancelled") {
      order.cancelledAt = now;
      order.cancelledDate = now.toLocaleDateString("en-GB");
    }

    await order.save();
    res.json(order);
  } catch (err) {
    console.error("updateOrderStatus error:", err);
    res.status(500).json({ message: "Failed to update order status", error: err.message });
  }
};

// DELETE order
exports.deleteOrder = async (req, res) => {
  try {
    const { Order } = req.tenantModels;
    const deleted = await Order.findOneAndDelete({ _id: req.params.id, shop: req.shop._id });
    if (!deleted) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("deleteOrder error:", err);
    res.status(500).json({ message: "Failed to delete order", error: err.message });
  }
};
