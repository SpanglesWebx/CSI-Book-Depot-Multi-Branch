


// routes/dashboardRoutes.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const tenantAuth = require("../middleware/authTenantOrMaster");
const { getTenantDB } = require("../config/tenantManager");
const {
  getSalesSummary,
  getLowStockCount,
  incrementStock,
  decrementStock,
  getSalesBills,
  getTopSellingProducts,
  getMasterSalesSummary,
  getProducts,
  respectiveShopSales,


  //REPORT PRINT AND PDF
  getTopSellingProductsPrint,
  getTopSellingProductsPdf,

  getLowStockProductsPrint,
  getLowStockProductsPdf,


  getInventoryProductsPrint,
  getInventoryProductsPdf,
} = require("../controllers/dashboardController");
const authTenantOrMaster = require("../middleware/authTenantOrMaster");
const Shop = require("../models/Shop");
const { getDateRange } = require("../utils/dateHelpers");

// ----------------------------
// Sales summary endpoints
// ----------------------------
router.get("/sales-bills/summary", tenantAuth, getSalesSummary);

// Fetch recent 5 sales bills (for dashboard)
router.get("/sales-bills/recent", tenantAuth, async (req, res) => {
  try {
    const { SalesBill } = req.tenantModels;
    const shopId = req.shop?._id;
    if (!shopId) return res.status(400).json({ message: "Shop context missing" });

    const bills = await SalesBill.find({ shop: shopId })
      .sort({ createdAt: -1 })
      .limit(5); // only last 5 bills

    res.json({ bills });
  } catch (err) {
    console.error("❌ recent sales error:", err);
    res.status(500).json({ message: "Failed to fetch recent bills", error: err.message });
  }
});

// Fetch full sales bills list (with pagination)
router.get("/sales-bills", tenantAuth, getSalesBills);
router.get("/product-total", tenantAuth, getProducts);
// ----------------------------
// Low Stock
// ----------------------------
router.get("/products/low-stock", tenantAuth, getLowStockCount);



router.get("/products/low-stock/recent", async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.shop._id;

    const products = await Product.find({ shop: shopId }).sort({ updatedAt: -1 });

    // Aggregate totalQty per product and filter low stock
    const lowStock = products
      .map((p) => {
        const totalQty = (p.batches || []).reduce((sum, b) => sum + Number(b.qty || 0), 0);
        const minQty = Number(String(p.minQty || p.min_quantity || 0).trim());
        return { ...p.toObject(), totalQty, minQty };
      })
      .filter((p) => p.totalQty <= p.minQty)
      .slice(0, 5); // only 5 most recent low-stock items

    res.json({ products: lowStock });
  } catch (err) {
    console.error("❌ low-stock error:", err);
    res.status(500).json({ message: "Failed to fetch low-stock products", error: err.message });
  }
});




router.get("/products/top-selling", authTenantOrMaster, getTopSellingProducts);

// ----------------------------
// Stock management
// ----------------------------
router.put("/products/increment-stock", tenantAuth, incrementStock);
router.put("/products/decrement-stock", tenantAuth, decrementStock);




// Apply middleware to all dashboard routes
router.use("/shops/:shopname/dashboard", authTenantOrMaster);

// ----------------------------
// Product totals
// GET /shops/:shopname/dashboard/product-total
// ----------------------------
router.get("/shops/:shopname/dashboard/product-total", authTenantOrMaster, getProducts);

router.get("/shops/:shopname/dashboard/sales-bills/summary", authTenantOrMaster, getSalesSummary);
router.get("/shops/:shopname/report-charts/sales-bills/summary", authTenantOrMaster, getSalesSummary);
router.get("/master/dashboard/sales-summary", authTenantOrMaster, getMasterSalesSummary);
router.get("/shops/:shopname/report-charts/respetive-shop-sales/summary", authTenantOrMaster, respectiveShopSales);



// Fetch recent 5 sales bills (for dashboard)
router.get("/shops/:shopname/dashboard/sales-bills/recent", authTenantOrMaster, async (req, res) => {
  try {
    const { SalesBill } = req.tenantModels;
    const shopId = req.shop?._id;
    if (!shopId) return res.status(400).json({ message: "Shop context missing" });

    const bills = await SalesBill.find({ shop: shopId })
      .sort({ createdAt: -1 })
      .limit(5); // only last 5 bills

    res.json({ bills });
  } catch (err) {
    console.error("❌ recent sales error:", err);
    res.status(500).json({ message: "Failed to fetch recent bills", error: err.message });
  }
});


router.get("/shops/:shopname/dashboard/sales-bills", authTenantOrMaster, getSalesBills);




// ----------------------------
// Recent low-stock products
// GET /shops/:shopname/dashboard/products/low-stock/recent
// ----------------------------

router.get("/shops/:shopname/dashboard/products/low-stock/recent", async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.shop._id;

    const products = await Product.find({ shop: shopId }).sort({ updatedAt: -1 });

    // Aggregate totalQty per product and filter low stock
    const lowStock = products
      .map((p) => {
        const totalQty = (p.batches || []).reduce((sum, b) => sum + Number(b.qty || 0), 0);
        const minQty = Number(String(p.minQty || p.min_quantity || 0).trim());
        return { ...p.toObject(), totalQty, minQty };
      })
      .filter((p) => p.totalQty <= p.minQty)
      .slice(0, 5); // only 5 most recent low-stock items

    res.json({ products: lowStock });
  } catch (err) {
    console.error("❌ low-stock error:", err);
    res.status(500).json({ message: "Failed to fetch low-stock products", error: err.message });
  }
});


router.get("/shops/:shopname/dashboard/products/top-selling", authTenantOrMaster, getTopSellingProducts);

// ----------------------------
// Stock increment/decrement

// PUT /shops/:shopname/dashboard/products/decrement-stock
// ----------------------------
router.put("/shops/:shopname/dashboard/products/increment-stock", async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.shop._id;
    const { productId, qty } = req.body;

    const product = await Product.findOne({ _id: productId, shop: shopId });
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.qty = (product.qty || 0) + Number(qty || 0);
    await product.save();

    res.json({ message: "Stock incremented", product });
  } catch (err) {
    console.error("❌ increment stock error:", err);
    res.status(500).json({ message: "Failed to increment stock", error: err.message });
  }
});

router.put("/shops/:shopname/dashboard/products/decrement-stock", async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.shop._id;
    const { productId, qty } = req.body;

    const product = await Product.findOne({ _id: productId, shop: shopId });
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.qty = Math.max(0, (product.qty || 0) - Number(qty || 0));
    await product.save();

    res.json({ message: "Stock decremented", product });
  } catch (err) {
    console.error("❌ decrement stock error:", err);
    res.status(500).json({ message: "Failed to decrement stock", error: err.message });
  }
});



// ----------------------------

// Reports
// ----------------------------

//1
// // GET /api/shops/:shopname/report/products/top-selling
// router.get(
//   "/shops/:shopname/report/products/top-selling",
//   authTenantOrMaster, // ✅ ensures req.tenantModels exists
//   async (req, res) => {
//     try {
//       const { SalesBill } = req.tenantModels; // now defined
//       const Shop = require("../models/Shop");

//       const { shopname } = req.params;
//       const shop = await Shop.findOne({ shopname });
//       if (!shop) return res.status(404).json({ message: "Shop not found" });
//       const shopId = shop._id;

//       const topProducts = await SalesBill.aggregate([
//         { $match: { shop: shopId } },
//         { $unwind: "$items" },
//         {
//           $group: {
//             _id: "$items.code",
//             code: { $first: "$items.code" },
//             name: { $first: "$items.name" },
//             totalQty: { $sum: "$items.qty" },
//             totalValue: { $sum: "$items.value" },
//           },
//         },
//         { $sort: { totalQty: -1 } },
//       ]);

//       res.json({ topProducts });
//     } catch (err) {
//       console.error("❌ getTopSellingProducts error:", err);
//       res
//         .status(500)
//         .json({ message: "Failed to fetch top selling products", error: err.message });
//     }
//   }
// );

router.get(
  "/reports/top-selling/all-shops",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { from, to, period, search, shopId } = req.query;

      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 50);
      const skip = (page - 1) * limit;

      const Shop = require("../models/Shop");
      const shops = await Shop.find({}, { shopname: 1 }).lean();

      const periodValue = typeof period === "string" ? period : undefined;

      const isAllMode =
        (periodValue && periodValue.toLowerCase() === "all") ||
        (!from && !to && !periodValue);

      let start = null;
      let end = null;

      if (!isAllMode) {
        if (from && to) {
          start = new Date(from);
          end = new Date(to);
        } else {
          const { getDateRange } = require("../utils/dateHelpers");
          ({ start, end } = getDateRange(periodValue || "today"));
        }

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      }

      const baseUri = process.env.TENANT_DB_URI;

      let filteredShops = shops;

      if (shopId) {
        filteredShops = shops.filter(
          (s) => String(s._id) === String(shopId)
        );
      }

      const result = await Promise.all(
        filteredShops.map(async (shop) => {
          const tenantConn = await getTenantDB(shop.shopname, baseUri);
          const { SalesBill } = require("../models/tenantModels")(tenantConn);

          const matchStage = {
            status: "active"
          };

          if (!isAllMode && start && end) {
            matchStage.date = { $gte: start, $lte: end };
          }

          const escapeRegex = (text) =>
            text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

          let searchMatch = [];

          if (search) {
            const safe = escapeRegex(search);

            searchMatch = [
              { "items.name": { $regex: safe, $options: "i" } },
              { "items.code": { $regex: safe, $options: "i" } }
            ];
          }

          const pipeline = [
            { $match: matchStage },
            { $unwind: "$items" },

            ...(search ? [{ $match: { $or: searchMatch } }] : []),

            {
              $group: {
                _id: "$items.code",
                code: { $first: "$items.code" },
                name: { $first: "$items.name" },
                totalQty: { $sum: "$items.qty" },
                totalValue: { $sum: "$items.value" }
              }
            },

            { $sort: { totalQty: -1 } },

            {
              $facet: {
                data: [
                  { $skip: skip },
                  { $limit: limit }
                ],
                totalCount: [
                  { $count: "count" }
                ]
              }
            }
          ];

          const agg = await SalesBill.aggregate(pipeline);

          const products = agg[0]?.data || [];
          const total = agg[0]?.totalCount?.[0]?.count || 0;

          return {
            shopId: shop._id,
            shopname: shop.shopname,
            products,
            total,
            page,
            totalPages: Math.ceil(total / limit)
          };
        })
      );

      res.json({ shops: result });

    } catch (err) {
      console.error("Top selling error:", err);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  }
);



// GET /api/shops/:shopname/report/products/top-selling
router.get(
  "/shops/:shopname/report/products/top-selling",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { SalesBill } = req.tenantModels;
      const { shopname } = req.params;
      const { from, to, period } = req.query;

      const shop = await Shop.findOne({ shopname });
      if (!shop) return res.status(404).json({ message: "Shop not found" });
      const shopId = shop._id;

      // Determine whether to apply date filtering
      // Cases that mean "ALL TIME": explicit period === 'All' OR no from && no to && no period
      const periodValue = typeof period === "string" ? period : undefined;
      const isAllMode =
        (periodValue && periodValue.toLowerCase() === "all") ||
        (!from && !to && !periodValue);

      let start = null;
      let end = null;

      if (!isAllMode) {
        if (from && to) {
          start = new Date(from);
          end = new Date(to);
        } else {
          // fallback to helper (day/week/month/year or today)
          ({ start, end } = getDateRange(periodValue || "today"));
        }

        // normalize inclusive times
        start = new Date(start);
        start.setHours(0, 0, 0, 0);
        end = new Date(end);
        end.setHours(23, 59, 59, 999);
      }

      // Build match stage
      const matchStage = { shop: shopId };
      if (!isAllMode && start && end) {
        matchStage.date = { $gte: start, $lte: end };
      }

      const topProducts = await SalesBill.aggregate([
        { $match: matchStage },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.code",
            code: { $first: "$items.code" },
            name: { $first: "$items.name" },
            totalQty: { $sum: "$items.qty" },
            totalValue: { $sum: "$items.value" },
          },
        },
        { $sort: { totalQty: -1 } },
      ]);

      // Return start/end only when date filtering applied, else null
      res.json({
        topProducts,
        start: isAllMode ? null : start,
        end: isAllMode ? null : end,
      });
    } catch (err) {
      console.error("❌ getTopSellingProducts error:", err);
      res
        .status(500)
        .json({ message: "Failed to fetch top selling products", error: err.message });
    }
  }
);


router.get(
  "/reports/low-stock/all-shops",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { from, to, period, search, shopId } = req.query;


      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 50);
      const skip = (page - 1) * limit;

      const Shop = require("../models/Shop");
      const shops = await Shop.find({}, { shopname: 1 }).lean();

      // ----------------------------
      // 🔎 Determine Mode
      // ----------------------------
      const periodValue = typeof period === "string" ? period : undefined;

      const isAllMode =
        (periodValue && periodValue.toLowerCase() === "all") ||
        (!from && !to && !periodValue);

      let start = null;
      let end = null;

      if (!isAllMode) {
        const { getDateRange } = require("../utils/dateHelpers");

        if (from && to) {
          start = new Date(from);
          end = new Date(to);
        } else {
          ({ start, end } = getDateRange(periodValue || "today"));
        }

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      }

      const baseUri = process.env.TENANT_DB_URI;

      let filteredShops = shops;


      if (shopId) {
        filteredShops = shops.filter(
          (s) => String(s._id) === String(shopId)
        );
      }

      // ----------------------------
      // 🚀 Parallel Shop Queries
      // ----------------------------
      const result = await Promise.all(
        filteredShops.map(async (shop) => {
          const tenantConn = await getTenantDB(shop.shopname, baseUri);
          const { Product } = require("../models/tenantModels")(tenantConn);

          // ✅ DEFINE FIRST
          const matchStage = {
            status: "active",
            $expr: { $lte: ["$totalQty", "$minQty"] }
          };

          // ✅ SAFE SEARCH
          const escapeRegex = (text) =>
            text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

          if (search) {
            const safe = escapeRegex(search);

            matchStage.$or = [
              { name: { $regex: safe, $options: "i" } },
              { code: { $regex: safe, $options: "i" } }
            ];
          }

          if (!isAllMode && start && end) {
            matchStage.updatedAt = { $gte: start, $lte: end };
          }

          // ✅ SINGLE QUERY BLOCK (NO DUPLICATE)
          const [products, total] = await Promise.all([
            Product.find(matchStage, {
              _id: 1,
              code: 1,
              name: 1,
              totalQty: 1,
              minQty: 1
            })
              .skip(skip)
              .limit(limit)
              .lean(),

            Product.countDocuments(matchStage)
          ]);

          return {
            shopId: shop._id,
            shopname: shop.shopname,
            products,
            total,
            page,
            totalPages: Math.ceil(total / limit)
          };
        })
      );

      // ----------------------------
      // 📦 Response
      // ----------------------------
      res.json({
        shops: result,
        start: isAllMode ? null : start,
        end: isAllMode ? null : end,
      });

    } catch (err) {
      console.error("Low stock all shops error:", err);
      res.status(500).json({
        message: "Failed to fetch report",
        error: err.message
      });
    }
  }
);







router.get(
  "/shops/:shopname/report/products/low-stock/recent",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { Product } = req.tenantModels;
      const { shopname } = req.params;
      const { from, to, period } = req.query;

      const Shop = require("../models/Shop");
      const shop = await Shop.findOne({ shopname });
      if (!shop) return res.status(404).json({ message: "Shop not found" });

      const shopId = shop._id;

      // Determine mode: All or Date Filter
      const periodValue = typeof period === "string" ? period : undefined;
      const isAllMode =
        (periodValue && periodValue.toLowerCase() === "all") ||
        (!from && !to && !periodValue);

      let start = null;
      let end = null;

      if (!isAllMode) {
        const { getDateRange } = require("../utils/dateHelpers");

        if (from && to) {
          start = new Date(from);
          end = new Date(to);
        } else {
          ({ start, end } = getDateRange(periodValue || "today"));
        }

        start = new Date(start);
        start.setHours(0, 0, 0, 0);
        end = new Date(end);
        end.setHours(23, 59, 59, 999);
      }

      // Build match stage
      const matchStage = { shop: shopId, status: "active", };
      if (!isAllMode && start && end) {
        matchStage.updatedAt = { $gte: start, $lte: end };
      }

      // --------- FETCH PRODUCTS ---------
      // const products = await Product.find(matchStage).lean();
      const products = await Product.find(
        matchStage,
        { code: 1, name: 1, totalQty: 1, minQty: 1 }
      ).lean();


      // --------- COMPUTE LOW STOCK ---------
      // const lowStock = products
      //   .map((p) => {
      //     const totalQty = (p.batches || [])
      //       .filter((b) => b.status === "active")
      //       .reduce(
      //         (sum, b) => sum + Number(b.qty || 0),
      //         0
      //       );

      //     // minQty priority: p.minQty → p.min_quantity → 0
      //     const rawMin = p.minQty ?? p.min_quantity ?? 0;
      //     const minQty = Number(String(rawMin).trim()) || 0;

      //     return {
      //       ...p,
      //       batches: activeBatches,
      //       totalQty,
      //       minQty,
      //     };
      //   })
      //   .filter((p) => p.totalQty <= p.minQty); // <= EXACT requirement you asked


      // 🔥 PRODUCT-WISE LOW STOCK (NO BATCH CALCULATION)
      const lowStock = products.filter((p) => {
        const totalQty = Number(p.totalQty || 0);
        const minQty = Number(p.minQty || 0);
        return totalQty <= minQty;
      });

      // --------- RESPONSE ---------
      res.json({
        products: lowStock,
        start: isAllMode ? null : start,
        end: isAllMode ? null : end,
      });
    } catch (err) {
      console.error("❌ low-stock error:", err);
      res.status(500).json({
        message: "Failed to fetch low-stock products",
        error: err.message,
      });
    }
  }
);




router.get(
  "/shops/:shopname/sales-bills/:id",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const { SalesBill } = req.tenantModels;
      const bill = await SalesBill.findById(req.params.id).lean();
      if (!bill) return res.status(404).json({ message: "Bill not found" });
      res.json(bill);
    } catch (err) {
      console.error("getBillDetails error:", err);
      res.status(500).json({ message: "Failed to fetch bill details" });
    }
  }
);


//   try {
//     const { Product } = req.tenantModels;
//     const shopId = req.shop._id;

//     // Fetch all products with their batches for this shop
//     const products = await Product.find({ shop: shopId }).sort({ updatedAt: -1 }).lean();

//     const agg = {};

//     products.forEach((p) => {
//       if (!agg[p.code]) {
//         agg[p.code] = {
//           code: p.code,
//           name: p.name,
//           totalQty: 0,
//           totalValue: 0,
//           batches: [],
//         };
//       }

//       // ✅ Loop through all batches in this product
//       (p.batches || []).forEach((b) => {
//         const rate = b.salePrice || 0;
//         const value = (b.qty || 0) * rate;

//         agg[p.code].batches.push({
//           batchNo: b.batchNo,
//           qty: b.qty || 0,
//           rate,
//           totalValue: value,
//         });

//         agg[p.code].totalQty += b.qty || 0;
//         agg[p.code].totalValue += value;
//       });
//     });

//     res.json({ products: Object.values(agg) });
//   } catch (err) {
//     console.error("❌ inventory error:", err);
//     res.status(500).json({ message: "Failed to fetch inventory", error: err.message });
//   }
// });




// Inventory route with date filtering support

// router.get("/reports/inventory/all-shops", authTenantOrMaster, async (req, res) => {
//   try {

//     const { from, to } = req.query;

//     const periodStart = from ? new Date(from) : null;
//     const periodEnd = to ? new Date(to) : null;

//     if (periodStart) periodStart.setHours(0, 0, 0, 0);
//     if (periodEnd) periodEnd.setHours(23, 59, 59, 999);

//     const Shop = require("../models/Shop");
//     const shops = await Shop.find({}, { shopname: 1 }).lean();

//     const baseUri = process.env.TENANT_DB_URI;

//     const result = await Promise.all(
//       shops.map(async (shop) => {

//         const tenantConn = await getTenantDB(shop.shopname, baseUri);
//         const { Product } = require("../models/tenantModels")(tenantConn);

//         const products = await Product.find({ status: "active" })
//           .select("code name totalQty stockHistory batches")
//           .lean();

//         const formatted = products
//           .map((p) => {

//             let closingStock = 0;

//             // ✅ CASE 1: No date filter → show current stock
//             if (!periodEnd) {
//               closingStock = Number(p.totalQty || 0);
//             }

//             // ✅ CASE 2: Date filter provided → use stockHistory
//             else {
//               const historyBeforeEnd = (p.stockHistory || [])
//                 .filter(h => new Date(h.date) <= periodEnd)
//                 .sort((a, b) => new Date(b.date) - new Date(a.date));

//               if (historyBeforeEnd.length === 0) {
//                 return null; // product didn't exist in that period
//               }

//               closingStock = Number(historyBeforeEnd[0].closingStock || 0);
//             }

//             if (closingStock <= 0) return null;

//             // 🔥 Calculate rate from active batches
//             let totalQty = 0;
//             let totalValue = 0;

//             (p.batches || [])
//               .filter(b => b.status === "active")
//               .forEach(b => {
//                 totalQty += Number(b.qty || 0);
//                 totalValue += Number(b.qty || 0) * Number(b.salePrice || 0);
//               });

//             const rate = totalQty > 0 ? totalValue / totalQty : 0;

//             return {
//               code: p.code,
//               name: p.name,
//               totalQty: closingStock,
//               rate,
//               totalValue: closingStock * rate
//             };
//           })
//           .filter(Boolean);



//         return {
//           shopname: shop.shopname,
//           products: formatted.sort((a, b) => b.totalValue - a.totalValue)
//         };
//       })
//     );

//     res.json({
//       shops: result,
//       start: periodStart,
//       end: periodEnd
//     });

//   } catch (err) {
//     console.error("Inventory error:", err);
//     res.status(500).json({ message: "Failed" });
//   }
// });




router.get("/reports/inventory/all-shops", authTenantOrMaster, async (req, res) => {
  try {

    // ✅ ADDED
    const { from, to, search, shopId } = req.query;

    // ✅ ADDED
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);
    const skip = (page - 1) * limit;

    const periodStart = from ? new Date(from) : null;
    const periodEnd = to ? new Date(to) : null;

    if (periodStart) periodStart.setHours(0, 0, 0, 0);
    if (periodEnd) periodEnd.setHours(23, 59, 59, 999);

    const Shop = require("../models/Shop");
    const shops = await Shop.find({}, { shopname: 1 }).lean();

    const baseUri = process.env.TENANT_DB_URI;

    // ✅ ADDED (shopId filter)
    let filteredShops = shops;
    if (shopId) {
      filteredShops = shops.filter(
        (s) => String(s._id) === String(shopId)
      );
    }

    const result = await Promise.all(
      filteredShops.map(async (shop) => {

        const tenantConn = await getTenantDB(shop.shopname, baseUri);
        const { Product } = require("../models/tenantModels")(tenantConn);

        // ✅ ADDED (search)
        const matchStage = { status: "active" };

        const escapeRegex = (text) =>
          text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        if (search) {
          const safe = escapeRegex(search);

          matchStage.$or = [
            { name: { $regex: safe, $options: "i" } },
            { code: { $regex: safe, $options: "i" } }
          ];
        }

        const products = await Product.find(matchStage)
          .select("code name totalQty stockHistory batches")
          .lean();

        const formatted = products
          .map((p) => {

            let closingStock = 0;

            if (!periodEnd) {
              closingStock = Number(p.totalQty || 0);
            } else {
              const historyBeforeEnd = (p.stockHistory || [])
                .filter(h => new Date(h.date) <= periodEnd)
                .sort((a, b) => new Date(b.date) - new Date(a.date));

              if (historyBeforeEnd.length === 0) {
                return null;
              }

              closingStock = Number(historyBeforeEnd[0].closingStock || 0);
            }

            if (closingStock <= 0) return null;

            let totalQty = 0;
            let totalValue = 0;

            (p.batches || [])
              .filter(b => b.status === "active")
              .forEach(b => {
                totalQty += Number(b.qty || 0);
                totalValue += Number(b.qty || 0) * Number(b.salePrice || 0);
              });

            const rate = totalQty > 0 ? totalValue / totalQty : 0;

            return {
              code: p.code,
              name: p.name,
              totalQty: closingStock,
              rate,
              totalValue: closingStock * rate
            };
          })
          .filter(Boolean);

        // ✅ ADDED (sort + pagination)
        const sorted = formatted.sort((a, b) => b.totalValue - a.totalValue);

        const paged = sorted.slice(skip, skip + limit);

        return {
          shopId: shop._id, // ✅ ADDED
          shopname: shop.shopname,
          products: paged, // ✅ PAGINATED
          total: sorted.length, // ✅ TOTAL COUNT
          page,
          totalPages: Math.ceil(sorted.length / limit)
        };
      })
    );

    res.json({
      shops: result,
      start: periodStart,
      end: periodEnd
    });

  } catch (err) {
    console.error("Inventory error:", err);
    res.status(500).json({ message: "Failed" });
  }
});





//REPORT PRINT AND PDF


router.get(
  "/shops/:shopname/report/products/top-selling/print",
  authTenantOrMaster,
  getTopSellingProductsPrint
);

router.get(
  "/shops/:shopname/report/products/top-selling/pdf",
  authTenantOrMaster,
  getTopSellingProductsPdf
);



router.get("/shops/:shopname/report/products/low-stock/recent/print", authTenantOrMaster, getLowStockProductsPrint);
router.get("/shops/:shopname/report/products/low-stock/recent/pdf", authTenantOrMaster, getLowStockProductsPdf);




router.get(
  "/shops/:shopname/report/products/inventory/print",
  authTenantOrMaster,
  getInventoryProductsPrint
);

router.get(
  "/shops/:shopname/report/products/inventory/pdf",
  authTenantOrMaster,
  getInventoryProductsPdf
);



module.exports = router;
