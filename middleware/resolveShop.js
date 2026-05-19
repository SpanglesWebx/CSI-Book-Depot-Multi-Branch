// middleware: resolveShop.js
const Shop = require("../models/Shop");

async function resolveShop(req, res, next) {
  const shopname = req.params.shopname?.trim().toLowerCase();
  if (!shopname) return res.status(400).json({ message: "shopname param missing" });

  const shop = await Shop.findOne({ shopname });
  if (!shop) return res.status(404).json({ message: `Shop '${shopname}' not found` });

  req.shop = shop; // attach shop to request
  next();
}

module.exports = resolveShop;
