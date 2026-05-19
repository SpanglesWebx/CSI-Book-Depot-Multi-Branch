// routes/masterUser.js
const express = require("express");
const router = express.Router();
const MasterUser = require("../models/MasterUser");
const Shop = require("../models/Shop");

// Utility function to build tenant URI
function generateTenantUri(shopname) {
  const baseUri = process.env.TENANT_DB_URI; 

  return `${baseUri}/${shopname}_db`; 
}

// Create a new master user + shop
router.post("/", async (req, res) => {
  try {
    const { username, email, password, role, shopname } = req.body;

    // 1. Check if user already exists
    const existingUser = await MasterUser.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 2. Check if shop already exists
    const existingShop = await Shop.findOne({ shopname });
    if (existingShop) {
      return res.status(400).json({ message: "Shop already exists" });
    }

    // 3. Generate tenant DB URI
    const tenantDbUri = generateTenantUri(shopname);

    // 4. Save shop in master DB
    await Shop.create({ shopname, tenantDbUri });

    // 5. Create master user linked to shop
    const newUser = await MasterUser.create({
      username,
      email,
      password,
      role,
      shopname,
      tenantDbUri
    });

    res.status(201).json({ message: "User & Shop created", user: newUser });
  } catch (error) {
    console.error("Create MasterUser Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
