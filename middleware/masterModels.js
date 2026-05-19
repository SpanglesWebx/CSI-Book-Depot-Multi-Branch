// const { getTenantDB } = require("../config/tenantManager");
// const Product = require("../models/Product");
// const Category = require("../models/Category");

// module.exports = async (req, res, next) => {
//   try {
//     const shopId = req.params.shopId;
//     if (!shopId) return res.status(400).json({ message: "Missing shopId" });

//     // Map shopId → shopname (if needed)
//     const shopname = shopId;

//     // Connect to that shop's DB
//     const conn = await getTenantDB(shopname);

//     // Attach models to request
//     req.masterModels = {
//       Product: conn.model("Product", Product.schema),
//       Category: conn.model("Category", Category.schema),
//     };

//     next();
//   } catch (err) {
//     console.error("masterModels middleware error:", err);
//     res.status(500).json({ message: "Failed to attach master models" });
//   }
// };




const { getTenantDB } = require("../config/tenantManager");
const Product = require("../models/Product");
const Category = require("../models/Category");

module.exports = async (req, res, next) => {
  try {
    const shopId = req.params.shopId;
    if (!shopId) return res.status(400).json({ message: "Missing shopId" });

    // Map shopId → shopname (if needed)
    const shopname = shopId;

    // Connect to that shop's DB
    const conn = await getTenantDB(shopname);

    // Attach models to request
    req.masterModels = {
      Product: conn.model("Product", Product.schema),
      Category: conn.model("Category", Category.schema),
    };

    next();
  } catch (err) {
    console.error("masterModels middleware error:", err);
    res.status(500).json({ message: "Failed to attach master models" });
  }
};
