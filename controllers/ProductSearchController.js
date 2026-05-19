//  import Product from "../models/Product"

 const { model: Product } = require("../models/Product");

/** Utility: Escape regex special chars to avoid injection **/
const escapeRegex = (text = "") => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 🔍 Search products by NAME or SHORT NAME
 * Example: GET /api/search-products/search?name=pen
 */
exports.searchProductsByName = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ message: "Name query is required" });
    }

    // ✅ Use tenant model instead of global Product
    const Product = req.tenantModels?.Product;
    if (!Product) {
      return res.status(400).json({ message: "Tenant Product model not found" });
    }

    const regex = new RegExp(escapeRegex(name), "i");

    const products = await Product.find({
      $or: [{ name: { $regex: regex } }, { shortName: { $regex: regex } }],
    })
      .select("code name shortName category minQty batches")
      .lean();

    if (!products.length) {
      return res.status(404).json({ message: "No products found" });
    }

    res.json(products);
  } catch (err) {
    console.error("❌ Product name search error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * 🔢 Search products by CODE
 * Example: GET /api/search-products/search-by-code?code=P01
 */
exports.searchProductsByCode = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ message: "Code query is required" });
    }

    const Product = req.tenantModels?.Product;
    if (!Product) {
      return res.status(400).json({ message: "Tenant Product model not found" });
    }

    const regex = new RegExp(escapeRegex(code), "i");

    const products = await Product.find({
      code: { $regex: regex },
    })
      .select("code name shortName category minQty batches")
      .lean();

    if (!products.length) {
      return res.status(404).json({ message: "No products found" });
    }

    res.json(products);
  } catch (err) {
    console.error("❌ Product code search error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
