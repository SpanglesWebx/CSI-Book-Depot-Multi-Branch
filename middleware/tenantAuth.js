// server/middleware/tenantAuth.js
const jwt = require("jsonwebtoken");
const Shop = require("../models/Shop");
const { getTenantDB } = require("../config/tenantManager");
const getTenantModels = require("../models/tenantModels");
const MasterUser = require("../models/MasterUser");

module.exports = async (req, res, next) => {
  try {
    // 1️⃣ Check Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized - No token" });
    }

    const token = authHeader.split(" ")[1];

    // 2️⃣ Verify tenant JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.TENANT_JWT_SECRET);
    } catch (err) {
      console.error("JWT verify error:", err.message);
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }

    if (decoded.type !== "tenant") {
      return res.status(401).json({ message: "Unauthorized - Invalid tenant token" });
    }

    const userId = decoded.id;
    const shopname = req.headers["x-shopname"] || decoded.shopname;

    if (!userId || !shopname) {
      return res.status(401).json({ message: "Unauthorized - Missing user or shop context" });
    }

    // 3️⃣ Ensure shop exists
    const shop = await Shop.findOne({ shopname });
    if (!shop) {
      return res.status(404).json({ message: `Shop '${shopname}' not found` });
    }

    // 4️⃣ Connect to tenant DB
    let tenantConn;
    try {
      tenantConn = await getTenantDB(shopname, shop.tenantDbUri);
    } catch (err) {
      console.error("Tenant DB connection error:", err);
      return res.status(500).json({ message: "Failed to connect to tenant database" });
    }

    // 5️⃣ Load tenant models
    const { User, Product, Order, SalesBill, Customer, Supplier,  Purchase, Expense,   Counter    } = getTenantModels(tenantConn);

    // 6️⃣ Ensure user exists in tenant DB (sync from master if missing)
    let user = await User.findById(userId);
    if (!user) {
      const masterUser = await MasterUser.findById(userId);
      if (!masterUser) {
        return res.status(401).json({ message: "User not found in master DB" });
      }

      user = await User.create({
        _id: masterUser._id,
        username: masterUser.username,
        role: masterUser.role,
        email: masterUser.email,
      });
    }

    // 7️⃣ Attach user and tenant info to request
    req.user = {
      id: user._id,
      username: user.username,
      role: user.role,
      shopname,
      shopId: shop._id,
    };
    req.shop = shop;
    req.tenant = tenantConn;
    req.tenantModels = { User, Product, Order, SalesBill, Customer, Supplier , Purchase, Expense,   Counter   };

    console.log("✅ tenantAuth successful:", req.user);

    next();
  } catch (err) {
    console.error("❌ tenantAuth unexpected error:", err);
    res.status(500).json({ message: "Internal server error in tenantAuth" });
  }
};
