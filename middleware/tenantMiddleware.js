//server/middleware/tenantMiddleware.js


const jwt = require("jsonwebtoken");
const Shop = require("../models/Shop");
const { getTenantDB } = require("../config/tenantManager");
const getTenantModels = require("../models/tenantModels");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer "))
      return res.status(401).json({ message: "Unauthorized - No token provided" });

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.TENANT_JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Unauthorized - Invalid tenant token" });
    }

    if (decoded.type !== "tenant")
      return res.status(401).json({ message: "Unauthorized - Wrong token type" });

    const { id: userId, shopname } = decoded;

    const shop = await Shop.findOne({ shopname });
    if (!shop) return res.status(404).json({ message: `Shop '${shopname}' not found` });

    const tenantConn = await getTenantDB(shopname, shop.tenantDbUri);
    const { User } = getTenantModels(tenantConn);

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized - Tenant user not found" });

    req.user = { id: user._id, username: user.username, role: user.role, shopname };
       req.shop = shop;
    req.tenant = tenantConn;
    req.tenantModels = getTenantModels(tenantConn);

    next();
  } catch (err) {
    console.error("tenantMiddleware error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
