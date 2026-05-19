// controllers/shopController.js
const Shop = require("../models/Shop");
const { getTenantDB } = require("../config/tenantManager");

const createShop = async (req, res) => {
  try {
    const { shopname, designation, address, contact } = req.body;

    if (!shopname) {
      return res.status(400).json({ message: "Shop name required" });
    }

    // Check duplicate
    const existing = await Shop.findOne({ shopname });
    if (existing) {
      return res.status(400).json({ message: "Shop already exists" });
    }

    // Auto-generate tenant DB URI
    const tenantDbUri = `${process.env.TENANT_DB_URI}`; 
    // Do NOT append dbName here, handled in tenantManager

    // Create shop in Master DB
    const newShop = await Shop.create({
      shopname,
      designation,
      address,
      contact,
      tenantDbUri,
      status: "active",
    });

    // Init tenant DB (creates connection immediately)
    await getTenantDB(shopname, tenantDbUri);

    res.status(201).json({ message: "Shop created", shop: newShop });
  } catch (err) {
    console.error("❌ createShop error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// List all shops with search, status filter, and pagination
const getShops = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status = "" } = req.query;

    const query = {};

    // Search by shopname or designation (case-insensitive)
    if (search) {
      query.$or = [
        { shopname: { $regex: search, $options: "i" } },
        { designation: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Count total documents
    const total = await Shop.countDocuments(query);

    // Fetch shops with pagination
    const shops = await Shop.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      shops,
      
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error("❌ getShops error:", err);
    res.status(500).json({ message: "Server error" });
  }
};



// Update shop status
const updateShopStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const shop = await Shop.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!shop) return res.status(404).json({ message: "Shop not found" });

    res.json({ message: "Status updated", shop });
  } catch (err) {
    console.error("❌ updateShopStatus error:", err);
    res.status(500).json({ message: "Server error" });
  }
};



// ---------------------------------------------
// UPDATE FULL SHOP (name, contact, address, status)
// ---------------------------------------------
const updateShop = async (req, res) => {
  try {
    const { id } = req.params;
    const { contact, address, status } = req.body;

    const updates = {};

   

    if (contact !== undefined) updates.contact = contact;
    if (address !== undefined) updates.address = address;
    if (status !== undefined) updates.status = status;

    const shop = await Shop.findByIdAndUpdate(id, updates, { new: true });

    if (!shop) return res.status(404).json({ message: "Shop not found" });

    res.json({ message: "Shop updated", shop });
  } catch (err) {
    console.error("❌ updateShop error:", err);
    res.status(500).json({ message: "Server error" });
  }
};



// Get shop by id
// GET single shop by ID
const getShopById = async (req, res) => {
  try {
    const { id } = req.params;
    const shop = await Shop.findById(id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    res.json(shop);
  } catch (err) {
    console.error("❌ getShopById error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


module.exports = { createShop, getShops, updateShopStatus, updateShop,  getShopById };
