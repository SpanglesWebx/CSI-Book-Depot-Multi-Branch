

// server/routes/tenantDataRoutes.js
const express = require("express");
const Shop = require("../models/Shop");
const getNextOrderNo = require("../utils/getNextOrderNo");
const getNextBillNo = require("../utils/getNextBillNo");
const authTenantOrMaster = require("../middleware/authTenantOrMaster");
const getTenantModels = require("../models/tenantModels");
const mongoose = require("mongoose");

const router = express.Router();

// -------------------------
// Test route
// -------------------------
router.get("/", (req, res) => {
  res.json({ message: "Tenant routes are working!" });
});

// -------------------------
// Tenant collections helper (for admin/debug)
// -------------------------
const tenantCollections = [
  "User",
  "Product",
  "Customer",
  "Order",
  "SalesBill",
  "Category",
  "Counter",

];

// -------------------------
// Fetch all tenant data (master or tenant)
// -------------------------
router.get("/shops/:shopname", authTenantOrMaster, async (req, res) => {
  try {
    const result = {};
    for (const collection of tenantCollections) {
      if (req.tenantModels[collection]) {
        result[collection.toLowerCase()] = await req.tenantModels[collection]
          .find({ shop: req.shop._id })
          .sort({ createdAt: -1 });
      }
    }

    res.json({
      shop: { _id: req.shop?._id, shopname: req.shop?.shopname },
      data: result,
      accessedBy: req.authType,
    });
  } catch (err) {
    console.error("Fetch all tenant data error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------------
// Products CRUD
// -------------------------
router.get("/shops/:shopname/products", authTenantOrMaster, async (req, res) => {
  try {
    const { shopname } = req.params;

    // ---------------- LOAD TENANT MODEL ----------------
    let Product;
    let shopId;

    if (req.tenantModels) {
      Product = req.tenantModels.Product;
      shopId = req.shop?._id || req.user?.shopId || null;
    } else if (req.dbManager && req.dbManager.getTenantDb) {
      const tenantDb = req.dbManager.getTenantDb(shopname);
      if (!tenantDb)
        return res
          .status(404)
          .json({ message: `Shop '${shopname}' not found or inactive` });
      Product = tenantDb.model("Product");
    } else {
      return res
        .status(500)
        .json({ message: "Tenant DB manager not initialized" });
    }

    if (!Product)
      return res.status(400).json({ message: "Product model not found" });

    // ---------------- PARSE QUERY PARAMS ----------------
    const page = Math.max(1, Number(req.query.page) || 1);
    const limitParam = Number(req.query.limit);
    const limit = limitParam >= 0 ? limitParam : 5; // allow ?limit=0 → all
    const search = req.query.search?.trim() || "";
    const skip = (page - 1) * limit;


    const statusFilter = req.query.status || "all";

    // ---------------- BUILD QUERY ----------------
    const query = {};
    if (shopId) query.shop = shopId;

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { code: regex },
        { name: regex },
        { category: regex },
        { "batches.batchNo": regex },
      ];
    }


    // ⭐ NEW: Apply status filter
    if (statusFilter === "active") {
      query.status = "active";
    } else if (statusFilter === "disabled") {
      query.status = "disabled";
    }


    // ⭐ Apply taxMode filter (ALWAYS)
    const taxFilter = req.query.taxMode || "all";

    if (taxFilter === "inclusive") {
      query.taxMode = "inclusive";
    } else if (taxFilter === "exclusive") {
      query.taxMode = "exclusive";

    }
    // ---------------- COUNT + FETCH ----------------
    const totalProducts = await Product.countDocuments(query);

    // let productsQuery = Product.find(query).sort({ createdAt: -1 });

    // if (search) {
    //   // For searches → fetch all matches (limit 500 for safety)
    //   productsQuery = productsQuery.limit(500);
    // } else if (limit > 0) {
    //   productsQuery = productsQuery.skip(skip).limit(limit);
    // }



    // ✅ Fetch paginated or full result (when searching)
    let productsQuery = Product.find(query).sort({ status: 1, createdAt: -1 });
    if (search) {
      productsQuery = productsQuery.limit(500); // reasonable cap
    } else if (limit > 0) {
      productsQuery = productsQuery.skip(skip).limit(limit);
    }



    const products = await productsQuery.lean();

    // ---------------- STOCK SUMMARY ----------------
    let totalStock = 0;
    let lowStockCount = 0;

    try {
      const agg = await Product.aggregate([
        { $match: shopId ? { shop: new mongoose.Types.ObjectId(shopId) } : {} },
        { $unwind: "$batches" },
        {
          $group: {
            _id: null,
            totalStock: { $sum: "$batches.qty" },
            lowStockCount: {
              $sum: {
                $cond: [{ $lt: ["$batches.qty", "$minQty"] }, 1, 0],
              },
            },
          },
        },
      ]);
      totalStock = agg[0]?.totalStock || 0;
      lowStockCount = agg[0]?.lowStockCount || 0;
    } catch (aggErr) {
      console.warn("⚠️ Stock summary skipped:", aggErr.message);
    }

    // ---------------- RESPOND ----------------
    const totalPages = limit > 0 ? Math.ceil(totalProducts / limit) || 1 : 1;

    res.json({
      products,
      page,
      limit,
      totalPages,
      totalProducts,
      totalStock,
      lowStockCount,
      searchMode: !!search,
    });
  } catch (err) {
    console.error("❌ /shops/:shopname/products error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch products", error: err.message });
  }
});

// ---------------------------------------------
// LIST PURCHASES (tenant / manager / megaadmin)
// ---------------------------------------------
router.get("/shops/:shopname/purchases", authTenantOrMaster, async (req, res) => {
  try {
    const { shopname } = req.params;

    // ---------------- LOAD TENANT MODEL ----------------
    let Purchase;
    let shopId;

    if (req.tenantModels) {
      Purchase = req.tenantModels.Purchase;
      shopId = req.shop?._id || req.user?.shopId || null;
    }
    else if (req.dbManager && req.dbManager.getTenantDb) {
      const tenantDb = req.dbManager.getTenantDb(shopname);
      if (!tenantDb)
        return res.status(404).json({
          message: `Shop '${shopname}' not found or inactive`,
        });

      Purchase = tenantDb.model("Purchase");
    }
    else {
      return res.status(500).json({ message: "Tenant DB manager not initialized" });
    }

    if (!Purchase)
      return res.status(400).json({ message: "Purchase model not found" });

    // ---------------- PARSE QUERY PARAMS ----------------
    const page = Math.max(1, Number(req.query.page) || 1);
    const limitParam = Number(req.query.limit);
    const limit = limitParam >= 0 ? limitParam : 10; // allow limit=0 → fetch ALL
    const search = req.query.search?.trim() || "";
    const skip = (page - 1) * limit;

    // ---------------- BUILD QUERY ----------------
    const query = {};
    if (shopId) query.shop = shopId;

    if (search) {
      const s = new RegExp(search, "i");
      query.$or = [
        { orderNo: s },
        { invoiceNo: s },
        { supplierId: s },
        { supplierName: s },
        { supplierMobile: s },
      ];
    }

    // ---------------- COUNT + FETCH ----------------
    const total = await Purchase.countDocuments(query);

    let purchaseQuery = Purchase.find(query).sort({ createdAt: -1 });

    // Search → fetch up to 500
    if (search) {
      purchaseQuery = purchaseQuery.limit(500);
    }
    else if (limit > 0) {
      purchaseQuery = purchaseQuery.skip(skip).limit(limit);
    }

    const purchases = await purchaseQuery.lean();

    // ---------------- RESPOND ----------------
    const totalPages = limit > 0 ? Math.ceil(total / limit) || 1 : 1;

    res.json({
      purchases,
      page,
      limit,
      total,
      totalPages,
      searchMode: !!search,
    });

  } catch (err) {
    console.error("❌ /shops/:shopname/purchases error:", err);
    res.status(500).json({ message: "Failed to fetch purchases", error: err.message });
  }
});



// GET /api/shops/:shopname/lowstock
router.get("/shops/:shopname/lowstock", authTenantOrMaster, async (req, res) => {
  try {
    const { shopname } = req.params;

    let Product;

    if (req.tenantModels) {
      Product = req.tenantModels.Product;
    } else if (req.dbManager && req.dbManager.getTenantDb) {
      const tenantDb = req.dbManager.getTenantDb(shopname);
      if (!tenantDb) {
        return res.status(404).json({
          message: `Shop '${shopname}' not found or inactive`
        });
      }
      Product = tenantDb.model("Product");
    } else {
      return res.status(500).json({
        message: "Tenant DB manager not initialized"
      });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 25);
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";

    // 🔹 Base query
    const query = {
      status: "active",
      $expr: { $lte: ["$totalQty", "$minQty"] } // LOW STOCK
    };

    // 🔹 Search filter
    if (search) {
      query.$and = [
        {
          $or: [
            { code: { $regex: search, $options: "i" } },
            { name: { $regex: search, $options: "i" } },
            { category: { $regex: search, $options: "i" } }
          ]
        }
      ];
    }

    // 🔹 Get total low stock count
    const total = await Product.countDocuments(query);

    // 🔹 Paginated results
    const products = await Product.find(query)
      .select("code name category totalQty minQty")
      .sort({ totalQty: 1 }) // lowest stock first
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });

  } catch (err) {
    console.error("Fetch low-stock error:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
});




// GET /api/shops/:shopname/products/code/:code → Fetch single product by code

router.get("/shops/:shopname/products/code/:code", authTenantOrMaster, async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const { code, shopname } = req.params;
    const shopId = req.shop._id;
    const normalizedCode = code.trim();

    const product = await Product.findOne({
      code: { $regex: `^${normalizedCode}$`, $options: "i" },
      $or: [
        { shop: shopId },
        { shop: shopId.toString() },
      ],
    });

    if (!product) {
      console.warn(`⚠️ Product '${normalizedCode}' not found in '${shopname}'`);
      return res.status(404).json({ message: `Product '${normalizedCode}' not found in '${shopname}'` });
    }

    res.json(product);
  } catch (err) {
    console.error("❌ Fetch product by code error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});



// POST /shops/:shopname/products
router.post("/shops/:shopname/products", authTenantOrMaster, async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const { code, batchNo } = req.body;

    if (!code || !batchNo) {
      return res.status(400).json({ message: "code and batchNo are required" });
    }

    // Check uniqueness per shop
    const exists = await Product.findOne({ shop: req.shop._id, code, batchNo });
    if (exists) return res.status(409).json({ message: "Product batch already exists" });

    const product = new Product({ ...req.body, shop: req.shop._id });
    await product.save();

    res.status(201).json({
      shop: { _id: req.shop?._id, shopname: req.shop?.shopname },
      product,
      accessedBy: req.authType,
    });
  } catch (err) {
    console.error("Create product error:", err);
    res.status(500).json({ message: "Failed to create product", error: err.message });
  }
});




// ============================================================
// ✅ INCREMENT STOCK (Sale Return / Restock / Adjustments)
// ============================================================
// router.put(
//   "/shops/:shopname/products/increment-stock",
//   authTenantOrMaster,
//   async (req, res) => {
//     try {
//       const { Product } = req.tenantModels;
//       const { items } = req.body;

//       if (!Array.isArray(items) || items.length === 0) {
//         return res
//           .status(400)
//           .json({ message: "No items provided for stock increment" });
//       }

//       const updatedItems = [];

//       for (const item of items) {
//         const { code, batchNo, qty, mrp, salePrice, name, category } = item;

//         if (!code || !batchNo || !qty) continue;

//         // ====================================================
//         // 1️⃣ Try to update existing batch
//         // ====================================================
//         const updated = await Product.findOneAndUpdate(
//           {
//             shop: req.shop._id,
//             code,
//             "batches.batchNo": batchNo,
//           },
//           {
//             $inc: { "batches.$.qty": Number(qty) },

//             ...(mrp || salePrice
//               ? {
//                   $set: {
//                     ...(mrp && { "batches.$.mrp": Number(mrp) }),
//                     ...(salePrice && {
//                       "batches.$.salePrice": Number(salePrice),
//                     }),
//                   },
//                 }
//               : {}),
//           },
//           { new: true }
//         );

//         if (updated) {
//           updatedItems.push(updated);
//           continue;
//         }

//         // ====================================================
//         // 2️⃣ If batch does not exist → push new batch
//         // ====================================================
//         const product = await Product.findOne({
//           shop: req.shop._id,
//           code,
//         });

//         if (product) {
//           product.batches.push({
//             batchNo,
//             qty: Number(qty),
//             mrp: Number(mrp) || 0,
//             salePrice: Number(salePrice) || 0,
//           });

//           await product.save();
//           updatedItems.push(product);
//           continue;
//         }

//         // ====================================================
//         // 3️⃣ If product also does not exist → create new product
//         // ====================================================
//         const newProduct = new Product({
//           shop: req.shop._id,
//           code,
//           name,
//           category,
//           batches: [
//             {
//               batchNo,
//               qty: Number(qty),
//               mrp: Number(mrp) || 0,
//               salePrice: Number(salePrice) || 0,
//             },
//           ],
//         });

//         await newProduct.save();
//         updatedItems.push(newProduct);
//       }

//       res.json({
//         message: "Stock increment completed successfully",
//         updatedItems,
//         accessedBy: req.authType,
//       });
//     } catch (err) {
//       console.error("Increment stock error:", err);
//       res.status(500).json({
//         message: "Failed to increment stock",
//         error: err.message,
//       });
//     }
//   }
// );




// ============================================================
// ✅ INCREMENT STOCK (Sale Return / Restock / Adjustments) — UPDATED
// ============================================================
// ============================================================
// ✅ INCREMENT STOCK (Sale Return / Restock / Adjustments)
// ============================================================
router.put(
  "/shops/:shopname/products/increment-stock",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { Product } = req.tenantModels;
      const { items } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "No items provided" });
      }

      const updatedItems = [];

      for (const item of items) {
        const { code, batchNo, qty, mrp, salePrice, name, category } = item;
        if (!code || !batchNo || !qty) continue;

        // Get product BEFORE update
        const product = await Product.findOne({
          shop: req.shop._id,
          code,
        });

        const opening = product ? product.totalQty : 0;

        // 1️⃣ Try to update existing batch
        let updated = await Product.findOneAndUpdate(
          {
            shop: req.shop._id,
            code,
            "batches.batchNo": batchNo,
          },
          {
            $inc: { "batches.$.qty": Number(qty) },
            ...(mrp || salePrice
              ? {
                $set: {
                  ...(mrp && { "batches.$.mrp": Number(mrp) }),
                  ...(salePrice && { "batches.$.salePrice": Number(salePrice) }),
                },
              }
              : {}),
          },
          { new: true }
        );

        // 2️⃣ If batch not found, push new batch
        if (!updated && product) {
          product.batches.push({
            batchNo,
            qty: Number(qty),
            mrp: Number(mrp) || 0,
            salePrice: Number(salePrice) || 0,
          });
          updated = await product.save();
        }

        // 3️⃣ If product does not exist → create new
        if (!product) {
          updated = new Product({
            shop: req.shop._id,
            code,
            name,
            category,
            batches: [
              {
                batchNo,
                qty: Number(qty),
                mrp: Number(mrp) || 0,
                salePrice: Number(salePrice) || 0,
              },
            ],
          });
          await updated.save();
        }

        // Recompute total stock
        updated.totalQty = updated.batches.reduce(
          (s, b) => s + Number(b.qty || 0),
          0
        );
        const closing = updated.totalQty;

        updated.stockHistory.push({
          date: new Date(),
          openingStock: opening,
          closingStock: closing,
          change: closing - opening,
          reason: "stock increment",
          batchNo,
        });

        await updated.save();

        updatedItems.push(updated);
      }

      res.json({
        message: "Stock increment completed",
        updatedItems,
      });
    } catch (err) {
      console.error("Increment stock error:", err);
      res.status(500).json({
        message: "Failed to increment",
        error: err.message,
      });
    }
  }
);





// ============================================================
// ✅ DECREMENT STOCK (Sales / Adjustments)
// ============================================================
// router.put(
//   "/shops/:shopname/products/decrement-stock",
//   authTenantOrMaster,
//   async (req, res) => {
//     try {
//       const { Product } = req.tenantModels;
//       const { items } = req.body;

//       if (!Array.isArray(items) || items.length === 0) {
//         return res
//           .status(400)
//           .json({ message: "No items provided for stock decrement" });
//       }

//       const updatedItems = [];

//       for (const item of items) {
//         const { code, batchNo, qty } = item;

//         if (!code || !batchNo || !qty) continue;

//         const updated = await Product.findOneAndUpdate(
//           {
//             shop: req.shop._id,
//             code,
//             "batches.batchNo": batchNo,
//           },
//           {
//             $inc: { "batches.$.qty": -Math.abs(Number(qty)) },
//           },
//           { new: true }
//         );

//         if (updated) updatedItems.push(updated);
//       }

//       res.json({
//         message: "Stock decrement completed successfully",
//         updatedItems,
//         accessedBy: req.authType,
//       });
//     } catch (err) {
//       console.error("Decrement stock error:", err);
//       res.status(500).json({
//         message: "Failed to decrement stock",
//         error: err.message,
//       });
//     }
//   }
// );




// ============================================================
// ✅ DECREMENT STOCK (Sales / Adjustments)  — UPDATED
// ============================================================
// ============================================================
// ✅ DECREMENT STOCK (Sales / Adjustments)
// ============================================================
router.put(
  "/shops/:shopname/products/decrement-stock",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { Product } = req.tenantModels;
      const { items } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "No items provided" });
      }

      const updatedItems = [];

      for (const item of items) {
        const { code, batchNo, qty } = item;
        if (!code || !batchNo || !qty) continue;

        // Get product BEFORE update to calculate opening
        const product = await Product.findOne({
          shop: req.shop._id,
          code,
          "batches.batchNo": batchNo,
        });

        if (!product) continue;

        const opening = product.totalQty;

        // Apply decrement
        const updated = await Product.findOneAndUpdate(
          {
            shop: req.shop._id,
            code,
            "batches.batchNo": batchNo,
          },
          { $inc: { "batches.$.qty": -Math.abs(Number(qty)) } },
          { new: true }
        );

        if (!updated) continue;

        // Recompute totalQty
        updated.totalQty = updated.batches.reduce(
          (s, b) => s + Number(b.qty || 0),
          0
        );

        const closing = updated.totalQty;

        // Push stock history
        updated.stockHistory.push({
          date: new Date(),
          openingStock: opening,
          closingStock: closing,
          change: closing - opening,
          reason: "sale decrement",
          batchNo,
        });

        await updated.save();
        updatedItems.push(updated);
      }

      res.json({
        message: "Stock decrement completed",
        updatedItems,
      });
    } catch (err) {
      console.error("Decrement stock error:", err);
      res.status(500).json({ message: "Failed", error: err.message });
    }
  }
);





// PATCH /shops/:shopname/products/min-qty
router.patch("/shops/:shopname/products/min-qty", authTenantOrMaster, async (req, res) => {
  try {
    const { shopname } = req.params;
    const { code, batchNo, minQty } = req.body;

    if (!code || !batchNo || minQty === undefined)
      return res.status(400).json({ message: "code, batchNo, minQty required" });
    if (minQty < 0)
      return res.status(400).json({ message: "minQty must be >= 0" });

    // ✅ Determine the correct Product model
    const Product =
      req.tenantModels?.Product || req.masterModels?.Product;
    if (!Product)
      return res.status(500).json({ message: "Product model not found (tenant or master missing)" });

    // ✅ Determine which shop to use
    const shopId = req.shop?._id;
    if (!shopId)
      return res.status(400).json({ message: `Shop '${shopname}' not found or inactive` });

    // ✅ Update minQty inside a nested batch (more common structure)
    const updated = await Product.findOneAndUpdate(
      { shop: shopId, code, "batches.batchNo": batchNo },
      { $set: { "batches.$.minQty": Number(minQty) } },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ message: "Product batch not found" });

    res.json({
      code: updated.code,
      batchNo,
      minQty,
    });
  } catch (err) {
    console.error("Update minQty error:", err);
    res.status(500).json({ message: "Failed to update minQty", error: err.message });
  }
});


// -------------------------
// Categories CRUD
// -------------------------

// GET categories for a shop
router.get("/shops/:shopname/categories", authTenantOrMaster, async (req, res) => {
  try {
    const { Category } = req.tenantModels;
    const shopId = req.shop?._id;
    if (!shopId) return res.status(400).json({ message: "Shop not found" });

    let categoriesDoc = await Category.findOne({ shop: shopId });

    // If no categories exist yet, create an empty document
    if (!categoriesDoc) {
      categoriesDoc = new Category({ shop: shopId, categories: [] });
      await categoriesDoc.save();
    }

    res.json({
      shop: { _id: shopId, shopname: req.shop.shopname },
      categories: categoriesDoc.categories,
      accessedBy: req.authType,
    });
  } catch (err) {
    console.error("Fetch categories error:", err);
    res.status(500).json({ message: "Failed to fetch categories", error: err.message });
  }
});

// POST initial categories (only if none exist)
router.post("/shops/:shopname/categories", authTenantOrMaster, async (req, res) => {
  try {
    const { Category } = req.tenantModels;
    const shopId = req.shop?._id;
    const { categories } = req.body;

    if (!shopId) return res.status(400).json({ message: "Shop not found" });
    if (!Array.isArray(categories)) return res.status(400).json({ message: "categories must be an array" });

    const existingDoc = await Category.findOne({ shop: shopId });
    if (existingDoc) return res.status(400).json({ message: "Categories already exist. Use PUT to update." });

    const categoriesDoc = new Category({ shop: shopId, categories });
    await categoriesDoc.save();

    res.status(201).json({
      shop: { _id: shopId, shopname: req.shop.shopname },
      categories: categoriesDoc.categories,
      accessedBy: req.authType,
    });
  } catch (err) {
    console.error("Create categories error:", err);
    res.status(500).json({ message: "Failed to create categories", error: err.message });
  }
});

// PUT to update/overwrite categories
router.put("/shops/:shopname/categories", authTenantOrMaster, async (req, res) => {
  try {
    const { Category } = req.tenantModels;
    const shopId = req.shop?._id;
    const { categories } = req.body;

    if (!shopId) return res.status(400).json({ message: "Shop not found" });
    if (!Array.isArray(categories)) return res.status(400).json({ message: "categories must be an array" });

    let categoriesDoc = await Category.findOne({ shop: shopId });
    if (!categoriesDoc) {
      categoriesDoc = new Category({ shop: shopId, categories });
    } else {
      categoriesDoc.categories = categories;
    }

    await categoriesDoc.save();

    res.json({
      shop: { _id: shopId, shopname: req.shop.shopname },
      categories: categoriesDoc.categories,
      accessedBy: req.authType,
    });
  } catch (err) {
    console.error("Update categories error:", err);
    res.status(500).json({ message: "Failed to update categories", error: err.message });
  }
});

// -------------------------
// Products next code
// -------------------------
router.get("/shops/:shopname/products/next-code", authTenantOrMaster, async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const lastProduct = await Product.findOne({ shop: req.shop._id }).sort({ code: -1 });
    let nextCode = "P001";
    if (lastProduct && lastProduct.code) {
      const num = parseInt(lastProduct.code.replace(/\D/g, "")) || 0;
      nextCode = "P" + String(num + 1).padStart(3, "0");
    }
    res.json({ nextCode });
  } catch (err) {
    console.error("Next code error:", err);
    res.status(500).json({ message: "Failed to generate next code" });
  }
});

// -------------------------
// Orders CRUD
// -------------------------
function checkTenantModels(req, res, next) {
  if (!req.tenantModels || !req.tenantModels.Order) return res.status(500).json({ message: "Tenant models not loaded" });
  next();
}


// ✅ Unified orderNo + productName search + full filters
router.get("/shops/:shopname/orders", authTenantOrMaster, checkTenantModels, async (req, res) => {
  try {
    const { Order } = req.tenantModels;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { orderNo, productName, status, startDate, endDate } = req.query;
    const query = { shop: req.shop._id };

    // 🔹 Combine orderNo + productName search (from same input)
    if (orderNo || productName) {
      const term = orderNo || productName;
      query.$or = [
        { orderNo: { $regex: term, $options: "i" } },
        { "items.name": { $regex: term, $options: "i" } },
      ];
    }

    // 🔹 Status filter
    if (status) query.status = status.toLowerCase();

    // // 🔹 Date range filter
    // if (startDate || endDate) {
    //   query.date = {};
    //   if (startDate) query.date.$gte = new Date(`${startDate}T00:00:00Z`);
    //   if (endDate) query.date.$lte = new Date(`${endDate}T23:59:59.999Z`);
    // }

    // ✅ Use createdAt for accurate date range filtering
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(`${startDate}T00:00:00Z`);
      if (endDate) query.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }


    // 🔹 Total count for pagination
    const total = await Order.countDocuments(query);

    // 🔹 Paginated results
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // ✅ Response
    res.json({
      shop: { _id: req.shop._id, shopname: req.shop.shopname },
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      accessedBy: req.authType,
    });
  } catch (err) {
    console.error("Fetch orders error:", err);
    res.status(500).json({
      message: "Failed to fetch orders",
      error: err.message,
    });
  }
});




router.post("/shops/:shopname/orders", authTenantOrMaster, checkTenantModels, async (req, res) => {
  try {
    const { Order } = req.tenantModels;
    const shopname = req.shop?.shopname;
    if (!req.body.orderNo) req.body.orderNo = await getNextOrderNo(shopname);

    const order = new Order({ ...req.body, shop: req.shop._id });
    await order.save();

    res.status(201).json({ shop: { _id: req.shop._id, shopname }, order, accessedBy: req.authType });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ message: "Failed to create order", error: err.message });
  }
});

router.get("/shops/:shopname/orders/:id", authTenantOrMaster, checkTenantModels, async (req, res) => {
  try {
    const { Order } = req.tenantModels;

    // Ensure shop is resolved
    if (!req.shop?._id) return res.status(400).json({ message: "Shop not resolved" });

    const order = await Order.findOne({ _id: req.params.id, shop: req.shop._id });
    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json({
      shop: { _id: req.shop._id, shopname: req.shop.shopname },
      order,
      accessedBy: req.authType,
    });
  } catch (err) {
    console.error("Fetch single order error:", err);
    res.status(500).json({ message: "Failed to fetch order", error: err.message });
  }
});

// -------------------------
// Preview next order number (no increment)
// -------------------------
router.get(
  "/shops/:shopname/orders/next-order-no/preview",
  authTenantOrMaster,
  checkTenantModels,
  async (req, res) => {
    try {
      const shopname = req.shop?.shopname;
      if (!shopname) return res.status(400).json({ message: "Shop not resolved" });

      // Call your getNextOrderNo util with increment = false
      const nextNo = await getNextOrderNo(shopname, false);
      res.json({ orderNo: nextNo });
    } catch (err) {
      console.error("Preview next order number error:", err);
      res
        .status(500)
        .json({ message: "Failed to preview next order number", error: err.message });
    }
  }
);

// -------------------------
// Update order status (tenant/master)
// -------------------------
router.put(
  "/shops/:shopname/orders/:id/status",
  authTenantOrMaster,
  checkTenantModels,
  async (req, res) => {
    try {
      const { Order } = req.tenantModels;
      const shopId = req.shop?._id;
      if (!shopId) return res.status(400).json({ message: "Shop not resolved" });

      const order = await Order.findOne({ _id: req.params.id, shop: shopId });
      if (!order) return res.status(404).json({ message: "Order not found" });

      const { status } = req.body;
      if (!status) return res.status(400).json({ message: "Status is required" });

      order.status = status;
      await order.save();

      res.json({
        shop: { _id: shopId, shopname: req.shop.shopname },
        order,
        accessedBy: req.authType,
      });
    } catch (err) {
      console.error("Update order status error:", err);
      res.status(500).json({ message: "Failed to update order status", error: err.message });
    }
  }
);


// -------------------------
// Sales Bills CRUD
// -------------------------




router.get("/shops/:shopname/master-sales-bills", authTenantOrMaster, async (req, res) => {
  try {
    if (!req.tenantModels || !req.tenantModels.SalesBill) {
      return res.status(500).json({ message: "Tenant DB not loaded" });
    }

    const { SalesBill } = req.tenantModels;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";
    const filter = req.query.filter || "";
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    const counter = req.query.counter;
    const statusFilter = req.query.statusFilter;

    const query = { shop: req.shop._id };

    if (counter) query.counter = Number(counter);

    // if (search.trim()) {
    //   const regex = new RegExp(search.trim(), "i");
    //   query.$or = [
    //     // { billNo: regex },
    //     // { customerName: regex },
    //     // { mobile: regex }
    //   ];
    // }


    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");

      query.$or = [
        { billNo: regex },
        { customerName: regex },
        { mobile: regex },
        // { counter: !isNaN(search) ? Number(search) : undefined }, // ⭐ counter match
      ].filter(Boolean);
    }



    // ⭐ ---------------- Counter Filter ----------------
    if (counter && counter !== "") {
      query.counter = Number(counter);
    }


    // ----------------------------
    // 🎯 STATUS FILTER (active / cancelled)
    // ----------------------------
    if (statusFilter && statusFilter !== "all") {
      query.status = statusFilter;
    }


    if (filter && filter !== "custom") {
      const now = new Date();
      let start, end;

      if (filter === "today") {
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
      } else if (filter === "this-week") {
        const day = now.getDay();
        start = new Date(now);
        start.setDate(now.getDate() - day);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      } else if (filter === "this-month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }

      query.date = { $gte: start, $lte: end };
    }

    if (filter === "custom" && fromDate && toDate) {
      query.date = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate + "T23:59:59.999Z")
      };
    }

    const total = await SalesBill.countDocuments(query);
    const salesBills = await SalesBill.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      salesBills,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });

  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
});
// GET /shops/:shopname/sales-bills
router.get("/shops/:shopname/sales-bills", authTenantOrMaster, async (req, res) => {
  try {

    // ⭐ FIX 1: Ensure tenant DB & models loaded
    if (!req.tenantModels || !req.tenantModels.SalesBill) {
      return res.status(500).json({ message: "Tenant database not initialized" });
    }

    // ⭐ FIX 2: Ensure shop resolved correctly
    if (!req.shop || !req.shop._id) {
      return res.status(400).json({ message: "Shop not found in request" });
    }
    const { SalesBill } = req.tenantModels;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const search = (req.query.search ?? "").trim();
    const filter = req.query.filter;
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    const counter = req.query.counter;

    const query = { shop: req.shop._id };

    // ---------- SEARCH ----------
    // if (search) {
    //   query.$or = [
    //     { billNo: { $regex: search, $options: "i" } },
    //     { customerName: { $regex: search, $options: "i" } },
    //     { mobile: { $regex: search, $options: "i" } },
    //       { counter: isNaN(search) ? undefined : Number(search) },
    //   ];
    // }


    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");

      query.$or = [
        { billNo: regex },
        { customerName: regex },
        { mobile: regex },
        { counter: !isNaN(search) ? Number(search) : undefined }, // ⭐ counter match
      ].filter(Boolean);
    }


    // ⭐ FIX 4: Counter filter (MASTER / MANAGER)
    if (counter && counter !== "") {
      query.counter = Number(counter);
    }

    // ---------- DATE FILTER ----------
    if (filter && filter !== "custom") {
      const now = new Date();
      let start, end;
      if (filter === "today") {
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
      } else if (filter === "this-week") {
        const day = now.getDay();
        start = new Date(now);
        start.setDate(now.getDate() - day);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      } else if (filter === "this-month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }
      query.date = { $gte: start, $lte: end };
    } else if (filter === "custom" && fromDate && toDate) {
      query.date = { $gte: new Date(fromDate), $lte: new Date(toDate) };
    }

    // ---------- FETCH DATA ----------
    const total = await SalesBill.countDocuments(query);
    const salesBills = await SalesBill.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      shop: { _id: req.shop._id, shopname: req.shop.shopname },
      salesBills,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      accessedBy: req.authType,
    });
  } catch (err) {
    console.error("Fetch sales bills error:", err);
    res.status(500).json({ message: "Failed to fetch sales bills", error: err.message });
  }
});






// router.put(
//   "/shops/:shopname/master-sales-bills/:id",
//   authTenantOrMaster,
//   async (req, res) => {
//     try {
//       const { SalesBill, Product } = req.tenantModels;
//       const { id } = req.params;

//       if (!mongoose.Types.ObjectId.isValid(id)) {
//         return res.status(400).json({ message: "Invalid bill ID" });
//       }

//       const existingBill = await SalesBill.findOne({
//         _id: id,
//         shop: req.shop._id,
//       });

//       if (!existingBill) {
//         return res.status(404).json({ message: "Bill not found" });
//       }

//       const oldItems = existingBill.items || [];
//       const newItems = req.body.items || [];

//       // ---- Map by code+batch (status handled via qty + status) ----
//       const oldMap = new Map(
//         oldItems.map((it) => [`${it.code}_${it.batch}`, it])
//       );
//       const newMap = new Map(
//         newItems.map((it) => [`${it.code}_${it.batch}`, it])
//       );

//       // 🔥 movement logs for this master edit
//       let movementLogs = [];

//       // ============================================================
//       // 1. STOCK ADJUSTMENT FOR CHANGED QUANTITIES
//       // ============================================================
//       for (const item of newItems) {
//         const key = `${item.code}_${item.batch}`;
//         const oldItem = oldMap.get(key);

//         const oldQty = oldItem ? Number(oldItem.qty || 0) : 0;
//         const newQty = Number(item.qty || 0);
//         const delta = newQty - oldQty; // +ve => sold more, -ve => sold less

//         if (delta !== 0) {
//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: item.code,
//               "batches.batchNo": item.batch,
//             },
//             { $inc: { "batches.$.qty": -delta } } // -delta because sale reduces stock
//           );
//         }
//       }

//       // ============================================================
//       // 2. RESTORE STOCK FOR TRULY REMOVED ITEMS
//       // ============================================================
//       for (const item of oldItems) {
//         const key = `${item.code}_${item.batch}`;
//         if (!newMap.has(key)) {
//           const oldQty = Number(item.qty || 0);

//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: item.code,
//               "batches.batchNo": item.batch,
//             },
//             { $inc: { "batches.$.qty": oldQty } }
//           );

//           // 📌 Movement for ROW REMOVED (was in bill, now gone)
//           movementLogs.push({
//             code: item.code,
//             name: item.name,
//             batch: item.batch,
//             oldQty,
//             newQty: 0,
//             deltaQty: -oldQty, // stock increase (return)
//             // Before edit = after original sale = closingStock
//             openingStock: Number(item.closingStock || 0),
//             // After edit = stock restored = original openingStock
//             closingStock: Number(item.openingStock || 0),
//             taxable: Number(item.taxable || 0),
//             value: Number(item.value || 0),
//             direction: "increase",
//             reason: "row-cancel",
//             at: new Date(),
//             editedBy: req.user?.username || null,
//           });

//         }
//       }

//       // ============================================================
//       // 3. SANITIZE ITEMS WITH OPENING/CLOSING SNAPSHOT
//       // ============================================================
//       const sanitizedItems = [];

//       for (const it of newItems) {
//         if (!it.code || !it.batch) continue;

//         const prod = await Product.findOne({
//           shop: req.shop._id,
//           code: it.code,
//           "batches.batchNo": it.batch,
//         });

//         const batchObj = prod?.batches?.find(
//           (b) =>
//             (b.batchNo || "").toLowerCase() ===
//             (it.batch || "").toLowerCase()
//         );

//         const currentQty = Number(batchObj?.qty || 0); // stock AFTER all updates
//         const newQty = Number(it.qty || 0);

//         const openingStock = currentQty + newQty; // before this bill
//         const closingStock = currentQty;          // after this bill

//         const key = `${it.code}_${it.batch}`;
//         const oldItem = oldMap.get(key);
//         const oldQty = oldItem ? Number(oldItem.qty || 0) : 0;
//         const deltaQty = newQty - oldQty;

//         sanitizedItems.push({
//           code: it.code,
//           name: it.name,
//           batch: it.batch,
//           mrp: Number(it.mrp || 0),
//           rate: Number(it.rate || 0),
//           qty: newQty,
//           gst: Number(it.gst || 0),
//           taxable: Number(it.taxable || 0),
//           value: Number(it.value || 0),
//           isInclusive: !!it.isInclusive,
//           openingStock,
//           closingStock,
//           status: it.status || "active",
//         });

//         // 📌 Movement for QTY CHANGED OR NEW ROW
//         if (deltaQty !== 0) {
//           const isCancelledRow =
//             newQty === 0 || (it.status || "active") === "cancelled";

//           movementLogs.push({
//             code: it.code,
//             name: it.name,
//             batch: it.batch,
//             oldQty,
//             newQty,
//             deltaQty,
//             openingStock,
//             closingStock,
//             taxable: Number(it.taxable || 0),
//             value: Number(it.value || 0),
//             direction: deltaQty > 0 ? "decrease" : "increase", // +ve sale, -ve return
//             reason: isCancelledRow ? "row-cancel" : "edit-qty",
//             at: new Date(),
//             editedBy: req.user?.username || null,
//           });
//         }
//       }

//       // ============================================================
//       // 4. BILL-LEVEL STATUS + FIELDS
//       // ============================================================
//       const hasActiveItems = sanitizedItems.some(
//         (it) => (it.status || "active") === "active" && it.qty > 0
//       );

//       const updateDoc = {
//         ...req.body,
//         items: sanitizedItems,
//       };

//       if (!hasActiveItems) {
//         // no active items => full bill cancelled
//         updateDoc.status = "cancelled";
//         updateDoc.total = 0;
//         updateDoc.discount = 0;
//         updateDoc.netAmount = 0;
//         updateDoc.cashGiven = 0;
//         updateDoc.balance = 0;
//         updateDoc.cgst = 0;
//         updateDoc.sgst = 0;
//         updateDoc.totalGst = 0;

//         // Mark all movements in this edit as BILL CANCEL
//         movementLogs = movementLogs.map((m) => ({
//           ...m,
//           reason: "bill-cancel",
//         }));
//       }

//       // append new movement logs to existing ones
//       updateDoc.movements = [
//         ...(existingBill.movements || []),
//         ...movementLogs,
//       ];

//       const updated = await SalesBill.findOneAndUpdate(
//         { _id: id, shop: req.shop._id },
//         updateDoc,
//         { new: true }
//       );

//       res.json({
//         updated,
//         accessedBy: req.authType,
//         message: "Master sales bill updated successfully",
//       });
//     } catch (err) {
//       console.error("Update master bill error:", err);
//       res.status(500).json({
//         message: "Failed to update sales bill",
//         error: err.message,
//       });
//     }
//   }
// );




// router.put(
//   "/shops/:shopname/master-sales-bills/:id",
//   authTenantOrMaster,
//   async (req, res) => {
//     try {
//       const { SalesBill, Product } = req.tenantModels;
//       const { id } = req.params;

//       if (!mongoose.Types.ObjectId.isValid(id)) {
//         return res.status(400).json({ message: "Invalid bill ID" });
//       }

//       const existingBill = await SalesBill.findOne({
//         _id: id,
//         shop: req.shop._id,
//       });

//       if (!existingBill) {
//         return res.status(404).json({ message: "Bill not found" });
//       }

//       const oldItems = existingBill.items || [];
//       const newItems = req.body.items || [];

//       const oldMap = new Map(
//         oldItems.map((it) => [`${it.code}_${it.batch}`, it])
//       );
//       const newMap = new Map(
//         newItems.map((it) => [`${it.code}_${it.batch}`, it])
//       );

//       let movementLogs = [];

//       // ==================================================================
//       // 1️⃣ STOCK UPDATE FOR QTY CHANGES IN NEW ITEMS
//       // ==================================================================
//       for (const item of newItems) {
//         const key = `${item.code}_${item.batch}`;
//         const oldItem = oldMap.get(key);
//         const oldQty = oldItem ? Number(oldItem.qty || 0) : 0;
//         const newQty = Number(item.qty || 0);

//         const delta = newQty - oldQty;

//         if (delta !== 0) {
//           // sale → reduce stock (delta positive means more sold)
//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: item.code,
//               "batches.batchNo": item.batch,
//             },
//             { $inc: { "batches.$.qty": -delta } }
//           );
//         }
//       }

//       // ==================================================================
//       // 2️⃣ RESTORE STOCK FOR REMOVED ROWS
//       // ==================================================================
//       for (const item of oldItems) {
//         const key = `${item.code}_${item.batch}`;
//         if (!newMap.has(key)) {
//           const oldQty = Number(item.qty || 0);

//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: item.code,
//               "batches.batchNo": item.batch,
//             },
//             { $inc: { "batches.$.qty": oldQty } }
//           );

//           movementLogs.push({
//             code: item.code,
//             name: item.name,
//             batch: item.batch,
//             oldQty,
//             newQty: 0,
//             deltaQty: -oldQty,
//             openingStock: Number(item.closingStock || 0),
//             closingStock: Number(item.openingStock || 0),
//             taxable: Number(item.taxable || 0),
//             value: Number(item.value || 0),
//             direction: "increase",
//             reason: "row-cancel",
//             at: new Date(),
//             editedBy: req.user?.username || null,
//           });

//           // WRITE STOCK HISTORY
//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: item.code,
//               "batches.batchNo": item.batch,
//             },
//             {
//               $push: {
//                 stockHistory: {
//                   date: new Date(),
//                   openingStock: Number(item.closingStock || 0),
//                   closingStock: Number(item.openingStock || 0),
//                   change: Number(item.openingStock || 0) - Number(item.closingStock || 0),
//                   reason: "master-row-cancel",
//                   batchNo: item.batch,
//                 },
//               },
//             }
//           );
//         }
//       }

//       // ==================================================================
//       // 3️⃣ SANITIZE NEW ITEMS + RECORD MOVEMENTS + WRITE STOCK HISTORY
//       // ==================================================================
//       const sanitizedItems = [];

//       for (const it of newItems) {
//         if (!it.code || !it.batch) continue;

//         const prod = await Product.findOne({
//           shop: req.shop._id,
//           code: it.code,
//           "batches.batchNo": it.batch,
//         });

//         const batchObj = prod?.batches?.find(
//           (b) => (b.batchNo || "").toLowerCase() === it.batch.toLowerCase()
//         );

//         const currentQty = Number(batchObj?.qty || 0); // AFTER updates
//         const newQty = Number(it.qty || 0);

//         const openingStock = currentQty + newQty;
//         const closingStock = currentQty;

//         const oldItem = oldMap.get(`${it.code}_${it.batch}`);
//         const oldQty = oldItem ? Number(oldItem.qty) : 0;
//         const deltaQty = newQty - oldQty;

//         sanitizedItems.push({
//           ...it,
//           qty: newQty,
//           openingStock,
//           closingStock,
//         });

//         if (deltaQty !== 0) {
//           const isCancelled = newQty === 0 || it.status === "cancelled";

//           movementLogs.push({
//             code: it.code,
//             name: it.name,
//             batch: it.batch,
//             oldQty,
//             newQty,
//             deltaQty,
//             openingStock,
//             closingStock,
//             taxable: Number(it.taxable || 0),
//             value: Number(it.value || 0),
//             direction: deltaQty > 0 ? "decrease" : "increase",
//             reason: isCancelled ? "row-cancel" : "edit-qty",
//             at: new Date(),
//             editedBy: req.user?.username || null,
//           });

//           // STOCK HISTORY WRITE
//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: it.code,
//               "batches.batchNo": it.batch,
//             },
//             {
//               $push: {
//                 stockHistory: {
//                   date: new Date(),
//                   openingStock,
//                   closingStock,
//                   change: closingStock - openingStock,
//                   reason: isCancelled ? "master-row-cancel" : "master-edit-qty",
//                   batchNo: it.batch,
//                 },
//               },
//             }
//           );
//         }
//       }

//       // ==================================================================
//       // 4️⃣ BILL STATUS UPDATE
//       // ==================================================================
//       const hasActive = sanitizedItems.some((a) => a.qty > 0 && a.status !== "cancelled");

//       const updateDoc = {
//         ...req.body,
//         items: sanitizedItems,
//       };

//       if (!hasActive) {
//         updateDoc.status = "cancelled";
//         updateDoc.total = updateDoc.netAmount = updateDoc.discount = 0;
//         updateDoc.cashGiven = updateDoc.balance = 0;
//         movementLogs = movementLogs.map((m) => ({ ...m, reason: "bill-cancel" }));
//       }

//       updateDoc.movements = [
//         ...(existingBill.movements || []),
//         ...movementLogs,
//       ];

//       const updated = await SalesBill.findOneAndUpdate(
//         { _id: id, shop: req.shop._id },
//         updateDoc,
//         { new: true }
//       );

//       res.json({
//         updated,
//         accessedBy: req.authType,
//         message: "Master bill updated successfully with stock history tracking",
//       });
//     } catch (err) {
//       console.error("Master bill update error:", err);
//       res.status(500).json({
//         message: "Error updating bill",
//         error: err.message,
//       });
//     }
//   }
// );




// router.put(
//   "/shops/:shopname/master-sales-bills/:id",
//   authTenantOrMaster,
//   async (req, res) => {
//     try {
//       const { SalesBill, Product } = req.tenantModels;
//       const { id } = req.params;

//       if (!mongoose.Types.ObjectId.isValid(id)) {
//         return res.status(400).json({ message: "Invalid bill ID" });
//       }

//       const existingBill = await SalesBill.findOne({
//         _id: id,
//         shop: req.shop._id,
//       });

//       if (!existingBill) {
//         return res.status(404).json({ message: "Bill not found" });
//       }

//       const oldItems = existingBill.items || [];
//       const newItems = req.body.items || [];

//       const oldMap = new Map(
//         oldItems.map((it) => [`${it.code}_${it.batch}`, it])
//       );
//       const newMap = new Map(
//         newItems.map((it) => [`${it.code}_${it.batch}`, it])
//       );

//       let movementLogs = [];

//       // =====================================================
//       // 1️⃣ APPLY STOCK CHANGE (NEW ITEMS)
//       // =====================================================
//       for (const item of newItems) {
//         const key = `${item.code}_${item.batch}`;
//         const oldItem = oldMap.get(key);

//         const oldQty = oldItem ? Number(oldItem.qty || 0) : 0;
//         const newQty = Number(item.qty || 0);

//         const delta = newQty - oldQty;

//         if (delta !== 0) {
//           // -delta because selling reduces stock
//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: item.code,
//               "batches.batchNo": item.batch,
//             },
//             { $inc: { "batches.$.qty": -delta } }
//           );
//         }
//       }

//       // =====================================================
//       // 2️⃣ RESTORE STOCK FOR REMOVED ROWS
//       // =====================================================
//       for (const item of oldItems) {
//         const key = `${item.code}_${item.batch}`;

//         if (!newMap.has(key)) {
//           const oldQty = Number(item.qty);

//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: item.code,
//               "batches.batchNo": item.batch,
//             },
//             { $inc: { "batches.$.qty": oldQty } }
//           );

//           const openingStock = Number(item.closingStock);
//           const closingStock = Number(item.openingStock);

//           // Movement log
//           movementLogs.push({
//             code: item.code,
//             name: item.name,
//             batch: item.batch,
//             oldQty,
//             newQty: 0,
//             deltaQty: -oldQty,
//             openingStock,
//             closingStock,
//             direction: "increase",
//             reason: "row-cancel",
//             at: new Date(),
//             editedBy: req.user?.username || null,
//           });

//           // Stock history
//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: item.code,
//               "batches.batchNo": item.batch,
//             },
//             {
//               $push: {
//                 stockHistory: {
//                   date: new Date(),
//                   openingStock,
//                   closingStock,
//                   change: closingStock - openingStock,
//                   reason: "master-row-cancel",
//                   batchNo: item.batch,
//                 },
//               },
//             }
//           );
//         }
//       }

//       // =====================================================
//       // 3️⃣ SANITIZE / MOVEMENT + FIXED STOCK HISTORY LOGIC
//       // =====================================================
//       const sanitizedItems = [];

//       for (const it of newItems) {
//         if (!it.code || !it.batch) continue;

//         const prod = await Product.findOne({
//           shop: req.shop._id,
//           code: it.code,
//           "batches.batchNo": it.batch,
//         });

//         const batchObj = prod?.batches?.find(
//           (b) => b.batchNo.toLowerCase() === it.batch.toLowerCase()
//         );

//         const currentQty = Number(batchObj?.qty || 0); // AFTER stock update
//         const newQty = Number(it.qty || 0);

//         const oldItem = oldMap.get(`${it.code}_${it.batch}`);
//         const oldQty = oldItem ? Number(oldItem.qty || 0) : 0;

//         const deltaQty = newQty - oldQty;

//         // FIXED CALCULATION


//         const closingStock = currentQty;    // AFTER master edit stock
// // const openingStock = closingStock + newQty;   // BEFORE sale

// const openingStock = closingStock + oldQty;


//         sanitizedItems.push({
//           ...it,
//           qty: newQty,
//           openingStock,
//           closingStock,
//         });

//         if (deltaQty !== 0) {
//           const isCancelled = newQty === 0 || it.status === "cancelled";

//           movementLogs.push({
//             code: it.code,
//             name: it.name,
//             batch: it.batch,
//             oldQty,
//             newQty,
//             deltaQty,
//             openingStock,
//             closingStock,
//             direction: deltaQty > 0 ? "decrease" : "increase",
//             reason: isCancelled ? "row-cancel" : "edit-qty",
//             at: new Date(),
//             editedBy: req.user?.username || null,
//           });

//           // FIXED STOCK HISTORY ENTRY
//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: it.code,
//               "batches.batchNo": it.batch,
//             },
//             {
//               $push: {
//                 stockHistory: {
//                   date: new Date(),
//                   openingStock,
//                   closingStock,
//                   change: closingStock - openingStock,
//                   reason: isCancelled ? "master-row-cancel" : "master-edit-qty",
//                   batchNo: it.batch,
//                 },
//               },
//             }
//           );
//         }
//       }

//       // =====================================================
//       // 4️⃣ BILL STATUS & SAVE
//       // =====================================================
//       const hasActive = sanitizedItems.some(
//         (i) => i.qty > 0 && i.status !== "cancelled"
//       );

//       const updateDoc = {
//         ...req.body,
//         items: sanitizedItems,
//       };

//       if (!hasActive) {
//         updateDoc.status = "cancelled";
//         updateDoc.total = updateDoc.netAmount = 0;
//         movementLogs = movementLogs.map((m) => ({
//           ...m,
//           reason: "bill-cancel",
//         }));
//       }

//       updateDoc.movements = [
//         ...(existingBill.movements || []),
//         ...movementLogs,
//       ];

//       const updated = await SalesBill.findOneAndUpdate(
//         { _id: id, shop: req.shop._id },
//         updateDoc,
//         { new: true }
//       );

//       res.json({
//         updated,
//         message: "Master bill updated with correct stock history",
//       });
//     } catch (err) {
//       console.error("Master bill update error:", err);
//       res.status(500).json({
//         message: "Failed to update bill",
//         error: err.message,
//       });
//     }
//   }
// );



// =========================================================
// MASTER EDIT — Update an existing sales bill (Fully Fixed)
// =========================================================



// router.put(
//   "/shops/:shopname/master-sales-bills/:id",
//   authTenantOrMaster,
//   async (req, res) => {
//     try {
//       const { SalesBill, Product } = req.tenantModels;
//       const { id } = req.params;

//       if (!mongoose.Types.ObjectId.isValid(id)) {
//         return res.status(400).json({ message: "Invalid bill ID" });
//       }

//       const existingBill = await SalesBill.findOne({
//         _id: id,
//         shop: req.shop._id,
//       });

//       if (!existingBill) {
//         return res.status(404).json({ message: "Bill not found" });
//       }

//       const oldItems = existingBill.items || [];
//       const newItems = req.body.items || [];

//       const oldMap = new Map(oldItems.map(it => [`${it.code}_${it.batch}`, it]));
//       const newMap = new Map(newItems.map(it => [`${it.code}_${it.batch}`, it]));

//       let movementLogs = [];

//       // =========================================================
//       // Helper: Rebuild totalQty = sum of all batches
//       // =========================================================
//       async function recomputeTotalQty(code) {
//         const prod = await Product.findOne({ shop: req.shop._id, code }).lean();
//         if (!prod) return;

//         const sum = (prod.batches || []).reduce((s, b) => s + Number(b.qty || 0), 0);

//         await Product.updateOne(
//           { shop: req.shop._id, code },
//           { $set: { totalQty: sum } }
//         );
//       }

//       // =========================================================
//       // 1️⃣ APPLY STOCK CHANGE (FOR EDITED ITEMS)
//       // =========================================================
//       for (const item of newItems) {
//         const key = `${item.code}_${item.batch}`;
//         const oldItem = oldMap.get(key);

//         const oldQty = oldItem ? Number(oldItem.qty) : 0;
//         const newQty = Number(item.qty);
//         const delta = newQty - oldQty;

//         if (delta !== 0) {
//           // Adjust batch qty
//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: item.code,
//               "batches.batchNo": item.batch,
//             },
//             { $inc: { "batches.$.qty": -delta } }
//           );

//           // FIX: UPDATE TOTAL QTY
//           await recomputeTotalQty(item.code);
//         }
//       }

//       // =========================================================
//       // 2️⃣ RESTORE STOCK FOR REMOVED ROWS
//       // =========================================================
//       for (const item of oldItems) {
//         const key = `${item.code}_${item.batch}`;
//         if (!newMap.has(key)) {
//           const oldQty = Number(item.qty);

//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: item.code,
//               "batches.batchNo": item.batch,
//             },
//             { $inc: { "batches.$.qty": oldQty } }
//           );

//           // FIX: UPDATE TOTAL QTY
//           await recomputeTotalQty(item.code);

//           const openingStock = item.closingStock;
//           const closingStock = item.openingStock;

//           movementLogs.push({
//             code: item.code,
//             name: item.name,
//             batch: item.batch,
//             oldQty,
//             newQty: 0,
//             deltaQty: -oldQty,
//             openingStock,
//             closingStock,
//             direction: "increase",
//             reason: "row-cancel",
//             at: new Date(),
//             editedBy: req.user?.username || null,
//           });

//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: item.code,
//               "batches.batchNo": item.batch,
//             },
//             {
//               $push: {
//                 stockHistory: {
//                   date: new Date(),
//                   openingStock,
//                   closingStock,
//                   change: closingStock - openingStock,
//                   reason: "master-row-cancel",
//                   batchNo: item.batch,
//                 },
//               },
//             }
//           );
//         }
//       }

//       // =========================================================
//       // 3️⃣ SANITIZE NEW ITEMS & STOCK HISTORY
//       // =========================================================
//       const sanitizedItems = [];

//       for (const it of newItems) {
//         if (!it.code || !it.batch) continue;

//         const prod = await Product.findOne({
//           shop: req.shop._id,
//           code: it.code,
//           "batches.batchNo": it.batch,
//         });

//         const batchObj = prod?.batches?.find(
//           b => b.batchNo.toLowerCase() === it.batch.toLowerCase()
//         );

//         const currentQty = Number(batchObj?.qty || 0);
//         const newQty = Number(it.qty);
//         const oldItem = oldMap.get(`${it.code}_${it.batch}`);
//         const oldQty = oldItem ? Number(oldItem.qty) : 0;

//         const deltaQty = newQty - oldQty;

//         const closingStock = currentQty;
//         const openingStock = closingStock + newQty;

//         sanitizedItems.push({
//           ...it,
//           qty: newQty,
//           openingStock,
//           closingStock,
//         });

//         if (deltaQty !== 0) {
//           let direction, reason;

//           if (newQty === 0 || it.status === "cancelled") {
//             direction = "increase";
//             reason = "row-cancel";
//           } else if (deltaQty > 0) {
//             direction = "decrease";
//             reason = "edit-qty";
//           } else {
//             direction = "increase";
//             reason = "return";
//           }

//           movementLogs.push({
//             code: it.code,
//             name: it.name,
//             batch: it.batch,
//             oldQty,
//             newQty,
//             deltaQty,
//             openingStock,
//             closingStock,
//             direction,
//             reason,
//             at: new Date(),
//             editedBy: req.user?.username || null,
//           });

//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: it.code,
//               "batches.batchNo": it.batch,
//             },
//             {
//               $push: {
//                 stockHistory: {
//                   date: new Date(),
//                   openingStock,
//                   closingStock,
//                   change: closingStock - openingStock,
//                   reason,
//                   batchNo: it.batch,
//                 },
//               },
//             }
//           );

//           // FIX: UPDATE TOTAL QTY AGAIN
//           await recomputeTotalQty(it.code);
//         }
//       }

//       // =========================================================
//       // 4️⃣ SAVE BILL
//       // =========================================================
//       const hasActive = sanitizedItems.some(i => i.qty > 0 && i.status !== "cancelled");

//       const updateDoc = { ...req.body, items: sanitizedItems };

//       if (!hasActive) {
//         updateDoc.status = "cancelled";
//         updateDoc.total = 0;
//         updateDoc.netAmount = 0;

//         movementLogs = movementLogs.map(m => ({
//           ...m,
//           reason: "bill-cancel",
//         }));
//       }

//       updateDoc.movements = [
//         ...(existingBill.movements || []),
//         ...movementLogs,
//       ];

//       const updated = await SalesBill.findOneAndUpdate(
//         { _id: id, shop: req.shop._id },
//         updateDoc,
//         { new: true }
//       );

//       return res.json({
//         updated,
//         message: "Master bill updated successfully with correct stock & history",
//       });

//     } catch (err) {
//       console.error("Master bill update error:", err);
//       return res.status(500).json({
//         message: "Failed to update bill",
//         error: err.message,
//       });
//     }
//   }
// );




// router.put(
//   "/shops/:shopname/master-sales-bills/:id",
//   authTenantOrMaster,
//   async (req, res) => {
//     try {
//       const { SalesBill, Product } = req.tenantModels;
//       const { id } = req.params;

//       if (!mongoose.Types.ObjectId.isValid(id)) {
//         return res.status(400).json({ message: "Invalid bill ID" });
//       }

//       const existingBill = await SalesBill.findOne({
//         _id: id,
//         shop: req.shop._id,
//       });

//       if (!existingBill) {
//         return res.status(404).json({ message: "Bill not found" });
//       }

//       const oldItems = existingBill.items || [];
//       const newItems = req.body.items || [];

//       const oldMap = new Map(oldItems.map(it => [`${it.code}_${it.batch}`, it]));
//       const newMap = new Map(newItems.map(it => [`${it.code}_${it.batch}`, it]));

//       let movementLogs = [];

//       // ------------------------------------------------------------
//       // Helper: totalQty = sum of batches
//       // ------------------------------------------------------------
//       async function recomputeTotalQty(code) {
//         const prod = await Product.findOne({ shop: req.shop._id, code }).lean();
//         if (!prod) return;

//         const sum = (prod.batches || []).reduce((s, b) => s + Number(b.qty || 0), 0);

//         await Product.updateOne(
//           { shop: req.shop._id, code },
//           { $set: { totalQty: sum } }
//         );
//       }

//       // ------------------------------------------------------------
//       // 1️⃣ APPLY STOCK CHANGES FOR NEW / EDITED ROWS
//       // ------------------------------------------------------------
//       for (const item of newItems) {
//         const key = `${item.code}_${item.batch}`;
//         const oldItem = oldMap.get(key);

//         const oldQty = oldItem ? Number(oldItem.qty) : 0;
//         const newQty = Number(item.qty);
//         const delta = newQty - oldQty;

//         if (delta !== 0) {
//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: item.code,
//               "batches.batchNo": item.batch,
//             },
//             { $inc: { "batches.$.qty": -delta } } // +delta sell more, -delta return
//           );

//           await recomputeTotalQty(item.code);
//         }
//       }

//       // ------------------------------------------------------------
//       // 2️⃣ RESTORE STOCK FOR REMOVED ITEMS
//       // ------------------------------------------------------------
//       for (const item of oldItems) {
//         const key = `${item.code}_${item.batch}`;
//         if (!newMap.has(key)) {
//           const oldQty = Number(item.qty);

//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: item.code,
//               "batches.batchNo": item.batch,
//             },
//             { $inc: { "batches.$.qty": oldQty } } // restore fully
//           );

//           await recomputeTotalQty(item.code);

//           movementLogs.push({
//             code: item.code,
//             name: item.name,
//             batch: item.batch,
//             oldQty,
//             newQty: 0,
//             deltaQty: -oldQty,
//             openingStock: item.closingStock,
//             closingStock: item.openingStock,
//             direction: "increase",
//             reason: "row-cancel",
//             at: new Date(),
//             editedBy: req.user?.username || null,
//           });
//         }
//       }

//       // ------------------------------------------------------------
//       // 3️⃣ SANITIZE ITEMS & RECORD STOCK HISTORY
//       // ------------------------------------------------------------
//       const sanitizedItems = [];

//       for (const it of newItems) {
//         if (!it.code || !it.batch) continue;

//         const prod = await Product.findOne({
//           shop: req.shop._id,
//           code: it.code,
//         }).lean();

//         const oldItem = oldMap.get(`${it.code}_${it.batch}`);
//         const oldQty = oldItem ? Number(oldItem.qty) : 0;
//         const newQty = Number(it.qty);
//         const deltaQty = newQty - oldQty;

//         // get TRUE closing stock (after batch updates)
//         const freshProd = await Product.findOne({
//           shop: req.shop._id,
//           code: it.code,
//         }).lean();

//         const closingStock = Number(freshProd.totalQty || 0);
//         const openingStock = closingStock - deltaQty;

//         sanitizedItems.push({
//           ...it,
//           qty: newQty,
//           openingStock,
//           closingStock,
//         });

//         if (deltaQty !== 0) {
//           let direction, reason;

//           if (newQty === 0 || it.status === "cancelled") {
//             direction = "increase";
//             reason = "row-cancel";
//           } else if (deltaQty > 0) {
//             direction = "decrease";
//             reason = "edit-qty";
//           } else {
//             direction = "increase";
//             reason = "return";
//           }

//           movementLogs.push({
//             code: it.code,
//             name: it.name,
//             batch: it.batch,
//             oldQty,
//             newQty,
//             deltaQty,
//             openingStock,
//             closingStock,
//             direction,
//             reason,
//             at: new Date(),
//             editedBy: req.user?.username || null,
//           });

//           await Product.updateOne(
//             {
//               shop: req.shop._id,
//               code: it.code,
//             },
//             {
//               $push: {
//                 stockHistory: {
//                   date: new Date(),
//                   openingStock,
//                   closingStock,
//                   change: closingStock - openingStock,
//                   reason,
//                   batchNo: it.batch,
//                 },
//               },
//             }
//           );
//         }
//       }

//       // ------------------------------------------------------------
//       // 4️⃣ FINAL BILL SAVE
//       // ------------------------------------------------------------
//       const hasActive = sanitizedItems.some(i => i.qty > 0 && i.status !== "cancelled");

//       const updateDoc = { ...req.body, items: sanitizedItems };

//       if (!hasActive) {
//         updateDoc.status = "cancelled";
//         updateDoc.total = 0;
//         updateDoc.netAmount = 0;

//         movementLogs = movementLogs.map(m => ({
//           ...m,
//           reason: "bill-cancel",
//         }));
//       }

//       updateDoc.movements = [
//         ...(existingBill.movements || []),
//         ...movementLogs,
//       ];

//       const updated = await SalesBill.findOneAndUpdate(
//         { _id: id, shop: req.shop._id },
//         updateDoc,
//         { new: true }
//       );

//       return res.json({
//         updated,
//         message: "Master bill updated successfully with correct stock & history",
//       });

//     } catch (err) {
//       console.error("Master bill update error:", err);
//       return res.status(500).json({
//         message: "Failed to update bill",
//         error: err.message,
//       });
//     }
//   }
// );



// MASTER EDIT — FULL (product + batch level history)



router.put(
  "/shops/:shopname/master-sales-bills/:id",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { SalesBill, Product } = req.tenantModels;
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid bill ID" });
      }

      const existingBill = await SalesBill.findOne({
        _id: id,
        shop: req.shop._id,
      });

      if (!existingBill) {
        return res.status(404).json({ message: "Bill not found" });
      }

      const oldItems = existingBill.items || [];
      const newItems = req.body.items || [];

      const oldMap = new Map(oldItems.map(it => [`${it.code}_${it.batch}`, it]));
      const newMap = new Map(newItems.map(it => [`${it.code}_${it.batch}`, it]));

      const affectedCodes = new Set();
      oldItems.forEach(i => affectedCodes.add(i.code));
      newItems.forEach(i => affectedCodes.add(i.code));

      let movementLogs = [];

      // Helper: recompute and set totalQty for a product
      async function recomputeTotalQtyAndSet(code) {
        const prod = await Product.findOne({ shop: req.shop._id, code }).lean();
        if (!prod) return 0;
        const sum = (prod.batches || []).reduce((s, b) => s + Number(b.qty || 0), 0);
        await Product.updateOne({ shop: req.shop._id, code }, { $set: { totalQty: sum } });
        return sum;
      }

      // ------------------------------------------------------------
      // 0) Utility to fetch fresh product & batch qty
      // ------------------------------------------------------------
      async function getProductAndBatch(code, batchNo) {
        const prod = await Product.findOne({ shop: req.shop._id, code }).lean();
        if (!prod) return { prod: null, batchQty: 0 };
        const batchObj = (prod.batches || []).find(
          b => String(b.batchNo || "").toLowerCase() === String(batchNo || "").toLowerCase()
        );
        return { prod, batchQty: Number(batchObj?.qty || 0) };
      }

      // ------------------------------------------------------------
      // 1) PROCESS REMOVED ROWS FIRST (restore stock for removed rows)
      //    (old row exists but not present in newItems -> we should restore old qty)
      // ------------------------------------------------------------
      for (const oldItem of oldItems) {
        const key = `${oldItem.code}_${oldItem.batch}`;
        if (!newMap.has(key)) {
          const code = oldItem.code;
          const batchNo = oldItem.batch;
          const restoreQty = Number(oldItem.qty || 0);
          if (restoreQty === 0) continue;

          // read BEFORE snapshots
          const before = await getProductAndBatch(code, batchNo);
          const productOpening_before = Number(before.prod?.totalQty || 0);
          const batchOpening_before = Number(before.batchQty || 0);

          // restore batch qty (add old qty back)
          await Product.updateOne(
            {
              shop: req.shop._id,
              code,
              "batches.batchNo": batchNo,
            },
            { $inc: { "batches.$.qty": restoreQty } }
          );

          // recompute totalQty
          const productAfterTotal = await recomputeTotalQtyAndSet(code);

          // read AFTER snapshots
          const after = await getProductAndBatch(code, batchNo);
          const productClosing_after = Number(after.prod?.totalQty || 0);
          const batchClosing_after = Number(after.batchQty || 0);

          // movement log (bill-level)
          movementLogs.push({
            code,
            name: oldItem.name,
            batch: batchNo,
            oldQty: Number(oldItem.qty || 0),
            newQty: 0,
            deltaQty: -Number(oldItem.qty || 0),
            openingStock: productOpening_before,
            closingStock: productClosing_after,
            direction: "increase",
            reason: "row-cancel",
            at: new Date(),
            editedBy: req.user?.username || null,
          });

          // push product-level stock history (authoritative for reports)
          await Product.updateOne(
            { shop: req.shop._1d, code }, // <-- shop _id used below; but to avoid accidental typo we call correct filter
            {} // placeholder: we'll instead use the Product.updateOne below to push. We'll do an unconditional $push using correct query.
          ).catch(() => { }); // noop to keep flow; actual push follows

          // push product-level history
          await Product.updateOne(
            { shop: req.shop._id, code },
            {
              $push: {
                stockHistory: {
                  date: new Date(),
                  openingStock: productOpening_before,
                  closingStock: productClosing_after,
                  change: productClosing_after - productOpening_before,
                  reason: "master-row-cancel",
                  batchNo: null,
                },
              },
            }
          );

          // push batch-level history
          // await Product.updateOne(
          //   { shop: req.shop._id, code, "batches.batchNo": batchNo },
          //   {
          //     $push: {
          //       stockHistory: {
          //         date: new Date(),
          //         openingStock: batchOpening_before,
          //         closingStock: batchClosing_after,
          //         change: batchClosing_after - batchOpening_before,
          //         reason: "master-row-cancel",
          //         batchNo,
          //       },
          //     },
          //   }
          // );
        }
      }

      // ------------------------------------------------------------
      // 2) PROCESS NEW/EDITED ROWS SEQUENTIALLY (apply deltas per row)
      //    This ensures we can record before/after for both product & batch
      // ------------------------------------------------------------
      for (const item of newItems) {
        if (!item.code || !item.batch) continue;

        const code = item.code;
        const batchNo = item.batch;
        const newQty = Number(item.qty || 0);
        const oldItem = oldMap.get(`${code}_${batchNo}`);
        const oldQty = oldItem ? Number(oldItem.qty || 0) : 0;
        const delta = newQty - oldQty;

        // nothing changed -> skip
        if (delta === 0) {
          // still add sanitized item but without movement
          continue;
        }

        // read BEFORE snapshots (product total and batch qty)
        const before = await getProductAndBatch(code, batchNo);
        const productOpening_before = Number(before.prod?.totalQty || 0);
        const batchOpening_before = Number(before.batchQty || 0);

        // apply change on the batch:
        // - when delta > 0: user increased sold qty => decrease batch by delta
        // - when delta < 0: user decreased sold qty (a return) => increase batch by |delta|
        await Product.updateOne(
          {
            shop: req.shop._id,
            code,
            "batches.batchNo": batchNo,
          },
          { $inc: { "batches.$.qty": -delta } }
        );

        // recompute totalQty for this product after change
        const productAfterTotal = await recomputeTotalQtyAndSet(code);

        // read AFTER snapshots
        const after = await getProductAndBatch(code, batchNo);
        const productClosing_after = Number(after.prod?.totalQty || 0);
        const batchClosing_after = Number(after.batchQty || 0);

        // decide direction & reason
        let direction, reason;
        if (newQty === 0 || item.status === "cancelled") {
          direction = "increase"; // stock increased (we put items back)
          reason = "row-cancel";
        } else if (delta > 0) {
          direction = "decrease"; // sold more => stock decreased
          reason = "edit-qty";
        }

        // --------------------------------------------
        // ✅ PRODUCT-LEVEL SOLD TRACKING (CRITICAL)
        // --------------------------------------------
        if (delta > 0) {
          // qty increased => extra sale
          await Product.updateOne(
            { shop: req.shop._id, code },
            {
              $inc: { totalSoldQty: delta },
              $push: {
                productSales: {
                  date: new Date(),
                  qty: delta,
                  billId: existingBill._id,
                  billNo: existingBill.billNo,
                  counter: existingBill.counter,
                  soldBy: req.user?.username || "master",
                  reason: "master-edit-sale",
                },
              },
            }
          );
        }


        else {
          direction = "increase"; // returned => stock increased
          reason = "return";
        }

        // build movement log
        movementLogs.push({
          code,
          name: item.name,
          batch: batchNo,
          oldQty,
          newQty,
          deltaQty: delta,
          openingStock: productOpening_before,
          closingStock: productClosing_after,
          direction,
          reason,
          at: new Date(),
          editedBy: req.user?.username || null,
        });

        // push product-level stock history entry
        await Product.updateOne(
          { shop: req.shop._id, code },
          {
            $push: {
              stockHistory: {
                date: new Date(),
                openingStock: productOpening_before,
                closingStock: productClosing_after,
                change: productClosing_after - productOpening_before,
                reason,
                batchNo: null,
              },
            },
          }
        );

        // push batch-level stock history entry
        // await Product.updateOne(
        //   { shop: req.shop._id, code, "batches.batchNo": batchNo },
        //   {
        //     $push: {
        //       stockHistory: {
        //         date: new Date(),
        //         openingStock: batchOpening_before,
        //         closingStock: batchClosing_after,
        //         change: batchClosing_after - batchOpening_before,
        //         reason,
        //         batchNo,
        //       },
        //     },
        //   }
        // );
      }

      // ------------------------------------------------------------
      // 3) SANITIZE ITEMS FOR STORAGE IN BILL (include both product/batch snapshot)
      // ------------------------------------------------------------
      const sanitizedItems = [];
      for (const it of newItems) {
        if (!it.code || !it.batch) continue;

        // get latest snapshots for product & batch
        const { prod, batchQty } = await getProductAndBatch(it.code, it.batch);
        const productTotal = Number(prod?.totalQty || 0);
        const batchClosing = Number(batchQty || 0);

        // item-level opening/closing: we store both product-level and batch-level:
        sanitizedItems.push({
          ...it,
          qty: Number(it.qty || 0),
          // product-level snapshot
          openingStock: Number(prod?.stockHistory?.length ? (
            // compute opening as last stockHistory closing before this change if available:
            // but here we store current authoritative values (closing) and for opening we can leave as previous closing
            // For simplicity, set product-level opening = productTotal - qty (approx previous); but better to compute from last history.
            // We'll store the immediate pair: openingStock (product) = productTotal - Number(it.qty || 0)
            productTotal - Number(it.qty || 0)
          ) : (productTotal - Number(it.qty || 0))),
          closingStock: productTotal,
          // batch-level snapshot
          batchOpeningStock: batchClosing + Number(it.qty || 0), // previous batch opening before this sell -> approximate
          batchClosingStock: batchClosing,
        });
      }

      // ------------------------------------------------------------
      // 4) SAVE BILL (movements appended)
      // ------------------------------------------------------------
      const hasActive = sanitizedItems.some(i => i.qty > 0 && i.status !== "cancelled");


      // ---------- PAYMENT NORMALIZATION ----------
      const paymentMethod = req.body.paymentMethod || "cash";
      const payment = {
        cash: Number(req.body.payment?.cash || 0),
        upi: Number(req.body.payment?.upi || 0),
      };

      const amountPaid = payment.cash + payment.upi;

      // netAmount already computed in frontend edit payload
      const netAmount = Number(req.body.netAmount || 0);

      let balanceDue = +(netAmount - amountPaid).toFixed(2);
      if (!hasActive) balanceDue = 0;

      // paymentStatus
      let paymentStatus = "unpaid";
      if (!hasActive) {
        paymentStatus = "cancelled";
      } else if (amountPaid >= netAmount) {
        paymentStatus = "paid";
      } else if (amountPaid > 0) {
        paymentStatus = "partial";
      }



      const updateDoc = {
        ...req.body, items: sanitizedItems,

        // override payment fields (authoritative)
        paymentMethod,
        payment,
        amountPaid,
        balanceDue,
        paymentStatus,

      };

      if (!hasActive) {
        updateDoc.status = "cancelled";
        updateDoc.total = 0;
        updateDoc.netAmount = 0;

        movementLogs = movementLogs.map(m => ({ ...m, reason: "bill-cancel" }));
      }

      updateDoc.movements = [
        ...(existingBill.movements || []),
        ...movementLogs,
      ];



      const updated = await SalesBill.findOneAndUpdate(
        { _id: id, shop: req.shop._id },
        updateDoc,
        { new: true }
      );




      return res.json({
        updated,
        message: "Master bill updated successfully with correct product + batch stock history",
      });
    } catch (err) {
      console.error("Master bill update error:", err);
      return res.status(500).json({
        message: "Failed to update bill",
        error: err.message,
      });
    }
  }
);





router.get(
  "/shops/:shopname/master-sales-bills/:id",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { SalesBill } = req.tenantModels;
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid bill ID" });
      }

      const bill = await SalesBill.findOne({
        _id: id,
        shop: req.shop._id,
      });

      if (!bill) {
        return res.status(404).json({ message: "Bill not found" });
      }

      res.json({ bill, accessedBy: req.authType });
    } catch (err) {
      console.error("Get master bill error:", err);
      res.status(500).json({
        message: "Failed to get bill",
        error: err.message,
      });
    }
  }
);



// GET sales summary
router.get("/shops/:shopname/sales-bills/summary", authTenantOrMaster, async (req, res) => {
  try {
    const { SalesBill } = req.tenantModels;
    const shopId = req.shop._id;
    const period = req.query.period; // e.g., 'today', 'this-week', 'this-month'

    let start, end;
    const now = new Date();

    if (period === "today") {
      start = new Date(now.setHours(0, 0, 0, 0));
      end = new Date(now.setHours(23, 59, 59, 999));
    } else if (period === "this-week") {
      const day = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (period === "this-month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      return res.status(400).json({ message: "Invalid period" });
    }

    const totalSales = await SalesBill.aggregate([
      { $match: { shop: shopId, date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalAmount" }, // adjust field name
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      shop: req.shop.shopname,
      period,
      summary: totalSales[0] || { totalAmount: 0, count: 0 },
    });
  } catch (err) {
    console.error("Sales summary error:", err);
    res.status(500).json({ message: "Failed to fetch sales summary", error: err.message });
  }
});


// GET /shops/:shopname/sales-bills/next-billno
router.get("/shops/:shopname/sales-bills/next-billno", authTenantOrMaster, async (req, res) => {
  try {
    const shopname = req.params.shopname;
    const nextBillNo = await getNextBillNo(shopname); // ensure atomic handling inside function
    res.json({ nextBillNo });
  } catch (err) {
    console.error("Get next bill number error:", err.message);
    res.status(500).json({ message: `Failed to get next bill number: ${err.message}` });
  }
});

// POST /shops/:shopname/sales-bills
router.post("/shops/:shopname/sales-bills", authTenantOrMaster, async (req, res) => {
  try {
    const { SalesBill } = req.tenantModels;
    const bill = new SalesBill({ ...req.body, shop: req.shop._id });

    // Optional: Validate products exist & stock
    // Could loop over bill.items and check stock if needed

    const saved = await bill.save();
    res.status(201).json({ saved, accessedBy: req.authType });
  } catch (err) {
    console.error("Create sales bill error:", err);
    res.status(500).json({ message: "Failed to create sales bill", error: err.message });
  }
});

// GET all customers with pagination & status filter
router.get("/shops/:shopname/customers", authTenantOrMaster, async (req, res) => {
  try {
    const { Customer } = req.tenantModels;
    const { page = 1, limit = 10, search = "", status = "" } = req.query;

    if (!req.shop?._id) return res.status(400).json({ message: "Shop context missing" });

    const query = { shop: req.shop._id };

    if (search) {
      const regex = new RegExp(search, "i"); // case-insensitive
      query.$or = [{ name: regex }, { mobile: regex }];
    }

    if (status) {
      query.status = status.toLowerCase();
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Customer.countDocuments(query);
    const totalPages = Math.ceil(total / Number(limit));

    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      shop: { _id: req.shop._id, shopname: req.shop.shopname },
      customers,
      page: Number(page),
      totalPages,
      total,
      accessedBy: req.authType,
    });
  } catch (err) {
    console.error("Fetch customers error:", err);
    res.status(500).json({ message: "Failed to fetch customers" });
  }
});


// GET single customer by ID
router.get("/shops/:shopname/customers/:id", authTenantOrMaster, async (req, res) => {
  try {
    const { Customer } = req.tenantModels;
    const customer = await Customer.findOne({ _id: req.params.id, shop: req.shop._id });
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
  } catch (err) {
    console.error("Fetch customer error:", err);
    res.status(500).json({ message: "Failed to fetch customer" });
  }
});

// POST create new customer
router.post("/shops/:shopname/customers", authTenantOrMaster, async (req, res) => {
  try {
    const { Customer } = req.tenantModels;
    const { name, mobile, address, status } = req.body;
    if (!name || !mobile) return res.status(400).json({ message: "Name and Mobile are required" });

    const newCustomer = new Customer({
      name,
      mobile,
      address,
      status: status || "active",
      shop: req.shop._id,
    });

    await newCustomer.save();
    res.status(201).json({
      shop: { _id: req.shop._id, shopname: req.shop.shopname },
      customer: newCustomer,
      accessedBy: req.authType,
    });
  } catch (err) {
    console.error("Create customer error:", err);
    res.status(500).json({ message: "Failed to create customer" });
  }
});

// PUT update customer
router.put("/shops/:shopname/customers/:id", authTenantOrMaster, async (req, res) => {
  try {
    const { Customer } = req.tenantModels;
    const updated = await Customer.findOneAndUpdate(
      { _id: req.params.id, shop: req.shop._id },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Customer not found" });
    res.json(updated);
  } catch (err) {
    console.error("Update customer error:", err);
    res.status(500).json({ message: "Failed to update customer" });
  }
});

// PATCH update customer status
router.patch("/shops/:shopname/customers/:id/status", authTenantOrMaster, async (req, res) => {
  try {
    const { Customer } = req.tenantModels;
    const { status } = req.body;
    if (!["active", "inactive"].includes(status)) return res.status(400).json({ message: "Invalid status value" });

    const updated = await Customer.findOneAndUpdate(
      { _id: req.params.id, shop: req.shop._id },
      { status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Customer not found" });
    res.json(updated);
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ message: "Failed to update status" });
  }
});

// DELETE customer
router.delete("/shops/:shopname/customers/:id", authTenantOrMaster, async (req, res) => {
  try {
    const { Customer } = req.tenantModels;
    const deleted = await Customer.findOneAndDelete({ _id: req.params.id, shop: req.shop._id });
    if (!deleted) return res.status(404).json({ message: "Customer not found" });
    res.json({ message: "Customer deleted" });
  } catch (err) {
    console.error("Delete customer error:", err);
    res.status(500).json({ message: "Failed to delete customer" });
  }
});

// -------------------------
// Users (tenant-only)
// -------------------------
router.get("/shops/:shopname/users", authTenantOrMaster, async (req, res) => {
  try {
    const { User } = req.tenantModels;
    const users = await User.find({ shop: req.shop._id }).sort({ createdAt: -1 });
    res.json({ shop: { _id: req.shop?._id, shopname: req.shop?.shopname }, users, accessedBy: req.authType });
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});





router.get(
  "/shops/:shopname/expenses",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { Expense } = req.tenantModels;
      const shopId = req.shop?._id || req.user?.shopId;

      if (!shopId) {
        return res.status(400).json({ message: "Shop context missing" });
      }

      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 10);
      const skip = (page - 1) * limit;

      const search = (req.query.search || "").trim();
      const dateRange = req.query.dateRange || "all"; // all, today, week, month, custom
      const type = req.query.type || "all"; // all, bill, voucher
      const from = req.query.from;
      const to = req.query.to;

      const query = { shop: shopId };

      // search filter
      if (search) {
        query.$or = [
          { receiptNo: { $regex: search, $options: "i" } },
          { reason: { $regex: search, $options: "i" } },
          { refNumber: { $regex: search, $options: "i" } },
          { addedByName: { $regex: search, $options: "i" } },
          { spendTo: { $regex: search, $options: "i" } },
        ];
      }

      // date filter
      if (dateRange !== "all") {
        const now = new Date();
        let start = null;
        let end = null;

        if (dateRange === "today") {
          start = new Date(now);
          start.setHours(0, 0, 0, 0);
          end = new Date(now);
          end.setHours(23, 59, 59, 999);
        } else if (dateRange === "week") {
          end = new Date(now);
          end.setHours(23, 59, 59, 999);
          start = new Date(now);
          start.setDate(start.getDate() - 6);
          start.setHours(0, 0, 0, 0);
        } else if (dateRange === "month") {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          start.setHours(0, 0, 0, 0);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          end.setHours(23, 59, 59, 999);
        } else if (dateRange === "custom" && from && to) {
          start = new Date(from);
          start.setHours(0, 0, 0, 0);
          end = new Date(to);
          end.setHours(23, 59, 59, 999);
        }

        if (start && end) {
          query.date = { $gte: start, $lte: end };
        }
      }

      // bill / voucher filter
      if (type === "bill" || type === "voucher") {
        query.refType = type;
      }


      if (req.query.category) {
        query.category = req.query.category;
      }


      const total = await Expense.countDocuments(query);

      const expenses = await Expense.find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      res.json({
        expenses,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      console.error("listExpenses ERROR:", err);
      res.status(500).json({
        message: "Failed to list expenses",
        error: err.message,
      });
    }
  }
);









//Branch reports 


// ---------------------------------------------
// LIST SALES BILLS (tenant / manager / megaadmin)
// ---------------------------------------------
router.get("/shops/:shopname/branch-reports/salesbills", authTenantOrMaster, async (req, res) => {
  try {
    const { shopname } = req.params;

    // ---------------- LOAD TENANT MODEL ----------------
    let SalesBill;
    let shopId;

    // Case 1: Already loaded by tenant middleware (tenant user)
    if (req.tenantModels) {
      SalesBill = req.tenantModels.SalesBill;
      shopId = req.shop?._id || req.user?.shopId || null;
    }

    // Case 2: Manager / Megaadmin → manually load DB
    else if (req.dbManager && req.dbManager.getTenantDb) {
      const tenantDb = req.dbManager.getTenantDb(shopname);

      if (!tenantDb) {
        return res.status(404).json({
          message: `Shop '${shopname}' not found or inactive`,
        });
      }

      SalesBill = tenantDb.model("SalesBill");
    }

    // Safety
    else {
      return res.status(500).json({ message: "Tenant DB manager not initialized" });
    }

    if (!SalesBill)
      return res.status(400).json({ message: "SalesBill model not found" });

    // ---------------- PARSE QUERY PARAMS ----------------
    const page = Math.max(1, Number(req.query.page) || 1);
    const limitParam = Number(req.query.limit);
    const limit = limitParam >= 0 ? limitParam : 10; // allow limit=0 → fetch ALL
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";
    const counter = req.query.counter?.trim() || "";

    const from = req.query.from;
    const to = req.query.to;

    const {
      export: isExport,
    } = req.query;

    // ---------------- BUILD QUERY ----------------
    const query = {};
    if (shopId) query.shop = shopId;

    // SEARCH
    if (search) {
      const s = new RegExp(search, "i");

      query.$or = [
        { billNo: s },
        { customerName: s },
        { mobile: s },
        { counter: !isNaN(search) ? Number(search) : undefined },
      ].filter(Boolean);
    }

    // COUNTER FILTER
    if (counter !== "") {
      query.counter = Number(counter);
    }

    // DATE RANGE FILTER
    if (from && to) {
      const start = new Date(from);
      const end = new Date(to);

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      query.date = { $gte: start, $lte: end };
    }



    /* =====================================================
       ⭐ EXPORT MODE (PRINT / PDF) — NO PAGINATION
       ===================================================== */
    if (isExport) {
      const bills = await SalesBill.find(query).sort({ date: 1 }).lean();

      const totalNetAmount = bills.reduce(
        (s, b) => s + Number(b.netAmount || 0),
        0
      );

      return res.json({
        bills,
        summary: {
          totalBills: bills.length,
          totalNetAmount,
        },
      }); // ✅ VERY IMPORTANT RETURN
    }


    // ---------------- COUNT + FETCH ----------------
    const total = await SalesBill.countDocuments(query);

    let billQuery = SalesBill.find(query).sort({ createdAt: -1 });

    // Search → fetch up to 500 items
    if (search) {
      billQuery = billQuery.limit(500);
    }
    else if (limit > 0) {
      billQuery = billQuery.skip(skip).limit(limit);
    }

    const bills = await billQuery.lean();

    // ---------------- RESPONSE ----------------
    const totalPages = limit > 0 ? Math.ceil(total / limit) || 1 : 1;

    res.json({
      bills,
      page,
      limit,
      total,
      totalPages,
      searchMode: !!search,
    });

  } catch (err) {
    console.error("❌ /shops/:shopname/branch-reports/salesbills error:", err);
    res.status(500).json({
      message: "Failed to fetch sales bills",
      error: err.message,
    });
  }
});







// ---------------------------------------------
// ITEMWISE BILL REPORT
// GET /shops/:shopname/branch-reports/itemwise/bills
// ---------------------------------------------
router.get("/shops/:shopname/branch-reports/itemwise/bills", authTenantOrMaster, async (req, res) => {
  try {
    const { shopname } = req.params;

    let SalesBill;
    let shopId;

    // Tenant user
    if (req.tenantModels) {
      SalesBill = req.tenantModels.SalesBill;
      shopId = req.shop?._id || req.user?.shopId || null;
    }
    // Manager / Megaadmin
    else if (req.dbManager && req.dbManager.getTenantDb) {
      const tenantDb = req.dbManager.getTenantDb(shopname);
      if (!tenantDb)
        return res.status(404).json({ message: `Shop '${shopname}' not found` });

      SalesBill = tenantDb.model("SalesBill");
    } else {
      return res.status(500).json({ message: "Tenant DB manager not initialized" });
    }

    if (!SalesBill)
      return res.status(400).json({ message: "SalesBill model missing" });

    // --- Query Params ---
    const counter = req.query.counter?.trim();
    const search = req.query.search?.trim();
    const from = req.query.from;
    const to = req.query.to;


    const query = {};

    if (shopId) query.shop = shopId;
    if (counter) query.counter = Number(counter);

    if (search) {
      const s = new RegExp(search, "i");
      query.$or = [
        { billNo: s },
        { customerName: s },
        { mobile: s }
      ];
    }

    if (from && to) {
      const start = new Date(from);
      const end = new Date(to);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    // ⭐ GET ALL BILLS — NO PAGINATION
    const bills = await SalesBill.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // ⭐ PRODUCT-WISE MERGE FOR EACH BILL
    // for (let bill of bills) {
    //   const map = new Map();

    //   for (const it of bill.items || []) {
    //     if (!map.has(it.code)) {
    //       map.set(it.code, {
    //         code: it.code,
    //         name: it.name,
    //         qty: 0,
    //         rate: it.rate,
    //         gst: it.gst,
    //         gstAmount: 0,
    //         value: 0
    //       });
    //     }

    //     const entry = map.get(it.code);
    //     entry.qty += Number(it.qty || 0);
    //     entry.gstAmount += Number(it.gstAmount || 0);
    //     entry.value += Number(it.value || 0);
    //   }

    //   bill.items = Array.from(map.values()); // overwrite items with merged items
    // }


    // ⭐ PRODUCT-WISE MERGE FOR EACH BILL
    for (let bill of bills) {
      const map = new Map();

      for (const it of bill.items || []) {
        if (!map.has(it.code)) {
          map.set(it.code, {
            code: it.code,
            name: it.name,
            qty: 0,
            rate: it.rate,
            gst: it.gst,
            gstAmount: 0,
            value: 0
          });
        }

        const entry = map.get(it.code);
        entry.qty += Number(it.qty || 0);
        entry.value += Number(it.value || 0);

        // ⭐ CORRECT GST CALCULATION
        let gstAmt = 0;

        if (it.isInclusive) {
          // GST INCLUSIVE → GST extracted from value
          gstAmt = it.value - (it.value / (1 + it.gst / 100));
        } else {
          // GST EXCLUSIVE → taxable * gst%
          gstAmt = (it.taxable * it.gst) / 100;
        }

        entry.gstAmount += gstAmt;
      }

      bill.items = Array.from(map.values()); // overwrite items with merged items
    }


    res.json({
      bills,
      total: bills.length
    });

  } catch (err) {
    console.error("❌ itemwise/bills error:", err);
    res.status(500).json({ message: "Failed to fetch bill-wise data", error: err.message });
  }
});




// router.get(
//   "/shops/:shopname/branch-reports/itemwise/sales",
//   authTenantOrMaster,
//   async (req, res) => {
//     try {
//       const { shopname } = req.params;

//       let SalesBill, Product;
//       let shopId;

//       // TENANT
//       if (req.tenantModels) {
//         SalesBill = req.tenantModels.SalesBill;
//         Product = req.tenantModels.Product;
//         shopId = req.shop?._id || req.user?.shopId || null;
//       }
//       // MANAGER / MEGAADMIN
//       else if (req.dbManager && req.dbManager.getTenantDb) {
//         const tenantDb = req.dbManager.getTenantDb(shopname);
//         if (!tenantDb)
//           return res
//             .status(404)
//             .json({ message: `Shop '${shopname}' not found` });

//         SalesBill = tenantDb.model("SalesBill");
//         Product = tenantDb.model("Product");
//       } else {
//         return res
//           .status(500)
//           .json({ message: "Tenant DB manager not initialized" });
//       }

//       if (!SalesBill || !Product)
//         return res.status(400).json({ message: "Models missing" });

//       const counter = req.query.counter?.trim();
//       const from = req.query.from;
//       const to = req.query.to;
//       const isExport = req.query.export === "1";

//       const match = {};
//       if (shopId) match.shop = shopId;
//       if (counter) match.counter = Number(counter);

//       if (from && to) {
//         const f = new Date(from);
//         const t = new Date(to);
//         f.setHours(0, 0, 0, 0);
//         t.setHours(23, 59, 59, 999);
//         match.date = { $gte: f, $lte: t };
//       }

//       const rows = await SalesBill.aggregate([
//         { $match: match },
//         { $unwind: "$items" },
//         {
//           $addFields: {
//             "items.gstAmountCalc": {
//               $cond: [
//                 "$items.isInclusive",
//                 {
//                   $subtract: [
//                     "$items.value",
//                     {
//                       $divide: [
//                         "$items.value",
//                         { $add: [1, { $divide: ["$items.gst", 100] }] }
//                       ]
//                     }
//                   ]
//                 },
//                 {
//                   $multiply: [
//                     "$items.taxable",
//                     { $divide: ["$items.gst", 100] }
//                   ]
//                 }
//               ]
//             }
//           }
//         },
//         {
//           $group: {
//             _id: "$items.code",
//             code: { $first: "$items.code" },
//             name: { $first: "$items.name" },
//             qty: { $sum: "$items.qty" },
//             totalSales: { $sum: "$items.value" },
//             totalGst: { $sum: "$items.gstAmountCalc" },
//             openingList: { $push: "$items.openingStock" },
//             closingList: { $push: "$items.closingStock" }
//           }
//         },
//         { $sort: { name: 1 } }
//       ]);

//       // Stock calculation
//       for (const it of rows) {
//         let closing = it.closingList.filter(Boolean);
//         let closingStock = closing.at(-1) ?? 0;

//         if (!closingStock) {
//           const prod = await Product.findOne({ code: it.code }).lean();
//           closingStock =
//             prod?.batches?.reduce(
//               (s, b) => s + Number(b.qty || 0),
//               0
//             ) || 0;
//         }

//         it.closingStock = closingStock;
//         it.openingStock = closingStock + it.qty;
//         it.netSale = it.totalSales + it.totalGst;
//       }

//       const summary = {
//         totalItemsSold: rows.reduce((s, r) => s + r.qty, 0),
//         totalSales: rows.reduce((s, r) => s + r.totalSales, 0),
//         totalGst: rows.reduce((s, r) => s + r.totalGst, 0),
//         totalNetSale: rows.reduce(
//           (s, r) => s + r.totalSales + r.totalGst,
//           0
//         )
//       };

//       const firstBill = await SalesBill.findOne(match)
//         .sort({ date: 1 })
//         .select("date")
//         .lean();

//       const lastBill = await SalesBill.findOne(match)
//         .sort({ date: -1 })
//         .select("date")
//         .lean();

//       let items = rows;
//       let pagination;

//       if (!isExport) {
//         const page = Math.max(1, Number(req.query.page || 1));
//         const limit = Math.max(1, Number(req.query.limit || 10));

//         const totalRecords = rows.length;
//         const totalPages = Math.ceil(totalRecords / limit);

//         items = rows.slice((page - 1) * limit, page * limit);
//         pagination = { page, totalPages, totalRecords };
//       }

//       return res.json({
//         items,
//         summary,
//         total: rows.length,
//         firstDate: firstBill?.date || null,
//         lastDate: lastBill?.date || null,
//         ...(pagination ? { pagination } : {})
//       });
//     } catch (err) {
//       console.error("❌ getItemwiseSalesReport error:", err);
//       return res.status(500).json({
//         message: "Failed to fetch sales-wise report",
//         error: err.message
//       });
//     }
//   }
// );



// router.get(
//   "/shops/:shopname/branch-reports/datewise",
//   authTenantOrMaster,
//   async (req, res) => {
//     try {
//       const { shopname } = req.params;

//       let SalesBill;
//       let shopId;

//       // TENANT
//       if (req.tenantModels) {
//         SalesBill = req.tenantModels.SalesBill;
//         shopId = req.shop?._id || req.user?.shopId || null;
//       }
//       // MEGAADMIN
//       else if (req.dbManager && req.dbManager.getTenantDb) {
//         const tenantDb = req.dbManager.getTenantDb(shopname);
//         if (!tenantDb)
//           return res
//             .status(404)
//             .json({ message: `Shop '${shopname}' not found` });

//         SalesBill = tenantDb.model("SalesBill");
//       } else {
//         return res
//           .status(500)
//           .json({ message: "Tenant DB manager not initialized" });
//       }

//       if (!SalesBill)
//         return res.status(400).json({ message: "SalesBill model missing" });

//       // QUERY PARAMS
//       const { from, to } = req.query;

//       let start, end;

//       if (!from || !to) {
//         start = new Date(0);
//         end = new Date();
//         end.setHours(23, 59, 59, 999);
//       } else {
//         start = new Date(from);
//         end = new Date(to);
//         start.setHours(0, 0, 0, 0);
//         end.setHours(23, 59, 59, 999);
//       }

//       const match = { date: { $gte: start, $lte: end } };
//       if (shopId) match.shop = shopId;

//       // ⭐ FIXED AGGREGATION
//       const data = await SalesBill.aggregate([
//         { $match: match },

//         // multiply rows by items
//         { $unwind: "$items" },

//         {
//           $group: {
//             _id: {
//               year: { $year: "$date" },
//               month: { $month: "$date" },
//               day: { $dayOfMonth: "$date" },
//             },

//             // ⭐ FIX — collect billNo instead of counting rows
//             billNos: { $addToSet: "$billNo" },

//             qty: { $sum: "$items.qty" },
//             totalSales: { $sum: "$netAmount" }
//           }
//         },

//         {
//           $addFields: {
//             // ⭐ FIX — actual count
//             billCount: { $size: "$billNos" },

//             date: {
//               $dateFromParts: {
//                 year: "$_id.year",
//                 month: "$_id.month",
//                 day: "$_id.day",
//               }
//             }
//           }
//         },

//         { $sort: { date: 1 } }
//       ]);

//       // SUMMARY
//       const summary = data.reduce(
//         (a, r) => {
//           a.totalBills += r.billCount;
//           a.totalQty += r.qty;
//           a.totalSales += r.totalSales;
//           return a;
//         },
//         { totalBills: 0, totalQty: 0, totalSales: 0 }
//       );


//    /* ---------------- PAGINATION ---------------- */
//     const page = Math.max(1, parseInt(req.query.page || 1));
//     const limit = Math.max(1, parseInt(req.query.limit || 10));

//     const totalRecords = data.length;
//     const totalPages = Math.ceil(totalRecords / limit);

//     const startIndex = (page - 1) * limit;
//     const pagedData = data.slice(startIndex, startIndex + limit);


//       // res.json({
//       //   rows: data,
//       //   summary,
//       // });


//               /* ---------------- RESPONSE ---------------- */
//     res.json({
//       rows: pagedData,
//       summary,
//       pagination: {
//         page,
//         totalPages,
//         totalRecords
//       }
//     });

//     } catch (err) {
//       console.error("❌ datewise error:", err);
//       res.status(500).json({
//         message: "Failed to load date-wise data",
//         error: err.message,
//       });
//     }
//   }
// );




//collection reports






// router.get(
//   "/shops/:shopname/branch-reports/itemwise/sales",
//   authTenantOrMaster,
//   async (req, res) => {
//     try {
//       const { shopname } = req.params;

//       let SalesBill, Product;
//       let shopId;

//       // ---------------- TENANT ----------------
//       if (req.tenantModels) {
//         SalesBill = req.tenantModels.SalesBill;
//         Product = req.tenantModels.Product;
//         shopId = req.shop?._id || req.user?.shopId || null;
//       }

//       // ---------------- MANAGER / MEGAADMIN ----------------
//       else if (req.dbManager?.getTenantDb) {
//         const tenantDb = req.dbManager.getTenantDb(shopname);
//         if (!tenantDb) {
//           return res
//             .status(404)
//             .json({ message: `Shop '${shopname}' not found` });
//         }

//         SalesBill = tenantDb.model("SalesBill");
//         Product = tenantDb.model("Product");
//       } else {
//         return res
//           .status(500)
//           .json({ message: "Tenant DB manager not initialized" });
//       }

//       if (!SalesBill || !Product) {
//         return res.status(400).json({ message: "Models missing" });
//       }

//       // ---------------- DATE FILTER ----------------
//       const match = {};
//       if (shopId) match.shop = shopId;

//       let fromDate, toDate;

//       if (req.query.from && req.query.to) {
//         // User-selected range
//         fromDate = new Date(req.query.from);
//         toDate = new Date(req.query.to);
//         match.date = { $gte: fromDate, $lte: toDate };
//       } else {
//         // DEFAULT: FULL HISTORY
//         fromDate = new Date("1970-01-01T00:00:00.000Z");
//         toDate = new Date();
//       }

//       // ---------------- BILLING AGGREGATION ----------------
//       const rows = await SalesBill.aggregate([
//         { $match: match },
//         { $unwind: "$items" },
//         {
//           $group: {
//             _id: "$items.code",
//             code: { $first: "$items.code" },
//             name: { $first: "$items.name" },
//             totalSales: { $sum: "$items.value" },
//             totalGst: {
//               $sum: {
//                 $cond: [
//                   "$items.isInclusive",
//                   {
//                     $subtract: [
//                       "$items.value",
//                       {
//                         $divide: [
//                           "$items.value",
//                           { $add: [1, { $divide: ["$items.gst", 100] }] }
//                         ]
//                       }
//                     ]
//                   },
//                   {
//                     $multiply: [
//                       "$items.taxable",
//                       { $divide: ["$items.gst", 100] }
//                     ]
//                   }
//                 ]
//               }
//             }
//           }
//         }
//       ]);

//       // ---------------- STOCK LOGIC (SOURCE OF TRUTH) ----------------
//       for (const it of rows) {
//         const product = await Product.findOne(
//           { code: it.code },
//           { stockHistory: 1 }
//         ).lean();

//         if (!product?.stockHistory) {
//           it.qty = 0;
//           it.openingStock = 0;
//           it.closingStock = 0;
//           it.netSale = it.totalSales + it.totalGst;
//           continue;
//         }

//         const history = product.stockHistory
//           .map(h => ({
//             date: new Date(h.date),
//             opening: Number(h.openingStock || 0),
//             closing: Number(h.closingStock || 0),
//             change: Number(h.change || 0),
//             reason: h.reason
//           }))
//           .sort((a, b) => a.date - b.date);

//         // ---------- QTY SOLD (ACTUAL STOCK MOVEMENT) ----------
//         const soldMovements = history.filter(
//           h =>
//             h.reason === "sale decrement" &&
//             h.date >= fromDate &&
//             h.date <= toDate
//         );

//         it.qty = soldMovements.reduce(
//           (sum, h) => sum + Math.abs(h.change),
//           0
//         );

//         // ---------- OPENING STOCK ----------
//         // const beforePeriod = history.filter(h => h.date < fromDate);
//         // it.openingStock = beforePeriod.at(-1)?.closing ?? 0;

//               // ---------- OPENING STOCK (FIXED) ----------
// if (soldMovements.length > 0) {
//   // ✅ Opening stock = openingStock of FIRST sale in period
//   it.openingStock = soldMovements[0].opening;
// } else {
//   // No sales in period → fallback to last known stock before range
//   const beforePeriod = history.filter(h => h.date < fromDate);
//   it.openingStock = beforePeriod.at(-1)?.closing ?? 0;
// }

//         // ---------- CLOSING STOCK ----------
//         const uptoPeriod = history.filter(h => h.date <= toDate);
//         it.closingStock = uptoPeriod.at(-1)?.closing ?? 0;

//         // ---------- NET SALE ----------
//         it.netSale = it.totalSales + it.totalGst;
//       }

//       // ---------------- SUMMARY ----------------
//       const summary = {
//         totalItemsSold: rows.reduce((s, r) => s + (r.qty || 0), 0),
//         totalSales: rows.reduce((s, r) => s + r.totalSales, 0),
//         totalGst: rows.reduce((s, r) => s + r.totalGst, 0),
//         totalNetSale: rows.reduce(
//           (s, r) => s + r.totalSales + r.totalGst,
//           0
//         )
//       };

//       // ---------------- FIRST / LAST BILL DATE ----------------
//       const firstBill = await SalesBill.findOne(match)
//         .sort({ date: 1 })
//         .select("date")
//         .lean();

//       const lastBill = await SalesBill.findOne(match)
//         .sort({ date: -1 })
//         .select("date")
//         .lean();

//       return res.json({
//         items: rows,
//         summary,
//         firstDate: firstBill?.date || null,
//         lastDate: lastBill?.date || null
//       });

//     } catch (err) {
//       console.error("❌ Itemwise Sales Report Error:", err);
//       res.status(500).json({ message: err.message });
//     }
//   }
// );



router.get(
  "/shops/:shopname/branch-reports/itemwise/sales",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      let SalesBill, Product;
      let shopId;

      // ---------------- TENANT ----------------
      if (req.tenantModels) {
        SalesBill = req.tenantModels.SalesBill;
        Product = req.tenantModels.Product;
        shopId = req.shop?._id || req.user?.shopId || null;
      }

      // ---------------- MANAGER / MEGAADMIN ----------------
      else if (req.dbManager?.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb) {
          return res
            .status(404)
            .json({ message: `Shop '${shopname}' not found` });
        }

        SalesBill = tenantDb.model("SalesBill");
        Product = tenantDb.model("Product");
      } else {
        return res
          .status(500)
          .json({ message: "Tenant DB manager not initialized" });
      }

      if (!SalesBill || !Product) {
        return res.status(400).json({ message: "Models missing" });
      }

      // ---------------- DATE FILTER ----------------
      const match = {};
      if (shopId) match.shop = shopId;

      let fromDate, toDate;

      if (req.query.from && req.query.to) {
        fromDate = new Date(req.query.from);
        toDate = new Date(req.query.to);
        match.date = { $gte: fromDate, $lte: toDate };
      } else {
        fromDate = new Date("1970-01-01T00:00:00.000Z");
        toDate = new Date();
      }

      // ---------------- BILL AGGREGATION ----------------
      const rows = await SalesBill.aggregate([
        { $match: match },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.code",
            code: { $first: "$items.code" },
            name: { $first: "$items.name" },
            qty: { $sum: "$items.qty" },
            totalSales: { $sum: "$items.value" },
            totalGst: {
              $sum: {
                $cond: [
                  "$items.isInclusive",
                  {
                    $subtract: [
                      "$items.value",
                      {
                        $divide: [
                          "$items.value",
                          { $add: [1, { $divide: ["$items.gst", 100] }] }
                        ]
                      }
                    ]
                  },
                  {
                    $multiply: [
                      "$items.taxable",
                      { $divide: ["$items.gst", 100] }
                    ]
                  }
                ]
              }
            }
          }
        }
      ]);

      // ---------------- SOLD QTY CALCULATOR ----------------
      const calculateSoldQty = (product, fromDate, toDate) => {
        let soldQty = 0;
        let returnQty = 0;
        let editAdjustment = 0;

        if (Array.isArray(product.productSales)) {
          soldQty += product.productSales
            .filter(ps => {
              const d = new Date(ps.date);
              return d >= fromDate && d <= toDate;
            })
            .reduce((sum, ps) => sum + Number(ps.qty || 0), 0);
        }

        if (Array.isArray(product.stockHistory)) {
          product.stockHistory.forEach(h => {
            const d = new Date(h.date);
            if (d < fromDate || d > toDate) return;

            if (h.reason === "return" && Number(h.change) > 0) {
              returnQty += Number(h.change);
            }

            if (h.reason === "edit-qty") {
              editAdjustment += Number(h.change);
            }
          });
        }

        return Math.max(0, soldQty - returnQty + editAdjustment);
      };

      // ---------------- STOCK LOGIC ----------------
      for (const it of rows) {
        const product = await Product.findOne(
          { code: it.code },
          { productSales: 1, stockHistory: 1 }
        ).lean();

        if (!product) continue;

        const history = (product.stockHistory || [])
          .map(h => ({
            date: new Date(h.date),
            opening: Number(h.openingStock || 0),
            closing: Number(h.closingStock || 0),
            change: Number(h.change || 0),
            reason: h.reason
          }))
          .sort((a, b) => a.date - b.date);

        // --- Final Sold Qty ---
        it.qty = calculateSoldQty(product, fromDate, toDate);

        // --- Sale Movements ---
        const soldMovements = history.filter(
          h =>
            h.reason === "sale decrement" &&
            h.date >= fromDate &&
            h.date <= toDate
        );

        it.qty = soldMovements.reduce(
          (sum, h) => sum + Math.abs(h.change),
          0
        );

        // --- Opening Stock ---
        if (soldMovements.length > 0) {
          it.openingStock = soldMovements[0].opening;
        } else {
          const beforePeriod = history.filter(h => h.date < fromDate);
          it.openingStock = beforePeriod.at(-1)?.closing ?? 0;
        }

        // --- Closing Stock ---
        const uptoPeriod = history.filter(h => h.date <= toDate);
        it.closingStock = uptoPeriod.at(-1)?.closing ?? 0;

        it.netSale = it.totalSales + it.totalGst;
      }

      // ---------------- SUMMARY ----------------
      const summary = {
        totalItemsSold: rows.reduce((s, r) => s + r.qty, 0),
        totalSales: rows.reduce((s, r) => s + r.totalSales, 0),
        totalGst: rows.reduce((s, r) => s + r.totalGst, 0),
        totalNetSale: rows.reduce(
          (s, r) => s + r.totalSales + r.totalGst,
          0
        )
      };

      // ---------------- FIRST / LAST BILL ----------------
      const firstBill = await SalesBill.findOne(match)
        .sort({ date: 1 })
        .select("date")
        .lean();

      const lastBill = await SalesBill.findOne(match)
        .sort({ date: -1 })
        .select("date")
        .lean();

      return res.json({
        items: rows,
        summary,
        firstDate: firstBill?.date || null,
        lastDate: lastBill?.date || null
      });
    } catch (err) {
      console.error("❌ Itemwise Sales Report Error:", err);
      return res.status(500).json({ message: err.message });
    }
  }
);













router.get(
  "/shops/:shopname/branch-reports/datewise",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      let SalesBill;
      let shopId;

      // TENANT
      if (req.tenantModels) {
        SalesBill = req.tenantModels.SalesBill;
        shopId = req.shop?._id || req.user?.shopId || null;
      }
      // MEGAADMIN
      else if (req.dbManager && req.dbManager.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb)
          return res
            .status(404)
            .json({ message: `Shop '${shopname}' not found` });

        SalesBill = tenantDb.model("SalesBill");
      } else {
        return res
          .status(500)
          .json({ message: "Tenant DB manager not initialized" });
      }

      if (!SalesBill)
        return res.status(400).json({ message: "SalesBill model missing" });

      const { from, to } = req.query;
      const isExport = req.query.export === "1";

      let start, end;

      // ---- DATE RANGE ----
      if (!from || !to) {
        start = new Date(0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
      } else {
        start = new Date(from);
        end = new Date(to);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      }

      const match = { date: { $gte: start, $lte: end } };
      if (shopId) match.shop = shopId;

      // ---- AGGREGATION ----
      const data = await SalesBill.aggregate([
        { $match: match },
        { $unwind: "$items" },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
              day: { $dayOfMonth: "$date" }
            },
            billNos: { $addToSet: "$billNo" },
            qty: { $sum: "$items.qty" },
            totalSales: { $sum: "$netAmount" }
          }
        },
        {
          $addFields: {
            billCount: { $size: "$billNos" },
            date: {
              $dateFromParts: {
                year: "$_id.year",
                month: "$_id.month",
                day: "$_id.day"
              }
            }
          }
        },
        { $sort: { date: 1 } }
      ]);

      // ---- SUMMARY ----
      const summary = data.reduce(
        (a, r) => {
          a.totalBills += r.billCount;
          a.totalQty += r.qty;
          a.totalSales += r.totalSales;
          return a;
        },
        { totalBills: 0, totalQty: 0, totalSales: 0 }
      );

      // ---- EXPORT vs UI ----
      if (isExport) {
        // ✅ PRINT / PDF → FULL DATA
        return res.json({
          rows: data,
          summary
        });
      }

      // ---- UI PAGINATION ----
      const page = Math.max(1, parseInt(req.query.page || 1));
      const limit = Math.max(1, parseInt(req.query.limit || 10));

      const totalRecords = data.length;
      const totalPages = Math.ceil(totalRecords / limit);
      const startIndex = (page - 1) * limit;

      const pagedRows = data.slice(startIndex, startIndex + limit);

      return res.json({
        rows: pagedRows,
        summary,
        pagination: {
          page,
          totalPages,
          totalRecords
        }
      });
    } catch (err) {
      console.error("❌ getDateWiseReport error:", err);
      res.status(500).json({
        message: "Failed to load date-wise report",
        error: err.message
      });
    }
  }
);





//counter report

router.get(
  "/shops/:shopname/branch-reports/collections/counter",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      let SalesBill;
      let shopId;


      // TENANT USER
      if (req.tenantModels) {
        SalesBill = req.tenantModels.SalesBill;
        shopId = req.shop?._id || req.user?.shopId || null;
      }
      // MANAGER / MEGAADMIN
      else if (req.dbManager && req.dbManager.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb)
          return res.status(404).json({ message: `Shop '${shopname}' not found"` });

        SalesBill = tenantDb.model("SalesBill");
      }
      else {
        return res.status(500).json({ message: "Tenant DB manager not initialized" });
      }

      if (!SalesBill)
        return res.status(400).json({ message: "SalesBill model missing" });

      // QUERY PARAMS
      const counter = req.query.counter?.trim();
      const method = req.query.method; // all, cash, upi
      const from = req.query.from;
      const to = req.query.to;


      // 🔑 EXPORT FLAG
      const isExport = req.query.export === "1";

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = isExport ? 100000 : Math.max(1, Number(req.query.limit) || 10);
      const skip = isExport ? 0 : (page - 1) * limit;

      const match = {};

      if (shopId) match.shop = shopId;
      if (counter) match.counter = Number(counter);

      if (from && to) {
        match.date = {
          $gte: new Date(from),
          $lte: new Date(new Date(to).setHours(23, 59, 59, 999))
        };
      }

      if (method && method !== "all") {
        match.paymentMethod = method.toUpperCase();
      }

      // AGGREGATE
      const data = await SalesBill.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$counter",
            totalBills: { $sum: 1 },
            totalQty: { $sum: { $sum: "$items.qty" } },
            // paymentCash: {
            //   $sum: { $cond: [{ $eq: ["$paymentMethod", "CASH"] }, "$netAmount", 0] }
            // },
            // paymentUpi: {
            //   $sum: { $cond: [{ $eq: ["$paymentMethod", "UPI"] }, "$netAmount", 0] }
            // },
            paymentCash: { $sum: "$payment.cash" },
            paymentUpi: { $sum: "$payment.upi" },
            paymentCard: { $sum: "$payment.card" },

            total: { $sum: "$netAmount" }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const dateAgg = await SalesBill.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            firstDate: { $min: "$date" },
            lastDate: { $max: "$date" }
          }
        }
      ]);

      const firstDate = dateAgg[0]?.firstDate || null;
      const lastDate = dateAgg[0]?.lastDate || null;


      //     res.json({
      //       rows: data.map(d => ({
      //         counter: d._id,
      //         totalBills: d.totalBills,
      //         totalQty: d.totalQty,
      //         paymentCash: d.paymentCash,
      //         paymentUpi: d.paymentUpi,
      //         total: d.total,
      //                firstDate,
      // lastDate
      //       }))
      //     });


      // ================= RESPONSE =================
      res.json({
        rows: data.map((d) => ({
          counter: d._id,
          totalBills: d.totalBills,
          totalQty: d.totalQty,
          paymentCash: d.paymentCash,
          paymentUpi: d.paymentUpi,
          paymentCard: d.paymentCard,
          total: d.total,
        })),
        page,
        totalPages: isExport ? 1 : Math.ceil(data.length / limit),
        firstDate,
        lastDate,
      });



    } catch (err) {
      console.error("❌ Counter report error:", err);
      res.status(500).json({ message: "Failed to load counter report", error: err.message });
    }
  }
);


// router.get(
//   "/shops/:shopname/branch-reports/collections/user",
//   authTenantOrMaster,
//   async (req, res) => {
//     try {
//       const { shopname } = req.params;

//       let SalesBill;
//       let shopId;

//       // TENANT
//       if (req.tenantModels) {
//         SalesBill = req.tenantModels.SalesBill;
//         shopId = req.shop?._id || req.user?.shopId || null;
//       }
//       // MANAGER / MEGAADMIN
//       else if (req.dbManager && req.dbManager.getTenantDb) {
//         const tenantDb = req.dbManager.getTenantDb(shopname);
//         if (!tenantDb)
//           return res.status(404).json({ message: `Shop '${shopname}' not found` });

//         SalesBill = tenantDb.model("SalesBill");
//       }
//       else {
//         return res.status(500).json({ message: "Tenant DB manager not initialized" });
//       }

//       if (!SalesBill)
//         return res.status(400).json({ message: "SalesBill model missing" });

//       // QUERY
//       const counter = req.query.counter?.trim();
//       const user = req.query.user?.trim();
//       const method = req.query.method;
//       const from = req.query.from;
//       const to = req.query.to;

//       const match = {};

//       if (shopId) match.shop = shopId;
//       if (counter) match.counter = Number(counter);

//       if (user) {
//         match.$or = [
//           { createdBy: user },
//           { counterUser: user }
//         ];
//       }

//       if (from && to) {
//         match.date = {
//           $gte: new Date(from),
//           $lte: new Date(new Date(to).setHours(23, 59, 59, 999))
//         };
//       }

//       if (method && method !== "all") {
//         match.paymentMethod = method.toUpperCase();
//       }

//       const data = await SalesBill.aggregate([
//         { $match: match },
//         {
//           $group: {
//             _id: "$createdBy",
//             counter: { $first: "$counter" },
//             totalBills: { $sum: 1 },
//             totalQty: { $sum: { $sum: "$items.qty" } },
//                    paymentCash: { $sum: "$payment.cash" },
// paymentUpi: { $sum: "$payment.upi" },
// paymentCard: { $sum: "$payment.card" },
//             total: { $sum: "$netAmount" }
//           }
//         },
//         { $sort: { _id: 1 } }
//       ]);


//     const dateAgg = await SalesBill.aggregate([
//   { $match: match },
//   {
//     $group: {
//       _id: null,
//       firstDate: { $min: "$date" },
//       lastDate: { $max: "$date" }
//     }
//   }
// ]);

// const firstDate = dateAgg[0]?.firstDate || null;
// const lastDate = dateAgg[0]?.lastDate || null;


//       res.json({
//         rows: data.map(d => ({
//           user: d._id,
//           counter: d.counter,
//           bills: d.totalBills,
//           totalQty: d.totalQty,
//           paymentCash: d.paymentCash,
//           paymentUpi: d.paymentUpi,
//           total: d.total,
//                  firstDate,
//   lastDate
//         }))
//       });

//     } catch (err) {
//       console.error("❌ User report error:", err);
//       res.status(500).json({ message: "Failed to load user report", error: err.message });
//     }
//   }
// );


// ----------------------------------------------------------
// USER + COUNTER WISE COLLECTION REPORT (Tenant + Master)
// ----------------------------------------------------------
router.get(
  "/shops/:shopname/branch-reports/collections/user",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      let SalesBill;
      let shopId;

      // ------------------------------
      // TENANT ACCESS
      // ------------------------------
      if (req.tenantModels) {
        SalesBill = req.tenantModels.SalesBill;
        shopId = req.shop?._id || req.user?.shopId || null;
      }
      // ------------------------------
      // MASTER / MANAGER ACCESS
      // ------------------------------
      else if (req.dbManager && req.dbManager.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb)
          return res
            .status(404)
            .json({ message: `Shop '${shopname}' not found` });

        SalesBill = tenantDb.model("SalesBill");
      }
      else {
        return res
          .status(500)
          .json({ message: "Tenant DB manager not initialized" });
      }

      if (!SalesBill)
        return res
          .status(400)
          .json({ message: "SalesBill model missing" });

      // ------------------------------
      // ORIGINAL LOGIC (UNCHANGED)
      // ------------------------------
      const isExport = req.query.export === "1";

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.max(1, Number(req.query.limit) || 10);
      const skip = (page - 1) * limit;

      const counter = req.query.counter?.trim();
      const user = req.query.user?.trim();
      const method = req.query.method;
      const from = req.query.from;
      const to = req.query.to;

      const match = {};

      if (counter) match.counter = Number(counter);

      if (user) {
        match.$or = [
          { createdBy: user },
          { counterUser: user }
        ];
      }

      if (from && to) {
        match.date = {
          $gte: new Date(from),
          $lte: new Date(to)
        };
      }

      if (method && method !== "all") {
        match.paymentMethod = method.toUpperCase();
      }

      // ------------------------------
      // AGGREGATE USER + COUNTER WISE
      // ------------------------------
      const data = await SalesBill.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              user: "$createdBy",
              counter: "$counter"
            },
            totalBills: { $sum: 1 },
            totalQty: { $sum: { $sum: "$items.qty" } },

            paymentCash: { $sum: "$payment.cash" },
            paymentUpi: { $sum: "$payment.upi" },
            paymentCard: { $sum: "$payment.card" },

            total: { $sum: "$netAmount" }
          }
        },
        {
          $sort: {
            "_id.user": 1,
            "_id.counter": 1
          }
        },
        { $skip: skip },
        { $limit: limit }
      ]);

      // ------------------------------
      // COUNT DISTINCT USER + COUNTER
      // ------------------------------
      const countAgg = await SalesBill.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              user: "$createdBy",
              counter: "$counter"
            }
          }
        },
        { $count: "count" }
      ]);

      const total = countAgg[0]?.count || 0;

      // ------------------------------
      // DATE RANGE
      // ------------------------------
      const dateAgg = await SalesBill.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            firstDate: { $min: "$date" },
            lastDate: { $max: "$date" }
          }
        }
      ]);

      const firstDate = dateAgg[0]?.firstDate || null;
      const lastDate = dateAgg[0]?.lastDate || null;

      // ------------------------------
      // RESPONSE
      // ------------------------------
      res.json({
        rows: data.map(d => ({
          user: d._id.user,
          counter: d._id.counter,
          bills: d.totalBills,
          totalQty: d.totalQty,
          paymentCash: d.paymentCash,
          paymentUpi: d.paymentUpi,
          paymentCard: d.paymentCard,
          total: d.total
        })),
        total,
        totalPages: isExport ? 1 : Math.ceil(total / limit),
        page,
        limit,
        firstDate,
        lastDate
      });

    } catch (err) {
      console.error("❌ User collection report error:", err);
      res.status(500).json({
        message: "Failed to load user report",
        error: err.message
      });
    }
  }
);


router.get(
  "/shops/:shopname/branch-reports/collections/statement",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      let SalesBill, User;
      let shopId;

      if (req.tenantModels) {
        SalesBill = req.tenantModels.SalesBill;
        User = req.tenantModels.User;
        shopId = req.shop?._id || req.user?.shopId || null;
      }
      else if (req.dbManager && req.dbManager.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb)
          return res.status(404).json({ message: `Shop '${shopname}' not found` });

        SalesBill = tenantDb.model("SalesBill");
        User = tenantDb.model("User");
      }
      else {
        return res.status(500).json({ message: "Tenant DB manager not initialized" });
      }

      if (!SalesBill || !User)
        return res.status(400).json({ message: "Models missing" });

      // FILTERS
      const from = req.query.from;
      const to = req.query.to;
      const method = req.query.method;

      const match = {};

      if (shopId) match.shop = shopId;

      if (from && to) {
        match.date = {
          $gte: new Date(from),
          $lte: new Date(new Date(to).setHours(23, 59, 59, 999))
        };
      }

      if (method && method !== "all") {
        match.paymentMethod = method.toUpperCase();
      }

      // 1️⃣ ALL COUNTERS
      const allCounters = await SalesBill.distinct("counter", match);

      // 2️⃣ ALL USERS
      const allUsers = await User.find({}, { username: 1, name: 1 }).lean();

      // 3️⃣ COUNTER AGG
      const counterAgg = await SalesBill.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$counter",
            totalBills: { $sum: 1 },
            totalQty: { $sum: { $sum: "$items.qty" } },
            total: { $sum: "$netAmount" },
            paymentCash: { $sum: "$payment.cash" },
            paymentUpi: { $sum: "$payment.upi" },
            paymentCard: { $sum: "$payment.card" }
          }
        }
      ]);

      const counterRows = allCounters.map(cnt => {
        const record = counterAgg.find(r => r._id === cnt);
        return record || {
          _id: cnt,
          totalBills: 0,
          totalQty: 0,
          total: 0,
          paymentCash: 0,
          paymentUpi: 0
        };
      });

      // 4️⃣ USER AGG
      const userAgg = await SalesBill.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$createdBy",
            totalBills: { $sum: 1 },
            totalQty: { $sum: { $sum: "$items.qty" } },
            total: { $sum: "$netAmount" },
            paymentCash: { $sum: "$payment.cash" },
            paymentUpi: { $sum: "$payment.upi" },
            paymentCard: { $sum: "$payment.card" },

          }
        }
      ]);

      const userRows = allUsers.map(usr => {
        const found = userAgg.find(r => r._id === usr.username);
        return found || {
          _id: usr.username,
          name: usr.name,
          totalBills: 0,
          totalQty: 0,
          total: 0,
          paymentCash: 0,
          paymentUpi: 0
        };
      });

      // 5️⃣ SUMMARY
      const summaryAgg = await SalesBill.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            cash: { $sum: "$payment.cash" },
            upi: { $sum: "$payment.upi" },
            card: { $sum: "$payment.card" },


            total: { $sum: "$netAmount" }
          }
        }
      ]);

      const summary = summaryAgg[0] || { cash: 0, upi: 0, total: 0 };

      const dateAgg = await SalesBill.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            firstDate: { $min: "$date" },
            lastDate: { $max: "$date" }
          }
        }
      ]);

      const firstDate = dateAgg[0]?.firstDate || null;
      const lastDate = dateAgg[0]?.lastDate || null;


      res.json({
        counterRows,
        userRows,
        summary,
        firstDate,
        lastDate
      });

    } catch (err) {
      console.error("❌ Statement report error:", err);
      res.status(500).json({ message: "Failed to load statement report", error: err.message });
    }
  }
);

router.get(
  "/shops/:shopname/users",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      let User;

      if (req.tenantModels) {
        User = req.tenantModels.User;
      }
      else if (req.dbManager?.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb)
          return res.status(404).json({ message: `Shop '${shopname}' not found` });

        User = tenantDb.model("User");
      }
      else {
        return res
          .status(500)
          .json({ message: "Tenant DB manager not initialized" });
      }

      const users = await User.find({}, "username name role").lean();

      res.json({ users });

    } catch (err) {
      console.error("❌ users error:", err);
      res.status(500).json({ message: "Failed to load users", error: err.message });
    }
  }
);




router.get(
  "/shops/:shopname/branch-reports/collections/users/list",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      let User;
      let shopId;

      // Tenant user
      if (req.tenantModels) {
        User = req.tenantModels.User;
        shopId = req.shop?._id || req.user?.shopId || null;
      }

      // Manager/MegaAdmin
      else if (req.dbManager && req.dbManager.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb)
          return res.status(404).json({ message: `Shop '${shopname}' not found` });

        User = tenantDb.model("User");
      } else {
        return res.status(500).json({ message: "Tenant DB manager not initialized" });
      }

      if (!User)
        return res.status(400).json({ message: "User model missing" });

      const users = await User.find({}, "username name role status").sort({ username: 1 });

      res.json({ users });
    } catch (err) {
      console.error("❌ users list error:", err);
      res.status(500).json({
        message: "Failed to load users list",
        error: err.message
      });
    }
  }
);









// ---------------------------------------------
// STOCK REPORT 
// ---------------------------------------------
router.get(
  "/shops/:shopname/branch-reports/stock",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { Product, Purchase, SalesBill } = req.tenantModels;

      const { from, to, counter, page = 1, limit = 10 } = req.query;


      const isAll = req.query.all === "true";

      const pageNum = Number(page);
      const pageSize = Number(limit);

      let periodStart = null;
      let periodEnd = null;

      // FULL RANGE (all time) when from/to missing
      if (!from || !to) {
        periodStart = new Date(0);
        periodEnd = new Date();
        periodEnd.setHours(23, 59, 59, 999);
      } else {
        // use provided dates and set to local day-range (00:00:00 - 23:59:59.999)
        periodStart = new Date(from);
        periodEnd = new Date(to);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setHours(23, 59, 59, 999);
      }

      /* -----------------------------------------------------------
         Helper: find opening stock from stockHistory
         - returns the latest closingStock on or before periodStart
         - uses <= periodStart to include entries exactly at midnight
         ----------------------------------------------------------- */
      const getOpeningFromHistory = (history = [], periodStart) => {
        if (!history || history.length === 0) return 0;

        // keep only entries with date <= periodStart
        const earlierOrEqual = history.filter((h) => {
          const d = new Date(h.date).getTime();
          return d <= periodStart.getTime();
        });

        if (earlierOrEqual.length === 0) return 0;

        // pick the most recent (largest date)
        earlierOrEqual.sort((a, b) => new Date(b.date) - new Date(a.date));
        return Number(earlierOrEqual[0].closingStock || 0);
      };


      const getClosingFromHistory = (history = [], periodEnd) => {
        if (!history || history.length === 0) return 0;

        const eligible = history.filter(h =>
          new Date(h.date).getTime() <= periodEnd.getTime()
        );

        if (eligible.length === 0) return 0;

        eligible.sort((a, b) => new Date(b.date) - new Date(a.date));
        return Number(eligible[0].closingStock || 0);
      };





      const getSoldFromProductSales = (productSales = [], start, end) => {
        return productSales
          .filter(ps => {
            const d = new Date(ps.date);
            return d >= start && d <= end;
          })
          .reduce((sum, ps) => sum + Number(ps.qty || 0), 0);
      };



      const getReturnQtyFromHistory = (history = [], start, end) => {
        return history
          .filter(h => {
            const d = new Date(h.date);
            return (
              h.reason === "return" &&
              d >= start &&
              d <= end &&
              Number(h.change) > 0
            );
          })
          .reduce((sum, h) => sum + Number(h.change || 0), 0);
      };

      /* -----------------------------------------------------------
         1) LOAD ALL PRODUCTS
         ----------------------------------------------------------- */



      const products = await Product.find({ status: "active" })
        .select("code name category status totalQty batches stockHistory productSales")
        .lean();

      const productMap = new Map();

      products.forEach((p) => {


        productMap.set(p.code, {
          code: p.code,
          name: p.name,
          category: p.category,
          // currentStock is truth from DB (totalQty)
          currentStock: Number(p.totalQty || 0),

          openingStock: 0,
          purchaseQty: 0,
          soldQty: 0,
          returnQty: 0,
          totalStock: 0,
          closingStock: 0,

          history: p.stockHistory || [],
          productSales: p.productSales || [],

        });
      });

      /* -----------------------------------------------------------
         2) PURCHASES WITHIN PERIOD
         ----------------------------------------------------------- */
      const purchaseDocs = await Purchase.find({
        stockedDate: { $gte: periodStart, $lte: periodEnd },
      }).lean();

      purchaseDocs.forEach((pur) => {
        (pur.batches || []).forEach((b) => {
          const prod = productMap.get(b.code);
          if (prod) prod.purchaseQty += Number(b.qty || 0);
        });
      });

      /* -----------------------------------------------------------
         3) SALES WITHIN PERIOD
         ----------------------------------------------------------- */
      const salesQuery = { date: { $gte: periodStart, $lte: periodEnd } };
      if (counter) salesQuery.counter = Number(counter);

      const bills = await SalesBill.find(salesQuery).lean();


      /* -----------------------------------------------------------
         4) OPENING STOCK FROM MIDNIGHT STOCK HISTORY (FIXED)
         - now uses <= comparison to include midnight entries
         ----------------------------------------------------------- */
      productMap.forEach((prod, code) => {
        const productDoc = products.find((p) => p.code === code);
        const opening = getOpeningFromHistory(productDoc?.stockHistory || [], periodStart);
        prod.openingStock = Number(opening || 0);
      });




      productMap.forEach((prod) => {
        prod.soldQty = getSoldFromProductSales(
          prod.productSales,
          periodStart,
          periodEnd
        );
      });


      productMap.forEach((prod) => {
        prod.returnQty = getReturnQtyFromHistory(
          prod.history,
          periodStart,
          periodEnd
        );
      });



      /* -----------------------------------------------------------
         5) FINAL CALCULATIONS
         - closingStock uses DB truth: product.currentStock (totalQty)
         - other fields (purchase/sold/return) still shown for the period
         ----------------------------------------------------------- */
      const rows = [];

      productMap.forEach((prod) => {
        const opening = prod.openingStock;

        const totalStock = opening + prod.purchaseQty;

        // USE the database total for closing stock: this is the authoritative value
        // (safer and accurate after master edits / retro adjustments)
        // let closingStock = Number(prod.currentStock || 0);

        const closingStock = getClosingFromHistory(prod.history || [], periodEnd);

        // sanity: don't return negative
        if (closingStock < 0) closingStock = 0;

        rows.push({
          code: prod.code,
          name: prod.name,
          category: prod.category,
          openingStock: opening,
          purchaseQty: prod.purchaseQty,
          totalStock,
          sold: prod.soldQty,
          returnQty: prod.returnQty,
          closingStock,
          history: prod.history || [],
        });
      });

      /* -----------------------------------------------------------
         SUMMARY
         ----------------------------------------------------------- */
      const summary = {
        totalStock: rows.reduce((s, r) => s + r.closingStock, 0),
        soldQty: rows.reduce((s, r) => s + r.sold, 0),
      };



      // --------------------------------------
      // GLOBAL FIRST & LAST DATE (FULL DATA)
      // --------------------------------------
      let globalMinDate = null;
      let globalMaxDate = null;

      rows.forEach((prod) => {
        (prod.history || []).forEach((h) => {
          if (!h.date) return;

          const d = new Date(h.date);

          if (!globalMinDate || d < globalMinDate) globalMinDate = d;
          if (!globalMaxDate || d > globalMaxDate) globalMaxDate = d;
        });
      });

      if (isAll) {
        return res.json({
          rows,
          summary,
          firstHistoryDate: globalMinDate,
          lastHistoryDate: globalMaxDate,
        });
      }

      const totalRecords = rows.length;
      const totalPages = Math.ceil(totalRecords / pageSize);

      const paginatedRows = rows.slice(
        (pageNum - 1) * pageSize,
        pageNum * pageSize
      );


      // return res.json({ rows, summary });

      return res.json({
        rows: paginatedRows,
        summary,
        pagination: {
          page: pageNum,
          limit: pageSize,
          totalRecords,
          totalPages,
        },
        firstHistoryDate: globalMinDate,
        lastHistoryDate: globalMaxDate,
      });

    } catch (err) {
      console.error("❌ getStockReport error:", err);
      return res.status(500).json({
        message: "Failed to build stock report",
        error: err.message,
      });
    }
  }   
);






router.get(
  "/shops/:shopname/branch-reports/stock/categorywise",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;
      const { page = 1, limit = 25, all } = req.query;

      const isAll = all === "true";
      const pageNum = Number(page);
      const pageSize = Number(limit);

      let Product;

      // ----------------------------------
      // RESOLVE PRODUCT MODEL
      // ----------------------------------
      if (req.tenantModels) {
        Product = req.tenantModels.Product;
      } else if (req.dbManager?.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb) {
          return res.status(404).json({
            message: `Shop '${shopname}' not found`,
          });
        }
        Product = tenantDb.model("Product");
      } else {
        return res.status(500).json({
          message: "Tenant DB manager not initialized",
        });
      }

      if (!Product) {
        return res.status(400).json({ message: "Product model missing" });
      }

      // ----------------------------------
      // FETCH PRODUCTS
      // ----------------------------------
      const products = await Product.find({ status: "active" })
        .select("category batches totalQty stockHistory")
        .lean();

      const categoryMap = new Map();

      let globalMin = null;
      let globalMax = null;

      // ----------------------------------
      // LOOP PRODUCTS
      // ----------------------------------
      for (const p of products) {
        const category = p.category || "Uncategorized";

        // 🔥 DATE RANGE TRACK ONLY
        if (Array.isArray(p.stockHistory)) {
          p.stockHistory.forEach(h => {
            if (!h.date) return;
            const d = new Date(h.date);
            if (!globalMin || d < globalMin) globalMin = d;
            if (!globalMax || d > globalMax) globalMax = d;
          });
        }

        // ✅ USE totalQty (IMPORTANT)
        const closingStock = Number(p.totalQty || 0);

        if (closingStock < 0) continue;

        // ----------------------------------
        // FIFO VALUE
        // ----------------------------------
        const batches = (p.batches || []).filter(
          b => b.status === "active"
        );

        let remainingQty = closingStock;
        let productValue = 0;

        for (const b of batches) {
          if (remainingQty <= 0) break;

          const batchQty = Number(b.qty || 0);
          const price = Number(b.salePrice || b.mrp || 0);

          if (batchQty <= 0 || price <= 0) continue;

          const usedQty = Math.min(batchQty, remainingQty);
          productValue += usedQty * price;
          remainingQty -= usedQty;
        }

        // ----------------------------------
        // AGGREGATE
        // ----------------------------------
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            category,
            itemCount: 1,
            totalQty: closingStock,
            value: productValue,
          });
        } else {
          const entry = categoryMap.get(category);
          entry.itemCount += 1;
          entry.totalQty += closingStock;
          entry.value += productValue;
        }
      }

      const rows = Array.from(categoryMap.values()).sort((a, b) =>
        a.category.localeCompare(b.category)
      );

      const summary = {
        categories: rows.length,
        totalQty: rows.reduce((s, r) => s + r.totalQty, 0),
        totalValue: rows.reduce((s, r) => s + r.value, 0),
      };

      // ----------------------------------
      // RETURN ALL
      // ----------------------------------
      if (isAll) {
        return res.json({
          rows,
          summary,
          firstHistoryDate: globalMin,
          lastHistoryDate: globalMax,
        });
      }

      // ----------------------------------
      // PAGINATION
      // ----------------------------------
      const totalRecords = rows.length;
      const totalPages = Math.ceil(totalRecords / pageSize);

      const paginatedRows = rows.slice(
        (pageNum - 1) * pageSize,
        pageNum * pageSize
      );

      return res.json({
        success: true,
        rows: paginatedRows,
        summary,
        pagination: {
          page: pageNum,
          limit: pageSize,
          totalRecords,
          totalPages,
        },
        firstHistoryDate: globalMin,
        lastHistoryDate: globalMax,
      });

    } catch (err) {
      console.error("❌ categorywise stock report error:", err);
      return res.status(500).json({ message: "Server Error" });
    }
  }
);


router.get(
  "/shops/:shopname/branch-reports/stock/category/products",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;
      const { category, page = 1, limit = 10, all } = req.query;

      if (!category) {
        return res.status(400).json({ message: "Category required" });
      }

      let Product;

      // ----------------------------------
      // RESOLVE MODEL
      // ----------------------------------
      if (req.tenantModels) {
        Product = req.tenantModels.Product;
      } else if (req.dbManager?.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb) {
          return res.status(404).json({
            message: `Shop '${shopname}' not found`,
          });
        }
        Product = tenantDb.model("Product");
      } else {
        return res.status(500).json({
          message: "Tenant DB manager not initialized",
        });
      }

      if (!Product) {
        return res.status(400).json({ message: "Product model missing" });
      }

      const pageNum = Number(page);
      const pageSize = Number(limit);

      // ----------------------------------
      // FETCH PRODUCTS
      // ----------------------------------
      const products = await Product.find({
        category,
        status: "active",
      })
        .select("code name batches totalQty")
        .lean();

      const allRows = [];

      let categoryTotalQty = 0;
      let categoryTotalValue = 0;

      // ----------------------------------
      // LOOP
      // ----------------------------------
      for (const p of products) {
        const closingStock = Number(p.totalQty || 0);

        if (closingStock < 0) continue;

        const batches = (p.batches || []).filter(
          b => b.status === "active"
        );

        let remainingQty = closingStock;
        let productValue = 0;

        for (const b of batches) {
          if (remainingQty <= 0) break;

          const batchQty = Number(b.qty || 0);
          const price = Number(b.salePrice || b.mrp || 0);

          if (batchQty <= 0 || price <= 0) continue;

          const usedQty = Math.min(batchQty, remainingQty);
          productValue += usedQty * price;
          remainingQty -= usedQty;
        }

        categoryTotalQty += closingStock;
        categoryTotalValue += productValue;

        allRows.push({
          code: p.code,
          name: p.name,
          qty: closingStock,
          value: productValue,
        });
      }

      // ----------------------------------
      // RETURN ALL
      // ----------------------------------
      if (all === true || all === "true") {
        return res.json({
          success: true,
          rows: allRows,
          totals: {
            totalQty: categoryTotalQty,
            totalValue: categoryTotalValue,
          },
        });
      }

      // ----------------------------------
      // PAGINATION
      // ----------------------------------
      const totalRecords = allRows.length;
      const totalPages = Math.ceil(totalRecords / pageSize);

      const paginatedRows = allRows.slice(
        (pageNum - 1) * pageSize,
        pageNum * pageSize
      );

      return res.json({
        success: true,
        rows: paginatedRows,
        totals: {
          totalQty: categoryTotalQty,
          totalValue: categoryTotalValue,
        },
        pagination: {
          page: pageNum,
          limit: pageSize,
          totalRecords,
          totalPages,
        },
        allRows,
      });

    } catch (err) {
      console.error("❌ category products report error:", err);
      return res.status(500).json({ message: "Server Error" });
    }
  }
);






router.get(
  "/shops/:shopname/branch-reports/purchase/registerwise",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { from, to, page = 1, limit = 10, export: isExport } = req.query;
      const { shopname } = req.params;

      let Purchase;

      // Tenant user
      if (req.tenantModels) {
        Purchase = req.tenantModels.Purchase;
      }
      // Manager / Megaadmin from master DB
      else if (req.dbManager && req.dbManager.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb) {
          return res.status(404).json({
            message: `Shop '${shopname}' not found`,
          });
        }
        Purchase = tenantDb.model("Purchase");
      } else {
        return res
          .status(500)
          .json({ message: "Tenant DB manager not initialized" });
      }

      if (!Purchase) {
        return res.status(400).json({ message: "Purchase model missing" });
      }

      /* ------------------------------------------------------------
         BUILD QUERY (DATE FILTER)
         ------------------------------------------------------------ */
      const query = {};

      if (from && to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: fromDate, $lte: toDate };
      }

      /* ------------------------------------------------------------
         FETCH PURCHASES
         ------------------------------------------------------------ */
      const purchases = await Purchase.find(query)
        .sort({ createdAt: 1 })
        .lean();

      const rows = [];
      let totalQtySum = 0;
      let totalAmountSum = 0;
      let totalTaxSum = 0;
      let grandTotalSum = 0;

      /* ------------------------------------------------------------
         PROCESS EACH PURCHASE
         ------------------------------------------------------------ */
      for (const pur of purchases) {
        let totalQty = 0;
        let amount = 0; // value excluding GST
        let taxAmount = 0;

        const batches = Array.isArray(pur.batches) ? pur.batches : [];

        for (const b of batches) {
          const qty = Number(b.qty || 0);
          const rate = Number(b.rate || 0);
          const gst = Number(b.gst || 0);
          const batchValue = Number(b.value || 0); // already without GST

          totalQty += qty;
          amount += batchValue;

          // GST = (rate * qty * gst%) / 100
          const gstValue = (rate * qty * gst) / 100;
          taxAmount += gstValue;
        }

        totalQtySum += totalQty;
        totalAmountSum += amount;
        totalTaxSum += taxAmount;
        grandTotalSum += Number(pur.totalAmount || 0);

        rows.push({
          _id: pur._id,
          orderNo: pur.orderNo,
          invoiceNo: pur.invoiceNo,
          supplierId: pur.supplierId,
          supplierName: pur.supplierName,
          supplierMobile: pur.supplierMobile,
          invoiceDate: pur.invoiceDate,
          stockedDate: pur.stockedDate,
          noOfItems: pur.noOfItems || batches.length,
          totalQty,
          amount, // excluding GST
          tax: taxAmount,
          groundTotal: pur.totalAmount,
          batches: pur.batches || [], // ⭐ Required for PurchaseView
        });
      }



      /* ---------------------------------------------
       FIND FIRST & LAST DATE (EARLIEST/LATEST INVOICE DATE)
    ----------------------------------------------*/
      let firstDate = null;
      let lastDate = null;

      if (purchases.length > 0) {
        firstDate = purchases[0].createdAt;
        lastDate = purchases[purchases.length - 1].createdAt;
      }

      /* ------------------------------------------------------------
         SUMMARY
         ------------------------------------------------------------ */
      const summary = {
        totalQty: totalQtySum,
        amount: totalAmountSum,
        tax: totalTaxSum,
        grandTotal: grandTotalSum,
        firstDate,
        lastDate,
      };



      // ⭐ EXPORT MODE → RETURN ALL ROWS
      if (isExport === "1") {
        return res.json({
          rows,
          summary,
        });
      }

      const pageNum = Number(page);
      const pageSize = Number(limit);

      // after building `rows`
      const totalRecords = rows.length;
      const totalPages = Math.ceil(totalRecords / pageSize);

      const paginatedRows = rows.slice(
        (pageNum - 1) * pageSize,
        pageNum * pageSize
      );



      // return res.json({
      //   rows,
      //   summary,
      // });

      return res.json({
        rows: paginatedRows,
        summary,
        pagination: {
          page: pageNum,
          limit: pageSize,
          totalRecords,
          totalPages,
        },
      });


    } catch (err) {
      console.error("❌ getpurchaseregisterwiseReport error:", err);
      return res.status(500).json({
        message: "Failed to build purchase register wise report",
        error: err.message,
      });
    }
  }
);


router.get(
  "/shops/:shopname/branch-reports/purchase/nameregister",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;


      const { from, to, page = 1, limit = 10, export: isExport } = req.query;
      let Purchase;

      // Tenant user
      if (req.tenantModels) {
        Purchase = req.tenantModels.Purchase;
      }
      // Manager / Megaadmin (Master DB)
      else if (req.dbManager && req.dbManager.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb) {
          return res.status(404).json({
            message: `Shop '${shopname}' not found`,
          });
        }
        Purchase = tenantDb.model("Purchase");
      } else {
        return res
          .status(500)
          .json({ message: "Tenant DB manager not initialized" });
      }

      if (!Purchase) {
        return res.status(400).json({ message: "Purchase model missing" });
      }

      /* -------------------------------------------------
         DATE FILTER
      ------------------------------------------------- */
      const query = {};

      if (from && to) {
        const f = new Date(from);
        const t = new Date(to);

        f.setHours(0, 0, 0, 0);
        t.setHours(23, 59, 59, 999);

        query.createdAt = { $gte: f, $lte: t };
      }

      /* -------------------------------------------------
         FETCH PURCHASES
      ------------------------------------------------- */
      // const purchases = await Purchase.find(query).lean();

      const purchases = await Purchase.find(query)
        .sort({ createdAt: 1 })
        .lean();

      const map = new Map();

      for (const pur of purchases) {
        const key = pur.supplierId;

        if (!map.has(key)) {
          map.set(key, {
            supplierId: pur.supplierId,
            supplierName: pur.supplierName,
            bills: 0,
            noOfProducts: 0, // total batches
            totalQty: 0,
            amount: 0,
            tax: 0,
            grandTotal: 0,
          });
        }

        const entry = map.get(key);

        entry.bills += 1;

        let qtySum = 0;
        let amount = 0;
        let tax = 0;

        const batches = pur.batches || [];

        // ⭐ Count product batches
        entry.noOfProducts += batches.length;

        for (const b of batches) {
          const qty = Number(b.qty || 0);
          const rate = Number(b.rate || 0);
          const gst = Number(b.gst || 0);
          const value = Number(b.value || 0);

          qtySum += qty;
          amount += value;
          tax += (rate * qty * gst) / 100;
        }

        entry.totalQty += qtySum;
        entry.amount += amount;
        entry.tax += tax;
        entry.grandTotal += pur.totalAmount || 0;
      }

      const rows = Array.from(map.values());


      /* ------------------ FIRST & LAST DATE ------------------ */
      let firstDate = null;
      let lastDate = null;

      if (purchases.length > 0) {
        firstDate = purchases[0].createdAt;
        lastDate = purchases[purchases.length - 1].createdAt;
      }


      /* -------------------------------------------------
         SUMMARY
      ------------------------------------------------- */
      const summary = {
        bills: rows.reduce((s, r) => s + r.bills, 0),
        totalQty: rows.reduce((s, r) => s + r.totalQty, 0),
        noOfProducts: rows.reduce((s, r) => s + r.noOfProducts, 0),
        amount: rows.reduce((s, r) => s + r.amount, 0),
        tax: rows.reduce((s, r) => s + r.tax, 0),
        grandTotal: rows.reduce((s, r) => s + r.grandTotal, 0),
        firstDate,
        lastDate,
      };


      if (isExport === "1") {
        return res.json({
          rows,
          summary: {
            bills: rows.reduce((s, r) => s + r.bills, 0),
            totalQty: rows.reduce((s, r) => s + r.totalQty, 0),
            noOfProducts: rows.reduce((s, r) => s + r.noOfProducts, 0),
            amount: rows.reduce((s, r) => s + r.amount, 0),
            tax: rows.reduce((s, r) => s + r.tax, 0),
            grandTotal: rows.reduce((s, r) => s + r.grandTotal, 0),
            firstDate,
            lastDate,
          },
        });
      }


      const pageNum = Number(page);
      const pageSize = Number(limit);

      const totalRecords = rows.length;
      const totalPages = Math.ceil(totalRecords / pageSize);

      const paginatedRows = rows.slice(
        (pageNum - 1) * pageSize,
        pageNum * pageSize
      );




      return res.json({
        rows: paginatedRows, summary,

        pagination: {
          page: pageNum,
          limit: pageSize,
          totalRecords,
          totalPages,
        },
      });
    } catch (err) {
      console.error("❌ name-register error:", err);
      return res.status(500).json({
        message: "Failed to build name register report",
        error: err.message,
      });
    }
  }
);



router.get(
  "/shops/:shopname/branch-reports/purchase/gstreport",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;
      const { from, to, page = 1, limit = 10, export: isExport } = req.query;

      let Purchase;

      // Tenant request
      if (req.tenantModels) {
        Purchase = req.tenantModels.Purchase;
      }
      // Manager / Megaadmin → fetch tenant DB
      else if (req.dbManager && req.dbManager.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb) {
          return res.status(404).json({
            message: `Shop '${shopname}' not found`,
          });
        }
        Purchase = tenantDb.model("Purchase");
      } else {
        return res
          .status(500)
          .json({ message: "Tenant DB manager not initialized" });
      }

      if (!Purchase) {
        return res.status(400).json({ message: "Purchase model missing" });
      }

      /* ------------------------
         DATE FILTER
      ------------------------ */
      const query = {};

      if (from && to) {
        const f = new Date(from);
        const t = new Date(to);

        f.setHours(0, 0, 0, 0);
        t.setHours(23, 59, 59, 999);

        query.createdAt = { $gte: f, $lte: t };
      }

      /* ------------------------
         FETCH PURCHASES
      ------------------------ */
      const purchases = await Purchase.find(query)
        .sort({ createdAt: 1 })
        .lean();

      /* ------------------------
         GST GROUP BY MAP
      ------------------------ */
      const gstMap = new Map();

      for (const pur of purchases) {
        for (const b of pur.batches || []) {
          const gst = Number(b.gst || 0);
          const qty = Number(b.qty || 0);
          const rate = Number(b.rate || 0);
          const value = Number(b.value || 0);

          // GST amount
          const gstAmount = (rate * qty * gst) / 100;

          if (!gstMap.has(gst)) {
            gstMap.set(gst, {
              gstPercent: gst,
              totalQty: 0,
              totalValue: 0,
              totalGstAmount: 0,
              cgst: 0,
              sgst: 0,
            });
          }

          const entry = gstMap.get(gst);
          entry.totalQty += qty;
          entry.totalValue += value;
          entry.totalGstAmount += gstAmount;
          entry.cgst += gstAmount / 2;
          entry.sgst += gstAmount / 2;
        }
      }

      const rows = Array.from(gstMap.values());

      /* ------------------ FIRST & LAST DATE ------------------ */
      let firstDate = null;
      let lastDate = null;

      if (purchases.length > 0) {
        firstDate = purchases[0].createdAt;
        lastDate = purchases[purchases.length - 1].createdAt;
      }

      const summary = {
        totalQty: rows.reduce((s, r) => s + r.totalQty, 0),
        totalValue: rows.reduce((s, r) => s + r.totalValue, 0),
        totalGstAmount: rows.reduce((s, r) => s + r.totalGstAmount, 0),
        totalCgst: rows.reduce((s, r) => s + r.cgst, 0),
        totalSgst: rows.reduce((s, r) => s + r.sgst, 0),
        firstDate,
        lastDate,
      };

      const pageNum = Number(page);
      const pageSize = Number(limit);

      const totalRecords = rows.length;
      const totalPages = Math.ceil(totalRecords / pageSize);

      const paginatedRows = rows.slice(
        (pageNum - 1) * pageSize,
        pageNum * pageSize
      );

      if (isExport === "1") {
        return res.json({
          rows,
          summary,
        });
      }


      return res.json({
        rows: paginatedRows,
        summary,
        pagination: {
          page: pageNum,
          limit: pageSize,
          totalRecords,
          totalPages,
        },
      });




    } catch (err) {
      console.error("❌ GST Report Error:", err);
      return res.status(500).json({
        message: "Failed to build GST report",
        error: err.message,
      });
    }
  }
);



router.get(
  "/shops/:shopname/branch-reports/purchase/supplier/:supplierName",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname, supplierName } = req.params;
      const { from, to } = req.query;

      let Purchase;

      /* -------------------------------------------------
         RESOLVE PURCHASE MODEL (TENANT / MASTER)
      ------------------------------------------------- */

      // Tenant user
      if (req.tenantModels) {
        Purchase = req.tenantModels.Purchase;
      }
      // Master / Megaadmin
      else if (req.dbManager && req.dbManager.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb) {
          return res.status(404).json({
            message: `Shop '${shopname}' not found`,
          });
        }
        Purchase = tenantDb.model("Purchase");
      } else {
        return res
          .status(500)
          .json({ message: "Tenant DB manager not initialized" });
      }

      if (!Purchase) {
        return res.status(400).json({ message: "Purchase model missing" });
      }

      /* -------------------------------------------------
         BUILD QUERY (DO NOT MISS LOGIC)
      ------------------------------------------------- */

      const query = { supplierName };

      if (from && to) {
        const f = new Date(from);
        const t = new Date(to);

        f.setHours(0, 0, 0, 0);
        t.setHours(23, 59, 59, 999);

        query.createdAt = { $gte: f, $lte: t };
      }

      /* -------------------------------------------------
         FETCH PURCHASES
      ------------------------------------------------- */

      const purchases = await Purchase.find(query)
        .sort({ createdAt: 1 })
        .lean();

      return res.json({ rows: purchases });

    } catch (err) {
      console.error("❌ Supplier bills error:", err);
      return res.status(500).json({
        message: "Failed to load supplier bills",
        error: err.message,
      });
    }
  }
);




// ---------------------------------------------
// EXPENSE REPORT 
// ---------------------------------------------

router.get(
  "/shops/:shopname/branch-reports/expense",
  authTenantOrMaster,
  async (req, res) => {
    try {
      let Expense;
      const { shopname } = req.params;

      const { from, to, page = 1, limit = 10, export: isExport } = req.query;

      // Tenant user
      if (req.tenantModels) {
        Expense = req.tenantModels.Expense;
      }
      // Manager / Megaadmin → master DB → tenant DB
      else if (req.dbManager && req.dbManager.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb) {
          return res.status(404).json({
            message: `Shop '${shopname}' not found`,
          });
        }
        Expense = tenantDb.model("Expense");
      } else {
        return res
          .status(500)
          .json({ message: "Tenant DB manager not initialized" });
      }

      if (!Expense) {
        return res.status(400).json({ message: "Expense model missing" });
      }

      /* ------------------------
         ORIGINAL LOGIC — UNCHANGED
      ------------------------ */
      const query = {};

      if (from && to) {
        const f = new Date(from);
        const t = new Date(to);

        f.setHours(0, 0, 0, 0);
        t.setHours(23, 59, 59, 999);

        query.date = { $gte: f, $lte: t };
      }


      // 🔥 EXPORT MODE (NO PAGINATION)
      if (isExport === "1") {
        const rows = await Expense.find(query)
          .sort({ date: -1 })
          .lean();

        const totalAmount = rows.reduce(
          (s, r) => s + Number(r.amount || 0),
          0
        );

        return res.json({
          rows,
          summary: { totalAmount },
        });
      }

      const pageNum = Math.max(1, Number(page));
      const pageSize = Math.max(1, Number(limit));
      const skip = (pageNum - 1) * pageSize;

      const totalRecords = await Expense.countDocuments(query);

      const expenses = await Expense.find(query)
        .sort({ date: -1 })

        .skip(skip)
        .limit(pageSize)
        .lean();



      let firstDate = null;
      let lastDate = null;

      if (totalRecords > 0) {
        const first = await Expense.findOne(query).sort({ date: 1 }).select("date");
        const last = await Expense.findOne(query).sort({ date: -1 }).select("date");
        firstDate = first?.date || null;
        lastDate = last?.date || null;
      }

      const totalAmount = expenses.reduce(
        (sum, e) => sum + Number(e.amount || 0),
        0
      );

      //     return res.json({
      //       rows: expenses,
      //       summary: { totalAmount },
      //        firstDate,
      // lastDate,
      //     });

      res.json({
        rows: expenses,
        summary: { totalAmount },
        firstDate,
        lastDate,
        pagination: {
          page: pageNum,
          limit: pageSize,
          totalRecords,
          totalPages: Math.ceil(totalRecords / pageSize),
        },
      });


    } catch (err) {
      console.error("❌ getExpenseReport error:", err);
      return res.status(500).json({
        message: "Failed to build expense report",
        error: err.message,
      });
    }
  }
);


router.get(
  "/shops/:shopname/branch-reports/expense/categoryreports",
  authTenantOrMaster,
  async (req, res) => {
    try {
      let Expense;
      const { shopname } = req.params;


      const { from, to, category, page = 1, limit = 10, export: isExport, } = req.query;

      // Tenant user
      if (req.tenantModels) {
        Expense = req.tenantModels.Expense;
      }
      // Manager / Megaadmin
      else if (req.dbManager && req.dbManager.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb) {
          return res.status(404).json({
            message: `Shop '${shopname}' not found`,
          });
        }
        Expense = tenantDb.model("Expense");
      } else {
        return res
          .status(500)
          .json({ message: "Tenant DB manager not initialized" });
      }

      if (!Expense) {
        return res.status(400).json({ message: "Expense model missing" });
      }

      /* ------------------------
         ORIGINAL LOGIC — UNCHANGED
      ------------------------ */
      const query = {};

      if (from && to) {
        const f = new Date(from);
        const t = new Date(to);

        f.setHours(0, 0, 0, 0);
        t.setHours(23, 59, 59, 999);

        query.date = { $gte: f, $lte: t };
      }

      if (category && category.trim()) {
        query.category = new RegExp(category.trim(), "i");
      }




      const expenses = await Expense.find(query)
        .sort({ date: 1 })
        .lean();





      let firstDate = null;
      let lastDate = null;

      if (expenses.length) {
        firstDate = expenses[0].date;
        lastDate = expenses[expenses.length - 1].date;
      }

      const map = new Map();

      for (const e of expenses) {
        const cat = (e.category || "Uncategorized").trim();

        if (!map.has(cat)) {
          map.set(cat, {
            category: cat,
            entries: 0,
            totalAmount: 0,
          });
        }

        const entry = map.get(cat);
        entry.entries += 1;
        entry.totalAmount += Number(e.amount || 0);
      }

      const rows = Array.from(map.values());

      /* ===============================
    🔥 EXPORT MODE (NO PAGINATION)
    =============================== */
      if (isExport === "1") {
        return res.json({
          rows,
          summary: {
            entries: rows.reduce((s, r) => s + r.entries, 0),
            totalAmount: rows.reduce((s, r) => s + r.totalAmount, 0),
          },
          firstDate,
          lastDate,
        });
      }

      // PAGINATION (AFTER GROUP)
      const pageNum = Math.max(1, Number(page));
      const pageSize = Math.max(1, Number(limit));
      const totalRecords = rows.length;
      const start = (pageNum - 1) * pageSize;

      const paginatedRows = rows.slice(start, start + pageSize);




      // const summary = {
      //   entries: rows.reduce((s, r) => s + r.entries, 0),
      //   totalAmount: rows.reduce((s, r) => s + r.totalAmount, 0),
      // };

      // return res.json({ rows, summary ,firstDate,lastDate });


      res.json({
        rows: paginatedRows,
        summary: {
          entries: rows.reduce((s, r) => s + r.entries, 0),
          totalAmount: rows.reduce((s, r) => s + r.totalAmount, 0),
        },
        firstDate,
        lastDate,
        pagination: {
          page: pageNum,
          limit: pageSize,
          totalRecords,
          totalPages: Math.ceil(totalRecords / pageSize),
        },
      });



    } catch (err) {
      console.error("❌ getExpenseCategoryReport error:", err);
      return res.status(500).json({
        message: "Failed to build expense category report",
        error: err.message,
      });
    }
  }
);



router.get(
  "/shops/:shopname/branch-reports/expense/category/details",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { Expense } = req.tenantModels || {};

      if (!Expense) {
        return res.status(400).json({ message: "Expense model missing" });
      }

      const {
        category,
        from,
        to,
        page = 1,
        limit = 5, // 🔥 modal pagination size
        export: isExport
      } = req.query;

      const query = {};

      // CATEGORY FILTER
      if (category) {
        query.category = category;
      }

      // DATE RANGE FILTER
      if (from && to) {
        const f = new Date(from);
        const t = new Date(to);

        f.setHours(0, 0, 0, 0);
        t.setHours(23, 59, 59, 999);

        query.date = { $gte: f, $lte: t };
      }


      // 🔥 EXPORT MODE — NO PAGINATION
      if (isExport === "1") {
        const rows = await Expense.find(query)
          .sort({ date: -1 })
          .lean();

        const summary = {
          totalAmount: rows.reduce((s, r) => s + Number(r.amount || 0), 0),
          entries: rows.length,
        };

        return res.json({ rows, summary });
      }

      // PAGINATION
      const pageNum = Math.max(1, Number(page));
      const pageSize = Math.max(1, Number(limit));
      const skip = (pageNum - 1) * pageSize;

      const totalRecords = await Expense.countDocuments(query);

      const rows = await Expense.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean();

      return res.json({
        rows,
        pagination: {
          page: pageNum,
          limit: pageSize,
          totalRecords,
          totalPages: Math.ceil(totalRecords / pageSize),
        },
      });
    } catch (err) {
      console.error("❌ Category expense details error:", err);
      return res.status(500).json({
        message: "Failed to load category expense details",
        error: err.message,
      });
    }
  }
);








//


const puppeteer = require("puppeteer");
const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const pdfPrint = require("pdf-to-printer");
const { print } = require("pdf-to-printer");
const Product = require("../models/Product"); // ✅ IMPORT MODEL
// const htmlPdf = require("html-pdf");

const PRINTER = process.env.PRINTER;

//Stock Print and Pdf

const { buildStockReportHtml } = require(
  "../utils/PrintAndPDF/buildStockReportHtml"
);

const { buildCategoryProductsHtml } = require(
  "../utils/PrintAndPDF/buildCategoryProductsHtml"
);

router.post(
  "/shops/:shopname/master/stock/print",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      const { mode, periodLabel, rows } = req.body;

      const html = buildStockReportHtml({
        shopname,
        mode,
        periodLabel,
        rows,
      });

      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "domcontentloaded" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
      });

      await browser.close();

      const tempFile = path.join(os.tmpdir(), `stock-${Date.now()}.pdf`);
      await fs.writeFile(tempFile, pdfBuffer);

      await print(tempFile, {
        printer: PRINTER,
        copies: 1,
      });

      await fs.remove(tempFile);

      res.json({ success: true });
    } catch (err) {
      console.error("❌ PRINT ERROR:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.post(
  "/shops/:shopname/master/stock/pdf",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;
      const { mode, periodLabel, rows } = req.body;

      const html = buildStockReportHtml({
        shopname,
        mode,
        periodLabel,
        rows,
      });

      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "domcontentloaded" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
      });

      await browser.close();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Stock_Report_${new Date().toLocaleDateString("en-IN")}.pdf`
      );

      res.end(pdfBuffer);
    } catch (err) {
      console.error("❌ PDF ERROR:", err);
      res.status(500).json({ success: false });
    }
  }
);

router.post(
  "/shops/:shopname/master/category-products/print",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      let Product;

      // TENANT
      if (req.tenantModels) {
        Product = req.tenantModels.Product;
      }
      // MASTER
      else if (req.dbManager && req.dbManager.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb)
          return res.status(404).json({ message: `Shop '${shopname}' not found` });

        Product = tenantDb.model("Product");
      }

      if (!Product)
        return res.status(400).json({ message: "Product model missing" });

      const { category, periodLabel } = req.body;

      // ----------------------------------
      // FETCH PRODUCTS (FIXED)
      // ----------------------------------
      const products = await Product.find({
        category,
        status: "active",
      })
        .select("code name batches totalQty")
        .lean();

      // ----------------------------------
      // BUILD ROWS + TOTALS (FIXED)
      // ----------------------------------
      let totalQty = 0;
      let totalValue = 0;

      const rows = products.map((p) => {
        const qty = Number(p.totalQty || 0);

        const batches = (p.batches || []).filter(
          (b) => b.status === "active"
        );

        let remainingQty = qty;
        let productValue = 0;

        // FIFO
        for (const b of batches) {
          if (remainingQty <= 0) break;

          const batchQty = Number(b.qty || 0);
          const price = Number(b.salePrice || b.mrp || 0);

          if (batchQty <= 0 || price <= 0) continue;

          const usedQty = Math.min(batchQty, remainingQty);
          productValue += usedQty * price;
          remainingQty -= usedQty;
        }

        totalQty += qty;
        totalValue += productValue;

        return {
          code: p.code,
          name: p.name,
          qty,
          value: productValue,
        };
      });

      // ----------------------------------
      // HTML (SAME FORMAT)
      // ----------------------------------
      const html = buildCategoryProductsHtml({
        shopname,
        category,
        periodLabel,
        rows,
        totalQty,
        totalValue,
      });

      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
      });

      await browser.close();

      const tempFile = path.join(os.tmpdir(), `category-${Date.now()}.pdf`);
      await fs.writeFile(tempFile, pdfBuffer);

      await print(tempFile, {
        printer: PRINTER,
        copies: 1,
      });

      await fs.remove(tempFile);

      res.json({ success: true });

    } catch (err) {
      console.error("❌ CATEGORY PRINT ERROR", err);
      res.status(500).json({ success: false });
    }
  }
);

router.post(
  "/shops/:shopname/master/category-products/pdf",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      let Product;

      // TENANT
      if (req.tenantModels) {
        Product = req.tenantModels.Product;
      }
      // MASTER
      else if (req.dbManager && req.dbManager.getTenantDb) {
        const tenantDb = req.dbManager.getTenantDb(shopname);
        if (!tenantDb)
          return res.status(404).json({ message: `Shop '${shopname}' not found` });

        Product = tenantDb.model("Product");
      }

      if (!Product)
        return res.status(400).json({ message: "Product model missing" });

      const { category, periodLabel } = req.body;

      // ----------------------------------
      // FETCH PRODUCTS (FIXED)
      // ----------------------------------
      const products = await Product.find({
        category,
        status: "active",
      })
        .select("code name batches totalQty")
        .lean();

      // ----------------------------------
      // BUILD ROWS + TOTALS (FIXED)
      // ----------------------------------
      let totalQty = 0;
      let totalValue = 0;

      const rows = products.map((p) => {
        const qty = Number(p.totalQty || 0);

        const batches = (p.batches || []).filter(
          (b) => b.status === "active"
        );

        let remainingQty = qty;
        let productValue = 0;

        // FIFO
        for (const b of batches) {
          if (remainingQty <= 0) break;

          const batchQty = Number(b.qty || 0);
          const price = Number(b.salePrice || b.mrp || 0);

          if (batchQty <= 0 || price <= 0) continue;

          const usedQty = Math.min(batchQty, remainingQty);
          productValue += usedQty * price;
          remainingQty -= usedQty;
        }

        totalQty += qty;
        totalValue += productValue;

        return {
          code: p.code,
          name: p.name,
          qty,
          value: productValue,
        };
      });

      // ----------------------------------
      // HTML
      // ----------------------------------
      const html = buildCategoryProductsHtml({
        shopname,
        category,
        periodLabel,
        rows,
        totalQty,
        totalValue,
      });

      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
      });

      await browser.close();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${category}_Stock.pdf`
      );

      res.end(pdf);

    } catch (err) {
      console.error("❌ CATEGORY PDF ERROR", err);
      res.status(500).json({ success: false });
    }
  }
);

    


//Counter print and pdf 
const buildCounterHtml = require("../utils/PrintAndPDF/CollectionCounterReportHtml");



async function generatePdf(html) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "domcontentloaded" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
  });

  await browser.close();
  return pdfBuffer;
}


router.post(
  "/shops/:shopname/master/collections/counter/print",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const html = buildCounterHtml(req.body);
      const pdf = await generatePdf(html);

      const file = path.join(
        os.tmpdir(),
        `collections-counter-${Date.now()}.pdf`
      );

      await fs.writeFile(file, pdf);
      await print(file, { printer: PRINTER });
      await fs.remove(file);

      res.json({ success: true });
    } catch (err) {
      console.error("❌ Master Counter Print Error:", err);
      res.status(500).json({ success: false });
    }
  }
);




router.post(
  "/shops/:shopname/master/collections/counter/pdf",
  authTenantOrMaster,
  async (req, res) => {
    const html = buildCounterHtml(req.body);
    const pdf = await generatePdf(html);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=collections-counter.pdf"
    );

    res.end(pdf);
  }
);



const buildUserHtml = require(
  "../utils/PrintAndPDF/CollectionUserReportHtml"
);

// ----------------------------------------------------------
// USER COLLECTION — PRINT (Direct Printer)
// ----------------------------------------------------------
router.post(
  "/shops/:shopname/master/collections/user/print",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const html = buildUserHtml(req.body);
      const pdf = await generatePdf(html);

      const file = path.join(
        os.tmpdir(),
        `collections-user-${Date.now()}.pdf`
      );

      await fs.writeFile(file, pdf);
      await print(file, { printer: PRINTER });
      await fs.remove(file);

      res.json({ success: true });
    } catch (err) {
      console.error("❌ Master User Collection Print Error:", err);
      res.status(500).json({ success: false });
    }
  }
);

// ----------------------------------------------------------
// USER COLLECTION — PDF DOWNLOAD
// ----------------------------------------------------------
router.post(
  "/shops/:shopname/master/collections/user/pdf",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const html = buildUserHtml(req.body);
      const pdf = await generatePdf(html);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=collections-user.pdf"
      );

      res.end(pdf);
    } catch (err) {
      console.error("❌ Master User Collection PDF Error:", err);
      res.status(500).json({ success: false });
    }
  }
);


const buildStatementHtml = require(
  "../utils/PrintAndPDF/CollectionStatementReportHtml"
);

// ----------------------------------------------------------
// COLLECTION STATEMENT — PRINT (Direct Printer)
// ----------------------------------------------------------
router.post(
  "/shops/:shopname/master/collections/statement/print",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const html = buildStatementHtml(req.body);
      const pdf = await generatePdf(html);

      const file = path.join(
        os.tmpdir(),
        `collections-statement-${Date.now()}.pdf`
      );

      await fs.writeFile(file, pdf);
      await print(file, { printer: PRINTER });
      await fs.remove(file);

      res.json({ success: true });
    } catch (err) {
      console.error("❌ Collections Statement Print Error:", err);
      res.status(500).json({ success: false });
    }
  }
);

// ----------------------------------------------------------
// COLLECTION STATEMENT — PDF DOWNLOAD
// ----------------------------------------------------------
router.post(
  "/shops/:shopname/master/collections/statement/pdf",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const html = buildStatementHtml(req.body);
      const pdf = await generatePdf(html);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=collections-statement.pdf"
      );

      res.end(pdf);
    } catch (err) {
      console.error("❌ Collections Statement PDF Error:", err);
      res.status(500).json({ success: false });
    }
  }
);








const expenseHtml = require("../utils/PrintAndPDF/ExpenseReportHtml");
const categoryHtml = require("../utils/PrintAndPDF/ExpenseCategoryReportHtml");

const buildExpenseCategoryViewHtml = require(
  "../utils/PrintAndPDF/ExpenseCategoryViewModelReportHtml"
);

// ----------------------------------------------------------
// EXPENSE REPORT – PRINT
// ----------------------------------------------------------
router.post(
  "/shops/:shopname/master/expense/print",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      // ORIGINAL LOGIC (UNCHANGED)
      const html = expenseHtml(req.body);
      res.send(html);

    } catch (err) {
      console.error("❌ Expense Print Error:", err);
      res.status(500).json({ success: false });
    }
  }
);

// ----------------------------------------------------------
// EXPENSE REPORT – PDF
// ----------------------------------------------------------
// router.post(
//   "/shops/:shopname/master/expense/pdf",
//   authTenantOrMaster,
//   async (req, res) => {
//     try {
//       const { shopname } = req.params;

//       // ORIGINAL LOGIC (UNCHANGED)
//       const html = expenseHtml(req.body);

//       htmlPdf.create(html).toBuffer((err, buf) => {
//         if (err) {
//           console.error("❌ Expense PDF Error:", err);
//           return res.status(500).send(err.message);
//         }

//         res.set({ "Content-Type": "application/pdf" });
//         res.send(buf);
//       });

//     } catch (err) {
//       console.error("❌ Expense PDF Error:", err);
//       res.status(500).json({ success: false });
//     }
//   }
// );



const { buildExpenseViewHtml } = require(
  "../utils/PrintAndPDF/ExpenseViewHtml"
);


router.post(
  "/shops/:shopname/master/expense/view/print",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      const pdf = await generatePdf(
        buildExpenseViewHtml({
          shopname,
          ...req.body,
        })
      );

      const file = path.join(
        os.tmpdir(),
        `expense-${Date.now()}.pdf`
      );

      await fs.writeFile(file, pdf);
      await print(file, { printer: PRINTER });
      await fs.remove(file);

      return res.json({ success: true });
    } catch (err) {
      console.error("❌ Expense view print error:", err);
      return res.status(500).json({
        message: "Failed to print expense view",
        error: err.message,
      });
    }
  }
);


router.post(
  "/shops/:shopname/master/expense/view/pdf",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      const pdf = await generatePdf(
        buildExpenseViewHtml({
          shopname,
          ...req.body,
        })
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=Expense_View.pdf"
      );

      return res.end(pdf);
    } catch (err) {
      console.error("❌ Expense view PDF error:", err);
      return res.status(500).json({
        message: "Failed to generate expense view PDF",
        error: err.message,
      });
    }
  }
);


// ----------------------------------------------------------
// EXPENSE CATEGORY SUMMARY – PRINT
// ----------------------------------------------------------
router.post(
  "/shops/:shopname/master/expense/category/print",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      // ORIGINAL LOGIC (UNCHANGED)
      const html = categoryHtml(req.body);
      res.send(html);

    } catch (err) {
      console.error("❌ Expense Category Print Error:", err);
      res.status(500).json({ success: false });
    }
  }
);


// router.post(
//   "/shops/:shopname/master/expense/category/pdf",
//   authTenantOrMaster,
//   async (req, res) => {
//     try {
//       const { shopname } = req.params;

//       // ORIGINAL LOGIC (UNCHANGED)
//       const html = categoryHtml(req.body);

//       htmlPdf.create(html).toBuffer((err, buf) => {
//         if (err) {
//           console.error("❌ Expense Category PDF Error:", err);
//           return res.status(500).send(err.message);
//         }

//         res.set({ "Content-Type": "application/pdf" });
//         res.send(buf);
//       });

//     } catch (err) {
//       console.error("❌ Expense Category PDF Error:", err);
//       res.status(500).json({ success: false });
//     }
//   }
// );


// ----------------------------------------------------------
// EXPENSE CATEGORY DETAILS – PRINT
// ----------------------------------------------------------
router.post(
  "/shops/:shopname/master/expense/category/details/print",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      // ORIGINAL LOGIC (UNCHANGED)
      const html = buildExpenseCategoryViewHtml(req.body);
      res.send(html);

    } catch (err) {
      console.error("❌ Expense Category Details Print Error:", err);
      res.status(500).json({ success: false });
    }
  }
);

// ----------------------------------------------------------
// EXPENSE CATEGORY DETAILS – PDF
// ----------------------------------------------------------
// router.post(
//   "/shops/:shopname/master/expense/category/details/pdf",
//   authTenantOrMaster,
//   async (req, res) => {
//     try {
//       const { shopname } = req.params;

//       // ORIGINAL LOGIC (UNCHANGED)
//       const html = buildExpenseCategoryViewHtml(req.body);

//       htmlPdf.create(html, { format: "A4" }).toBuffer((err, buffer) => {
//         if (err) {
//           console.error("❌ Expense Category Details PDF Error:", err);
//           return res.status(500).send(err.message);
//         }

//         res.set({
//           "Content-Type": "application/pdf",
//           "Content-Disposition":
//             "attachment; filename=Category_Expense.pdf",
//         });

//         res.send(buffer);
//       });

//     } catch (err) {
//       console.error("❌ Expense Category Details PDF Error:", err);
//       res.status(500).json({ success: false });
//     }
//   }
// );






/* ===============================
   HTML BUILDERS
================================ */

const {
  buildPurchaseRegisterHtml,
} = require("../utils/PrintAndPDF/buildPurchaseRegisterHtml");

const {
  buildPurchaseNameRegisterHtml,
} = require("../utils/PrintAndPDF/buildPurchaseNameRegisterHtml");

const {
  buildPurchaseGstHtml,
} = require("../utils/PrintAndPDF/buildPurchaseGstHtml");

/* ===============================
   PDF GENERATOR (UNCHANGED)
================================ */

async function generatePdf(html) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
  });

  await browser.close();
  return pdf;
}

/* ===============================
   PURCHASE REGISTER
================================ */

// PRINT
router.post(
  "/shops/:shopname/master/purchase/register/print",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      const pdf = await generatePdf(
        buildPurchaseRegisterHtml(req.body)
      );

      const file = path.join(
        os.tmpdir(),
        `purchase-${Date.now()}.pdf`
      );

      await fs.writeFile(file, pdf);
      await print(file, { printer: PRINTER });
      await fs.remove(file);

      res.json({ success: true });
    } catch (err) {
      console.error("❌ Purchase Register Print Error:", err);
      res.status(500).json({ success: false });
    }
  }
);

// PDF
router.post(
  "/shops/:shopname/master/purchase/register/pdf",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      const pdf = await generatePdf(
        buildPurchaseRegisterHtml(req.body)
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=Purchase_Register.pdf"
      );

      res.end(pdf);
    } catch (err) {
      console.error("❌ Purchase Register PDF Error:", err);
      res.status(500).json({ success: false });
    }
  }
);



const { buildPurchaseViewHtml } = require(
  "../utils/PrintAndPDF/PurchaseViewHtml"
);
/**
 * PRINT PURCHASE VIEW
 */
router.post(
  "/shops/:shopname/master/purchase/view/print",
  authTenantOrMaster,
  async (req, res, next) => {
    try {
      // inject shopname into body
      req.body.shopname = req.params.shopname;

      const pdf = await generatePdf(
        buildPurchaseViewHtml(req.body)
      );

      const file = path.join(
        os.tmpdir(),
        `purchase-${Date.now()}.pdf`
      );

      await fs.writeFile(file, pdf);
      await print(file);
      await fs.remove(file);

      res.json({ success: true });
    } catch (err) {
      console.error("❌ Purchase view print error:", err);
      res.status(500).json({ message: "Print failed" });
    }
  }
);

/**
 * DOWNLOAD PURCHASE VIEW PDF
 */
router.post(
  "/shops/:shopname/master/purchase/view/pdf",
  authTenantOrMaster,
  async (req, res, next) => {
    try {
      // inject shopname into body
      req.body.shopname = req.params.shopname;

      const pdf = await generatePdf(
        buildPurchaseViewHtml(req.body)
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=Purchase_View.pdf"
      );

      res.end(pdf);
    } catch (err) {
      console.error("❌ Purchase view PDF error:", err);
      res.status(500).json({ message: "PDF failed" });
    }
  }
);


/* ===============================
   SUPPLIER REPORT
================================ */

// PRINT
router.post(
  "/shops/:shopname/master/purchase/supplier/print",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      const pdf = await generatePdf(
        buildPurchaseNameRegisterHtml(req.body)
      );

      const file = path.join(
        os.tmpdir(),
        `supplier-${Date.now()}.pdf`
      );

      await fs.writeFile(file, pdf);
      await print(file, { printer: PRINTER });
      await fs.remove(file);

      res.json({ success: true });
    } catch (err) {
      console.error("❌ Purchase Supplier Print Error:", err);
      res.status(500).json({ success: false });
    }
  }
);

// PDF
router.post(
  "/shops/:shopname/master/purchase/supplier/pdf",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      const pdf = await generatePdf(
        buildPurchaseNameRegisterHtml(req.body)
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=Supplier_Report.pdf"
      );

      res.end(pdf);
    } catch (err) {
      console.error("❌ Purchase Supplier PDF Error:", err);
      res.status(500).json({ success: false });
    }
  }
);

/* ===============================
   GST REPORT
================================ */

// PRINT
router.post(
  "/shops/:shopname/master/purchase/gst/print",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      const pdf = await generatePdf(
        buildPurchaseGstHtml(req.body)
      );

      const file = path.join(
        os.tmpdir(),
        `gst-${Date.now()}.pdf`
      );

      await fs.writeFile(file, pdf);
      await print(file, { printer: PRINTER });
      await fs.remove(file);

      res.json({ success: true });
    } catch (err) {
      console.error("❌ Purchase GST Print Error:", err);
      res.status(500).json({ success: false });
    }
  }
);

// PDF
router.post(
  "/shops/:shopname/master/purchase/gst/pdf",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      const pdf = await generatePdf(
        buildPurchaseGstHtml(req.body)
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=GST_Report.pdf"
      );

      res.end(pdf);
    } catch (err) {
      console.error("❌ Purchase GST PDF Error:", err);
      res.status(500).json({ success: false });
    }
  }
);


const { buildSupplierBillsHtml } = require(
  "../utils/PrintAndPDF/SupplierDetailsHtml"
);

router.post(
  "/shops/:shopname/master/purchase/supplier-bills/print",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const pdf = await generatePdf(
        buildSupplierBillsHtml(req.body)
      );

      const file = path.join(
        os.tmpdir(),
        `supplier-${Date.now()}.pdf`
      );

      await fs.writeFile(file, pdf);
      await print(file, { printer: PRINTER });
      await fs.remove(file);

      return res.json({ success: true });
    } catch (err) {
      console.error("❌ Supplier bills print error:", err);
      return res.status(500).json({
        message: "Failed to print supplier bills",
        error: err.message,
      });
    }
  }
);




router.post(
  "/shops/:shopname/master/purchase/supplier-bills/pdf",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const pdf = await generatePdf(
        buildSupplierBillsHtml(req.body)
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=Supplier_Bills.pdf"
      );

      return res.end(pdf);
    } catch (err) {
      console.error("❌ Supplier bills PDF error:", err);
      return res.status(500).json({
        message: "Failed to generate supplier bills PDF",
        error: err.message,
      });
    }
  }
);






const { buildSalesBillWiseHtml } = require(
  "../utils/PrintAndPDF/SalesBillHtml"
);

// ----------------------------------------------------------
// SALES BILLWISE – PRINT
// ----------------------------------------------------------
router.post(
  "/shops/:shopname/master/sales/billwise/print",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      // ORIGINAL LOGIC (UNCHANGED)
      const html = buildSalesBillWiseHtml(req.body);

      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "domcontentloaded" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
      });

      await browser.close();

      const tempFile = path.join(
        os.tmpdir(),
        `billwise-${Date.now()}.pdf`
      );

      await fs.writeFile(tempFile, pdfBuffer);

      await print(tempFile, {
        printer: PRINTER,
        copies: 1,
      });

      await fs.remove(tempFile);

      res.json({ success: true });

    } catch (err) {
      console.error("❌ Sales Bill Print Error:", err);
      res.status(500).json({
        message: "Failed to print billwise sales",
      });
    }
  }
);

// ----------------------------------------------------------
// SALES BILLWISE – PDF
// ----------------------------------------------------------
router.post(
  "/shops/:shopname/master/sales/billwise/pdf",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      // ORIGINAL LOGIC (UNCHANGED)
      const html = buildSalesBillWiseHtml(req.body);

      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "domcontentloaded" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
      });

      await browser.close();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=BillWiseSales.pdf"
      );

      res.end(pdfBuffer);

    } catch (err) {
      console.error("❌ Sales Bill PDF Error:", err);
      res.status(500).json({
        message: "Failed to generate billwise PDF",
      });
    }
  }
);





const buildItemWiseBillHtml = require(
  "../utils/PrintAndPDF/ItemWiseBillReportHtml"
);
const buildItemWiseSalesHtml = require(
  "../utils/PrintAndPDF/ItemWiseSalesReportHtml"
);
const buildItemWiseDateHtml = require(
  "../utils/PrintAndPDF/ItemWiseDateReportHtml"
);

// ----------------------------------------------------------
// HELPER: PICK HTML BY MODE (UNCHANGED)
// ----------------------------------------------------------
const getHtmlByMode = (mode, payload) => {
  if (mode === "bill") return buildItemWiseBillHtml(payload);
  if (mode === "sales") return buildItemWiseSalesHtml(payload);
  if (mode === "datewise") return buildItemWiseDateHtml(payload);
  throw new Error("Invalid ItemWise mode");
};



// ----------------------------------------------------------
// ITEMWISE PRINT – MASTER
// ----------------------------------------------------------
router.post(
  "/shops/:shopname/master/itemwise/print",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { shopname } = req.params;

      // ORIGINAL LOGIC (UNCHANGED)
      const html = getHtmlByMode(req.body.mode, req.body);
      res.send(html);

    } catch (err) {
      console.error("❌ ItemWise Print Error:", err);
      res.status(500).json({ success: false });
    }
  }
);

// ----------------------------------------------------------
// ITEMWISE PDF – MASTER
// ----------------------------------------------------------
// router.post(
//   "/shops/:shopname/master/itemwise/pdf",
//   authTenantOrMaster,
//   async (req, res) => {
//     try {
//       const { shopname } = req.params;

//       // ORIGINAL LOGIC (UNCHANGED)
//       const html = getHtmlByMode(req.body.mode, req.body);

//       htmlPdf
//         .create(html, { format: "A4", border: "10mm" })
//         .toBuffer((err, buffer) => {
//           if (err) {
//             console.error("❌ ItemWise PDF Error:", err);
//             return res.status(500).send(err.message);
//           }

//           res.set({
//             "Content-Type": "application/pdf",
//             "Content-Disposition":
//               "attachment; filename=ItemWise.pdf",
//           });

//           res.send(buffer);
//         });

//     } catch (err) {
//       console.error("❌ ItemWise PDF Error:", err);
//       res.status(500).json({ success: false });
//     }
//   }
// );



module.exports = router;









