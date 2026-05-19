
// server/controllers/tenantAuthController.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getTenantDB } = require("../config/tenantManager");
const getTenantModels = require("../models/tenantModels");
const Shop = require("../models/Shop");
const MasterUser = require("../models/MasterUser");
const { generateTenantUri } = require("../config/tenantUtils");

const router = express.Router();

exports.createTenantUser = async (req, res) => {
  try {
    const { shopname, username, password, email, role } = req.body;
    if (!shopname || !username || !password || !email)
      return res.status(400).json({ message: "Missing required fields" });

    const shop = await Shop.findOne({ shopname });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const tenantConn = await getTenantDB(shopname, shop.tenantDbUri);
    const { User } = getTenantModels(tenantConn);

    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const tenantUser = await User.create({ username, password, email, shopname, role: role || "user" });

    await MasterUser.create({ username, shopname, role: tenantUser.role, email });

    res.status(201).json({
      message: "Tenant user created",
      user: { username, email, role: tenantUser.role, shopname },
    });
  } catch (err) {
    console.error("❌ createTenantUser error:", err);
    res.status(500).json({ message: "User creation failed" });
  }
};

exports.loginTenantUser = async (req, res) => {
  try {
    const { shopname, username, password } = req.body;
    if (!shopname || !username || !password)
      return res.status(400).json({ message: "All fields required" });

    const shop = await Shop.findOne({ shopname });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const tenantConn = await getTenantDB(shopname, shop.tenantDbUri);
    const { User } = getTenantModels(tenantConn);

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id.toString(), shopname, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: { id: user._id, username: user.username, role: user.role, shopname } });
  } catch (err) {
    console.error("Tenant login error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------------
// Get Tenant Users (current shop from JWT)
// ------------------------
router.get("/", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Megaadmin/manager fetches all shops
    if (decoded.role === "megaadmin" || decoded.role === "manager") {
      const shops = await Shop.find({});
      const allUsers = [];

      for (const shop of shops) {
        const tenantConn = await getTenantDB(shop.shopname, shop.tenantDbUri || generateTenantUri(shop.shopname));
        const { User } = getTenantModels(tenantConn);
        const users = await User.find({});
        allUsers.push(...users.map(u => ({ ...u.toObject(), shopname: shop.shopname })));
      }

      return res.json(allUsers);
    }

    // Normal user: fetch users only from their shop
    const shop = await Shop.findOne({ shopname: decoded.shopname });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const tenantConn = await getTenantDB(shop.shopname, shop.tenantDbUri || generateTenantUri(shop.shopname));
    const { User } = getTenantModels(tenantConn);
    const users = await User.find({});
    res.json(users);
  } catch (err) {
    console.error("❌ Fetch tenant users error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------
// Admin switch user (megaadmin/manager)
// ------------------------
router.post("/switch", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!["megaadmin", "manager"].includes(decoded.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { shopname, username } = req.body;
    if (!shopname || !username) {
      return res.status(400).json({ message: "Shop and username required" });
    }

    const shop = await Shop.findOne({ shopname });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const tenantConn = await getTenantDB(shopname, shop.tenantDbUri || generateTenantUri(shopname));
    const { User } = getTenantModels(tenantConn);

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    const newToken = jwt.sign(
      { id: user._id.toString(), role: user.role, shopname },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token: newToken,
      user: { id: user._id, username: user.username, role: user.role, shopname },
    });
  } catch (err) {
    console.error("❌ Switch user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;