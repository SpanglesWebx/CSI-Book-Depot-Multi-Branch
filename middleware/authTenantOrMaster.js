// server/middleware/authTenantOrMaster.js

const jwt = require("jsonwebtoken");
const Shop = require("../models/Shop");
const MasterUser = require("../models/MasterUser");
const { getTenantDB } = require("../config/tenantManager");
const getTenantModels = require("../models/tenantModels");

module.exports = async (req, res, next) => {
  try {
    // -----------------------------
    // 1️⃣ Validate Authorization Header
    // -----------------------------
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    let tokenType;

    // -----------------------------
    // 2️⃣ Verify Token (Tenant → Master fallback)
    // -----------------------------
    // try {
    //   decoded = jwt.verify(token, process.env.TENANT_JWT_SECRET);
    //   tokenType = "tenant";
    // } catch {
    //   try {
    //     decoded = jwt.verify(token, process.env.MASTER_JWT_SECRET);
    //     tokenType = "master";
    //   } catch {
    //     return res.status(401).json({ message: "Unauthorized - Invalid token" });
    //   }
    // }


    try {
  decoded = jwt.verify(token, process.env.TENANT_JWT_SECRET);
  tokenType = "tenant";
} catch (err) {

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ 
      message: "Token expired",
      expired: true 
    });
  }

  try {
    decoded = jwt.verify(token, process.env.MASTER_JWT_SECRET);
    tokenType = "master";
  } catch (err2) {

    if (err2.name === "TokenExpiredError") {
      return res.status(401).json({ 
        message: "Token expired",
        expired: true 
      });
    }

    return res.status(401).json({ 
      message: "Invalid token",
      invalid: true 
    });
  }
}


    // -----------------------------
    // 3️⃣ Resolve shopname
    // -----------------------------
    // const shopname = req.params.shopname || req.headers["x-shopname"];
    // if (!shopname) {
    //   return res.status(400).json({ message: "Missing shopname (path or header)" });
    // }



    // ✅ Allow master access for global reports (no shopname required)
    const shopname = req.params.shopname || req.headers["x-shopname"];

    // ✅ If no shopname → allow only master users (for global reports)
    if (!shopname) {
      if (tokenType === "master") {
        req.authType = "master";
        return next(); // skip tenant connection
      }
      return res.status(400).json({ message: "Missing shopname (path or header)" });
    }


    // -----------------------------
    // 4️⃣ Find the shop in master DB
    // -----------------------------
    const shop = await Shop.findOne({ shopname });
    if (!shop) {
      return res.status(404).json({ message: `Shop '${shopname}' not found` });
    }

    // -----------------------------
    // 5️⃣ Connect to tenant DB
    // -----------------------------
    const tenantConn = await getTenantDB(shopname, shop.tenantDbUri);
    const tenantModels = getTenantModels(tenantConn);

    req.shop = shop;
    req.tenant = tenantConn;
    req.tenantModels = tenantModels;

    // -----------------------------
    // 6️⃣ Handle tenant token
    // -----------------------------
    if (tokenType === "tenant") {
      req.authType = "tenant";
      req.user = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role,
        shopname,
        shopId: shop._id,
      };
      console.log(`✅ Tenant access: ${decoded.username} → ${shopname}`);
    }

    // -----------------------------
    // 7️⃣ Handle master token
    // -----------------------------
    else if (tokenType === "master") {
      const masterUser = await MasterUser.findById(decoded.id);
      if (!masterUser) {
        return res.status(401).json({ message: "Master user not found" });
      }

      req.authType = "master";
      req.user = {
        id: masterUser._id,
        username: masterUser.username,
        role: masterUser.role,
        shopname,
        shopId: shop._id,
      };
      console.log(`✅ Master access (${masterUser.role}) → ${shopname}`);
    }

    // -----------------------------
    // 8️⃣ Continue to next middleware
    // -----------------------------
    next();
  } catch (err) {
    console.error("❌ authTenantOrMaster error:", err);
    res.status(500).json({ message: "Server error in authTenantOrMaster" });
  }
};

