
//controllers/masterAuthControllers.js
const express = require("express");
const router = express.Router();
const MasterUser = require("../models/MasterUser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const { getTenantDB } = require("../config/masterDB");

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const masterUser = await MasterUser.findOne({ username });
    if (!masterUser) return res.status(404).json({ message: "User not found" });

    //  const isMatch = await masterUser.matchPassword(password);
    // if (!isMatch) return res.status(401).json({ message: "Invalid password" });


    const isMatch = await bcrypt.compare(password, masterUser.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    // Check tenant DB
    const tenantConn = await getTenantDB(masterUser.shopname);
    const TenantUser = tenantConn.model("User", require("../models/ModelUser"));
    const tenantUser = await TenantUser.findOne({ username });
    if (!tenantUser) return res.status(400).json({ message: "Tenant user missing" });

    const token = jwt.sign(
      { id: masterUser._id, username, role: masterUser.role, shopname: masterUser.shopname },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: masterUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
