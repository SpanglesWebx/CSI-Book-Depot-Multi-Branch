



// routes/shopPublicRoutes.js
const express = require("express");
const router = express.Router();
const Shop = require("../models/Shop");
const getTenantModels = require("../models/tenantModels");
const { getTenantDB } = require("../config/tenantManager");

/**
 * Public route: find shop by tenant username
 * GET /api/shops/public/findByUsername/:username
 */

router.get("/findByUsername/:username", async (req, res) => {
  try {
    const { username } = req.params;

    // Fetch all shops from master DB
    const shops = await Shop.find({});

    for (const shop of shops) {
      if (!shop.tenantDbUri) continue; // skip shops without tenant DB

      const tenantConn = await getTenantDB(shop.shopname, shop.tenantDbUri);
      const { User } = getTenantModels(tenantConn);

      const user = await User.findOne({ username });
      if (user) {
        // Include address and contact
        return res.json({
          shopId: shop._id,
          shopname: shop.shopname,
          address: shop.address || "N/A",
          contact: shop.contact || "N/A",
          tenantDbUri: shop.tenantDbUri,
        });
      }
    }

    return res.status(404).json({ message: "User not found in any shop" });
  } catch (err) {
    console.error("Public shop lookup error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;



