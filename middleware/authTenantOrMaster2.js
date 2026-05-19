const jwt = require("jsonwebtoken");
const Shop = require("../models/Shop");

const MASTER_JWT_SECRET = process.env.MASTER_JWT_SECRET || "supersecretkey";

module.exports = async function authTenantOrMaster(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Unauthorized - No token" });

    const decoded = jwt.verify(token, MASTER_JWT_SECRET);
    req.user = decoded;

    const shopnameHeader = req.headers["x-shopname"];

    // 🔹 If master/manager user → allow "all" access automatically
    if (["manager", "megaadmin"].includes(decoded.role)) {
      if (!shopnameHeader || shopnameHeader.toLowerCase() === "all") {
        req.isMasterAll = true;
        return next(); // skip tenant lookup
      }
    }

    // 🔹 Tenant shop lookup
    let shop;
    if (shopnameHeader) {
      shop = await Shop.findOne({ shopname: shopnameHeader.toLowerCase(), status: "active" });
      if (!shop) return res.status(404).json({ message: "Shop not found" });
    } else if (decoded.shop) {
      shop = await Shop.findById(decoded.shop);
      if (!shop) return res.status(404).json({ message: "Shop not found" });
    } else {
      return res.status(400).json({ message: "Missing shopname or tenant info" });
    }

    req.tenantShop = shop;
    next();
  } catch (err) {
    console.error("❌ authTenantOrMaster2 error:", err.message);
    res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};
