


// routes/shopRoutes.js
const express = require("express");
const router = express.Router();
const masterAuth = require("../middleware/masterAuth");
const {
  createShop,
  getShops,
  updateShopStatus,
  getShopById,
  
updateShop,
} = require("../controllers/shopController");

const { verifyMaster } = require("../middleware/authMiddleware");
const Shop = require("../models/Shop");

// -------------------------
// Protected routes (require masterAuth)
// -------------------------
router.post("/", masterAuth, createShop);               // Create a new shop
router.get("/", masterAuth, getShops);                 // Get all shops
router.get("/:id", masterAuth, getShopById);           // Get single shop by ID
// router.patch("/:id/status", masterAuth, updateShopStatus); // Update shop status
router.put("/edit/:id", masterAuth, updateShop);



// Get all master shops
router.get("/", verifyMaster, async (req, res) => {
  try {
    const shops = await Shop.find().sort({ shopname: 1 });
    res.json(shops);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch shops", error: err.message });
  }
});



// -------------------------
// Public route: get shop by shopname (for normal user login)
// -------------------------
router.get("/byname/:shopname", async (req, res) => {
  try {
    const { shopname } = req.params;
    const shop = await Shop.findOne({ shopname: shopname.trim().toLowerCase() }).lean();
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    // Only return designation
    res.json({ designation: shop.designation || "" });
  } catch (err) {
    console.error("❌ get shop by name error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;


