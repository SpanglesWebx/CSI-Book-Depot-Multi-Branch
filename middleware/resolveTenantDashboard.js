// middleware/resolveTenantDashboard.js
const mongoose = require("mongoose");
const Shop = require("../models/Shop");
const getTenantModels = require("../models/tenantModels");

module.exports = async function resolveTenantDashboard(req, res, next) {
  try {
    const shopname = req.params.shopname?.trim();
    if (!shopname) return res.status(400).json({ message: "shopname param missing" });

    // Find the shop
    const shop = await Shop.findOne({ shopname: { $regex: `^${shopname}$`, $options: "i" } });
    if (!shop) return res.status(404).json({ message: `Shop '${shopname}' not found` });

    req.shop = shop;

    // Create/get tenant DB connection
    const dbName = `tenant_${shopname.toLowerCase()}`;
    if (!mongoose.connections.some(c => c.name === dbName)) {
      await mongoose.createConnection(process.env.MONGO_URI, {
        dbName,
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }
    const tenantConn = mongoose.connections.find(c => c.name === dbName);

    req.tenantModels = getTenantModels(tenantConn);
    next();
  } catch (err) {
    console.error("❌ resolveTenantDashboard error:", err);
    res.status(500).json({ message: "Failed to resolve shop", error: err.message });
  }
};
