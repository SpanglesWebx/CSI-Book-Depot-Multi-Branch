// server/routes/tenantAuthRoutes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Shop = require("../models/Shop");
const { getTenantDB } = require("../config/tenantManager");
const getTenantModels = require("../models/tenantModels");

const router = express.Router();

function generateTenantToken(user, shopname, counter) {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      role: user.role,
      shopname,
      counter,
      type: "tenant",
    },
    process.env.TENANT_JWT_SECRET,
    { expiresIn: "7d" }
  );
}

router.post("/register", async (req, res) => {
  try {
    const { shopname, username, password, email, role } = req.body;
    if (!shopname || !username || !password || !email)
      return res.status(400).json({ message: "All fields required" });

    const shop = await Shop.findOne({ shopname });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const tenantConn = await getTenantDB(shopname, shop.tenantDbUri);
    const { User } = getTenantModels(tenantConn);

    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const user = await User.create({
      username,
      email,
      password,
      role: role || "user",
      shopname,
      status: "active",
    });

    const token = generateTenantToken(user, shopname);

    res.status(201).json({ message: "Tenant user registered", user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===============================
//      TENANT LOGIN
// ===============================



router.post("/login", async (req, res) => {
  try {
    const { shopname, username, password, counter } = req.body;
    if (!shopname || !username || !password)
      return res.status(400).json({ message: "All fields required" });

    const shop = await Shop.findOne({ shopname });
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    if (!counter) {
  return res.status(400).json({
    message: "Counter required",
  });
}

if (Number(counter) > Number(shop.counters)) {
  return res.status(400).json({
    message: "Invalid counter",
  });
}

    const tenantConn = await getTenantDB(shopname, shop.tenantDbUri);
    const { User } = getTenantModels(tenantConn);

    const user = await User.findOne({ username });
    if (!user)
      return res.status(401).json({ message: "Invalid username or password" });

    if (user.status !== "active") {
      return res.status(403).json({
        message: "Your account is inactive. Please contact the administrator.",
      });
    }

    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid username or password" });
    }



    const token = generateTenantToken(user, shopname);

    res.json({
  message: "Login successful",
  user: {
    id: user._id,
    username: user.username,
    role: user.role,
    shopname,
    counter: Number(counter),
    status: user.status,
  },
  token,
});

  } catch (err) {
    console.error("Tenant login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
