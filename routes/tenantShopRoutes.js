// routes/tenantShopRoutes.js
const express = require("express");
const router = express.Router();
const Shop = require("../models/Shop");
const { getTenantDB } = require("../config/tenantManager");
const getTenantModels = require("../models/tenantModels");
const jwt = require("jsonwebtoken");

// Middleware: Verify JWT and attach shopname
const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.shopname = decoded.shopname;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Fetch tenant data for a specific shop by ID
router.get("/:id/data", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const shop = await Shop.findById(id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const tenantConn = await getTenantDB(shop.shopname, shop.tenantDbUri);
    const { User, Product, Order, SalesBill, Customer, Category, Counter } = getTenantModels(tenantConn);

    // Query tenant data
    const users = await User.find({});
    const products = await Product.find({});
    const orders = await Order.find({});
    const salesBills = await SalesBill.find({});
    const customers = await Customer.find({});
    const categories = await Category.find({});

    res.json({ users, products, orders, salesBills, customers, categories });
  } catch (err) {
    console.error("Failed to fetch tenant shop data:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
