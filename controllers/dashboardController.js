


// controllers/dashboardController.js

const mongoose = require("mongoose");

const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const puppeteer = require("puppeteer");


const { print } = require("pdf-to-printer");

const Shop = require("../models/Shop");


// ----------------------------
// Helpers
// ----------------------------
const getDateRange = (period) => {
  const now = new Date();
  let start, end;

  switch (period) {
    // ✅ TODAY (00:00 → now)
    case "today":
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      break;

    // ✅ CURRENT WEEK (Sunday → now)
    case "weekly":
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      break;

    // ✅ CURRENT MONTH (1st → now)
    case "monthly":
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now);
      break;

    // ✅ CURRENT YEAR (Jan 1 → now)
    case "yearly":
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(now);
      break;

    default:
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
  }

  return { start, end };
};


const getShopId = (req) => {
  return req.shop?._id || req.user?.shopId;
};



// ----------------------------
// Sales Summary
// GET /dashboard/sales-bills/summary?period=today
// ----------------------------
exports.getSalesSummary = async (req, res) => {
  try {
    const shopId = getShopId(req);
    if (!shopId) {
      return res.status(400).json({ message: "Shop context missing" });
    }

    const { from, to, period } = req.query;
    let start, end;

    if (from && to) {
      start = new Date(from);
      end = new Date(to);
    } else {
      ({ start, end } = getDateRange(period || "today"));
    }

    const { SalesBill } = req.tenantModels;

    // 1️⃣ Fetch all bills in the period
    const bills = await SalesBill.find({
      shop: shopId,
      date: { $gte: start, $lte: end },
    })
      .sort({ date: -1 })
      .select("billNo date netAmount customerName mobile meta items")
      .lean();

    // 2️⃣ Normalize and ensure customer name & netAmount are consistent
    const formattedBills = bills.map((b) => ({
      _id: b._id,
      billNo: b.billNo,
      date: b.date,
      netAmount: b.netAmount || b.totals?.netAmount || 0,
      customerName: b.customerName || b.meta?.customerName || "-",
      mobile: b.mobile || b.meta?.mobile || "-",
      items: b.items?.map((it) => ({
        code: it.code,
        name: it.name,
        batch: it.batch,
        rate: it.rate,
        qty: it.qty,
        value: it.value,
      })) || [],
    }));

    // 3️⃣ Sum total netAmount
    const totalNetAmount = formattedBills.reduce(
      (sum, b) => sum + (b.netAmount || 0),
      0
    );

    // ✅ Response
    res.json({
      shop: shopId,
      totalBills: formattedBills.length,
      totalNetAmount,
      bills: formattedBills, // enriched bill info
    });
  } catch (err) {
    console.error("❌ getSalesSummary error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch sales summary", error: err.message });
  }
};

// ----------------------------
// Fetch recent sales bills (last 5)
// GET /dashboard/sales-bills/recent
// ----------------------------
exports.getRecentSalesBills = async (req, res) => {
  try {
    const shopId = getShopId(req);
    if (!shopId) return res.status(400).json({ message: "Shop context missing" });

    const { SalesBill } = req.tenantModels;
    const bills = await SalesBill.find({ shop: shopId })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({ bills });
  } catch (err) {
    console.error("❌ getRecentSalesBills error:", err);
    res.status(500).json({ message: "Failed to fetch recent sales bills", error: err.message });
  }
};

// ----------------------------
// Fetch all sales bills (with filters)
// GET /dashboard/sales-bills
// ----------------------------
exports.getSalesBills = async (req, res) => {
  try {
    const shopId = getShopId(req);
    if (!shopId) return res.status(400).json({ message: "Shop context missing" });

    const {
      page = 1,
      limit = 10,
      search = "",
      filter = "",
      fromDate,
      toDate,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const { SalesBill } = req.tenantModels;

    const query = { shop: shopId };

    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { billNo: regex },
        { customerName: regex },
        { mobile: regex },
      ];
    }

    const now = new Date();
    if (filter) {
      switch (filter) {
        case "today":
          query.date = { $gte: new Date(now.setHours(0, 0, 0, 0)), $lte: new Date(now.setHours(23, 59, 59, 999)) };
          break;
        case "this-week": {
          const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
          firstDay.setHours(0, 0, 0, 0);
          const lastDay = new Date(firstDay);
          lastDay.setDate(firstDay.getDate() + 6);
          lastDay.setHours(23, 59, 59, 999);
          query.date = { $gte: firstDay, $lte: lastDay };
          break;
        }
        case "this-month": {
          const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastDayMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          query.date = { $gte: firstDayMonth, $lte: lastDayMonth };
          break;
        }
        case "custom":
          if (fromDate && toDate) {
            query.date = { $gte: new Date(fromDate), $lte: new Date(toDate + "T23:59:59.999Z") };
          }
          break;
      }
    }

    const totalBills = await SalesBill.countDocuments(query);
    const bills = await SalesBill.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));

    res.json({
      bills,
      totalPages: Math.ceil(totalBills / Number(limit)),
      totalBills,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    console.error("❌ getSalesBills error:", err);
    res.status(500).json({ message: "Server Error while fetching sales bills", error: err.message });
  }
};

// ----------------------------
// Fetch products
// GET /dashboard/product-total
// ----------------------------

exports.getProducts = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = getShopId(req);

    if (!shopId) {
      return res.status(400).json({ message: "Shop context missing" });
    }

    const search = req.query.search?.trim() || "";

    const query = { shop: shopId };

    // 🔎 Search filter
    if (search) {
      const regex = new RegExp(search, "i");

      query.$or = [
        { code: regex },
        { name: regex },
        { shortName: regex },
        { category: regex }
      ];

      if (!isNaN(search)) {
        query.$or.push({ minQty: Number(search) });
      }
    }

    // 1️⃣ Get ALL products
    const products = await Product.find(query)
      .sort({ createdAt: -1 });

    // 2️⃣ Total Products Count
    const totalProducts = await Product.countDocuments(query);

    // 3️⃣ Stock + Low Stock Aggregation
    const stats = await Product.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalStock: { $sum: "$totalQty" },

          lowStockCount: {
            $sum: {
              $cond: [
                { $lte: ["$totalQty", "$minQty"] }, // LOW STOCK CONDITION
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const totalStock = stats[0]?.totalStock || 0;
    const lowStockCount = stats[0]?.lowStockCount || 0;

    res.json({
      products,
      totalProducts,
      totalStock,
      lowStockCount
    });

  } catch (err) {
    console.error("❌ getProducts error:", err);

    res.status(500).json({
      message: "Failed to fetch products",
      error: err.message
    });
  }
};

// ----------------------------
// Low stock
// GET /dashboard/products/low-stock
// ----------------------------
exports.getLowStockCount = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = getShopId(req);
    if (!shopId) return res.status(400).json({ message: "Shop context missing" });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const countOnly = req.query.count === "true";

    const filter = { shop: shopId, $expr: { $lte: ["$qty", "$minQty"] } };

    if (countOnly) {
      const lowStockCount = await Product.countDocuments(filter);
      return res.json({ lowStockCount });
    }

    const products = await Product.find(filter)
      .sort({ qty: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Product.countDocuments(filter);
    res.json({ products, page, limit, total });
  } catch (err) {
    console.error("❌ getLowStockCount error:", err);
    res.status(500).json({ message: "Failed to fetch low stock", error: err.message });
  }
};

// ----------------------------
// Recent low-stock products
// GET /dashboard/products/low-stock/recent
// ----------------------------
exports.getRecentLowStockProducts = async (req, res) => {
  try {
    const shopId = getShopId(req);
    if (!shopId) return res.status(400).json({ message: "Shop context missing" });

    const { Product } = req.tenantModels;
    const products = await Product.find({
      shop: shopId,
      $expr: { $lte: ["$qty", "$minQty"] },
    })
      .sort({ updatedAt: -1 })
      .limit(5);

    res.json({ products });
  } catch (err) {
    console.error("❌ getRecentLowStockProducts error:", err);
    res.status(500).json({ message: "Failed to fetch recent low stock products", error: err.message });
  }
};

// ----------------------------
// Top selling products
// GET /dashboard/products/top-selling
// ----------------------------
exports.getTopSellingProducts = async (req, res) => {
  try {
    const shopId = getShopId(req); // make sure this fetches shop _id
    if (!shopId) return res.status(400).json({ message: "Shop context missing" });

    const { SalesBill } = req.tenantModels;


    // ✅ Get current year date range
    const startOfYear = new Date(new Date().getFullYear(), 0, 1); // Jan 1
    const startOfNextYear = new Date(new Date().getFullYear() + 1, 0, 1); // Jan 1 next yev

    const topProducts = await SalesBill.aggregate([
      // { $match: { shop: shopId } }, // filter by shop


      {
        $match: {
          shop: shopId,
          createdAt: {
            $gte: startOfYear,
            $lt: startOfNextYear,
          },
        },
      },
      { $unwind: "$items" },        // flatten items array
      {
        $group: {
          _id: "$items.code",       // group by product code
          name: { $first: "$items.name" },
          totalQty: { $sum: "$items.qty" },
          totalValue: { $sum: "$items.value" } // sum the 'value' field
        }
      },
      { $sort: { totalQty: -1 } },  // highest qty first
      { $limit: 5 }                 // top 5 products
    ]);

    res.json({ topProducts });

  } catch (err) {
    console.error("❌ getTopSellingProducts error:", err);
    res.status(500).json({ message: "Failed to fetch top selling products", error: err.message });
  }
};


// ----------------------------
// Stock Management
// ----------------------------
// PUT /dashboard/products/increment-stock
exports.incrementStock = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = getShopId(req);
    const { code, batchNo, qty } = req.body;
    if (!code || !batchNo || !qty) return res.status(400).json({ message: "code, batchNo, qty required" });

    const product = await Product.findOne({ shop: shopId, code, batchNo });
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.qty += Number(qty);
    await product.save();
    res.json({ message: `Stock incremented by ${qty}`, product });
  } catch (err) {
    console.error("❌ incrementStock error:", err);
    res.status(500).json({ message: "Failed to increment stock", error: err.message });
  }
};

// PUT /dashboard/products/decrement-stock
exports.decrementStock = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = getShopId(req);
    const { code, batchNo, qty } = req.body;
    if (!code || !batchNo || !qty) return res.status(400).json({ message: "code, batchNo, qty required" });

    const product = await Product.findOne({ shop: shopId, code, batchNo });
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.qty -= Number(qty);
    if (product.qty < 0) product.qty = 0;
    await product.save();
    res.json({ message: `Stock decremented by ${qty}`, product });
  } catch (err) {
    console.error("❌ decrementStock error:", err);
    res.status(500).json({ message: "Failed to decrement stock", error: err.message });
  }
};


exports.respectiveShopSales = async (req, res) => {
  try {
    const shopName = req.params.shopname;
    if (!shopName) return res.status(400).json({ message: "Shopname missing in params" });

    const shopId = req.shop?._id || req.user?.shopId;
    if (!shopId) return res.status(400).json({ message: "Shop context missing" });

    const { from, to } = req.query;
    let start = from ? new Date(from) : new Date("1970-01-01");
    let end = to ? new Date(to) : new Date();

    const { SalesBill } = req.tenantModels;

    const bills = await SalesBill.find({
      shop: shopId,
      date: { $gte: start, $lte: end },
    })
      .sort({ date: -1 })
      .select("billNo date netAmount customerName mobile items")
      .lean();

    const formattedBills = bills.map(b => ({
      _id: b._id,
      billNo: b.billNo,
      date: b.date,
      netAmount: b.netAmount || b.total?.netAmount || 0,
      customerName: b.customerName || "-",
      mobile: b.mobile || "-",
      items: b.items?.map(it => ({
        code: it.code,
        name: it.name,
        batch: it.batch,
        rate: it.rate,
        qty: it.qty,
        value: it.value
      })) || []
    }));

    const totalNetAmount = formattedBills.reduce((sum, b) => sum + (b.netAmount || 0), 0);

    res.json({
      shop: shopId,
      totalBills: formattedBills.length,
      totalNetAmount,
      bills: formattedBills
    });

  } catch (err) {
    console.error("❌ respectiveshopsales error:", err);
    res.status(500).json({ message: "Failed to fetch respective shop sales", error: err.message });
  }
};



exports.getMasterSalesSummary = async (req, res) => {
  try {
    const Shop = require("../models/Shop");
    const shops = await Shop.find({}, { shopname: 1 }).lean();

    const result = [];

    for (const shop of shops) {
      const tenantConn = await getTenantDB(shop.shopname);
      const { SalesBill } = require("../models/tenantModels")(tenantConn);

      const summary = await SalesBill.aggregate([
        {
          $group: {
            _id: null,
            totalNetAmount: { $sum: "$netAmount" },
          },
        },
      ]);

      result.push({
        shopname: shop.shopname,
        totalNetAmount: summary[0]?.totalNetAmount || 0,
      });
    }

    res.json({ shops: result });
  } catch (err) {
    res.status(500).json({ message: "Failed" });
  }
};







const {
  buildTopSellingProductsHtml,
} = require("../utils/PrintAndPDF/buildTopSellingProductsHtml");

const PRINTER = process.env.PRINTER;

/* =========================================================
   SHARED DATA FUNCTION (SINGLE SOURCE OF TRUTH)
   ========================================================= */
const getTopSellingData = async (req) => {
  const { SalesBill, Product } = req.tenantModels;
  const { shopname } = req.params;
  const { from, to } = req.query;

  const shop = await Shop.findOne({ shopname });
  if (!shop) throw new Error("Shop not found");

  let startDate = null;
  let endDate = null;

  let match = { shop: shop._id };

  /* ===============================
     CASE 1: DATE FILTER
  =============================== */
  if (from && to) {
    startDate = new Date(from);
    endDate = new Date(to);

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    match.date = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  /* ===============================
     CASE 2: ALL PERIOD
  =============================== */
  else {
    const dateRange = await SalesBill.aggregate([
      { $match: { shop: shop._id } },
      {
        $group: {
          _id: null,
          firstDate: { $min: "$date" },
          lastDate: { $max: "$date" },
        },
      },
    ]);

    if (dateRange.length) {
      startDate = dateRange[0].firstDate;
      endDate = dateRange[0].lastDate;
    }
  }

  /* ===============================
     AGGREGATION WITH ACTIVE PRODUCT FILTER
  =============================== */

  const data = await SalesBill.aggregate([
    { $match: match },

    { $unwind: "$items" },

    // 🔥 Join Product collection
    {
      $lookup: {
        from: "products",   // collection name (check lowercase!)
        localField: "items.code",
        foreignField: "code",
        as: "product",
      },
    },

    { $unwind: "$product" },

    // 🔥 Only active products
    {
      $match: {
        "product.status": "active",
      },
    },

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

  /* ===============================
     PERIOD LABEL
  =============================== */

  const formatDate = (d) =>
    `${String(d.getDate()).padStart(2, "0")}-${String(
      d.getMonth() + 1
    ).padStart(2, "0")}-${d.getFullYear()}`;

  let periodLabel = "No Sales Found";

  if (startDate && endDate) {
    const sameDay =
      startDate.toDateString() === endDate.toDateString();

    periodLabel = sameDay
      ? formatDate(startDate)
      : `${formatDate(startDate)} to ${formatDate(endDate)}`;
  }

  return {
    rows: data,
    periodLabel,
  };
};



/* =========================================================
   PRINT
   ========================================================= */
exports.getTopSellingProductsPrint = async (req, res) => {
  try {
     const { rows, periodLabel } = await getTopSellingData(req);

  
    const html = buildTopSellingProductsHtml({
      shopname: req.params.shopname,
      periodLabel,
      rows,       
    });
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    const file = path.join(os.tmpdir(), `top-selling-${Date.now()}.pdf`);
    await fs.writeFile(file, pdf);
    await print(file, { printer: PRINTER });
    await fs.remove(file);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ TOP SELLING PRINT ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* =========================================================
   PDF DOWNLOAD
   ========================================================= */
exports.getTopSellingProductsPdf = async (req, res) => {
  try {
       const { rows, periodLabel } = await getTopSellingData(req);

   
    const html = buildTopSellingProductsHtml({
      shopname: req.params.shopname,
      periodLabel,
      rows,       
    });

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Top_Selling_${req.params.shopname}.pdf`
    );

    res.end(pdf);
  } catch (err) {
    console.error("❌ TOP SELLING PDF ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};









const {
  buildLowStockProductsHtml,
} = require("../utils/PrintAndPDF/buildLowStockProductsHtml");



/* =========================================================
   SHARED DATA FUNCTION
========================================================= */
const getLowStockData = async (req) => {
  const { Product } = req.tenantModels;
  const { shopname } = req.params;
  const { from, to } = req.query;

  const shop = await Shop.findOne({ shopname });
  if (!shop) throw new Error("Shop not found");

  let startDate = null;
  let endDate = null;

const match = {
  shop: shop._id,
  status: { $regex: /^active$/i }, // case insensitive
};


  /* ===============================
     CASE 1: DATE FILTER PROVIDED
  =============================== */
  if (from && to) {
    startDate = new Date(from);
    endDate = new Date(to);

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    match.updatedAt = { $gte: startDate, $lte: endDate };
  }

  const products = await Product.find(match).lean();

  /* ===============================
     DEFAULT MODE (ALL PERIOD)
     Get first & last product date
  =============================== */
  if (!from && !to && products.length) {
    const allDates = products.map((p) => new Date(p.createdAt));
    startDate = new Date(Math.min(...allDates));
    endDate = new Date(Math.max(...allDates));
  }

  /* ===============================
     FORMAT PRODUCTS
  =============================== */
  const rows = products
    .map((p) => {
      const totalQty = (p.batches || [])
        .filter((b) => b.status === "active")
      .reduce(
        (s, b) => s + Number(b.qty || 0),
        0
      );

      const minQty =
        Number(String(p.minQty ?? p.min_quantity ?? 0).trim()) || 0;

      return {
        code: p.code,
        name: p.name,
        totalQty,
        minQty,
      };
    })
    .filter((p) => p.totalQty <= p.minQty)
    .sort((a, b) => a.totalQty - b.totalQty);

  /* ===============================
     PERIOD LABEL FORMAT
  =============================== */
  const formatDate = (d) =>
    `${String(d.getDate()).padStart(2, "0")}-${String(
      d.getMonth() + 1
    ).padStart(2, "0")}-${d.getFullYear()}`;

  let periodLabel = "No Data Found";

  if (startDate && endDate) {
    const sameDay =
      startDate.toDateString() === endDate.toDateString();

    periodLabel = sameDay
      ? formatDate(startDate)
      : `${formatDate(startDate)} to ${formatDate(endDate)}`;
  }

  return {
    rows,
    periodLabel,
  };
};


/* ---------- PRINT ---------- */
exports.getLowStockProductsPrint = async (req, res) => {
  try {
     const { rows, periodLabel } = await getLowStockData(req);

     const html = buildLowStockProductsHtml({
      shopname: req.params.shopname,
      periodLabel,
      rows,
    });

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdf = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    const file = path.join(os.tmpdir(), `low-stock-${Date.now()}.pdf`);
    await fs.writeFile(file, pdf);
    await print(file, { printer: PRINTER });
    await fs.remove(file);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ LOW STOCK PRINT ERROR:", err);
    res.status(500).json({ success: false });
  }
};

/* ---------- PDF ---------- */
exports.getLowStockProductsPdf = async (req, res) => {
  try {
    const { rows, periodLabel } = await getLowStockData(req);

 
    const html = buildLowStockProductsHtml({
      shopname: req.params.shopname,
      periodLabel,
      rows,
    });

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdf = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Low_Stock_${req.params.shopname}.pdf`
    );
    res.end(pdf);
  } catch (err) {
    console.error("❌ LOW STOCK PDF ERROR:", err);
    res.status(500).json({ success: false });
  }
};






const {
  buildInventoryProductsHtml,
} = require("../utils/PrintAndPDF/buildInventoryProductsHtml");



const getInventoryData = async (req) => {
  const { Product } = req.tenantModels;
  const { shopname } = req.params;
  const { from, to } = req.query;

  const shop = await Shop.findOne({ shopname });
  if (!shop) throw new Error("Shop not found");

  const shopId = shop._id;

  let periodStart = from ? new Date(from) : null;
  let periodEnd = to ? new Date(to) : null;

  if (periodStart) periodStart.setHours(0, 0, 0, 0);
  if (periodEnd) periodEnd.setHours(23, 59, 59, 999);

  const products = await Product.find({
    shop: shopId,
    status: "active",
  })
    .select("code name totalQty stockHistory batches")
    .lean();

  const rows = products
    .map((p) => {
      let closingStock = 0;

      // ✅ CASE 1: No date filter → current stock
      if (!periodEnd) {
        closingStock = Number(p.totalQty || 0);
      }

      // ✅ CASE 2: Date filter → stock as of that date
      else {
        const historyBeforeEnd = (p.stockHistory || [])
          .filter((h) => new Date(h.date) <= periodEnd)
          .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (historyBeforeEnd.length === 0) return null;

        closingStock = Number(historyBeforeEnd[0].closingStock || 0);
      }

      if (closingStock <= 0) return null;

      // 🔥 Calculate weighted average rate from active batches
      let totalQty = 0;
      let totalValue = 0;

      (p.batches || [])
        .filter((b) => b.status === "active")
        .forEach((b) => {
          const qty = Number(b.qty || 0);
          const price = Number(b.salePrice || 0);
          totalQty += qty;
          totalValue += qty * price;
        });

      const rate = totalQty > 0 ? totalValue / totalQty : 0;

      return {
        code: p.code,
        name: p.name,
        qty: closingStock,
        rate,
        totalValue: closingStock * rate,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.totalValue - a.totalValue);


  let periodLabel = "All Period";

  if (!periodStart && !periodEnd) {
    // 🔥 No filter → find min & max date from stockHistory

    let allDates = [];

    products.forEach((p) => {
      (p.stockHistory || []).forEach((h) => {
        if (h.date) {
          allDates.push(new Date(h.date));
        }
      });
    });

    if (allDates.length > 0) {
      const minDate = new Date(Math.min(...allDates));
      const maxDate = new Date(Math.max(...allDates));

      const formatDate = (d) =>
        `${String(d.getDate()).padStart(2, "0")}-${String(
          d.getMonth() + 1
        ).padStart(2, "0")}-${d.getFullYear()}`;

      periodLabel = `${formatDate(minDate)} to ${formatDate(maxDate)}`;
    }
  }
  else if (periodStart && periodEnd) {

    const sameDay =
      periodStart.toDateString() === periodEnd.toDateString();

    const formatDate = (d) =>
      `${String(d.getDate()).padStart(2, "0")}-${String(
        d.getMonth() + 1
      ).padStart(2, "0")}-${d.getFullYear()}`;

    if (sameDay) {
      periodLabel = formatDate(periodStart);
    } else {
      periodLabel = `${formatDate(periodStart)} to ${formatDate(periodEnd)}`;
    }
  }


  return {
    rows,
    periodLabel,
  };
};



/* =========================================================
   PRINT INVENTORY
   ========================================================= */
exports.getInventoryProductsPrint = async (req, res) => {
  try {
    const { rows, periodLabel } = await getInventoryData(req);

    const html = buildInventoryProductsHtml({
      shopname: req.params.shopname,
      periodLabel,
      rows,
    });

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    const file = path.join(os.tmpdir(), `inventory-${Date.now()}.pdf`);
    await fs.writeFile(file, pdf);

    await print(file, { printer: PRINTER });
    await fs.remove(file);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ INVENTORY PRINT ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* =========================================================
   PDF INVENTORY
   ========================================================= */
exports.getInventoryProductsPdf = async (req, res) => {
  try {
    const { rows, periodLabel } = await getInventoryData(req);

    const html = buildInventoryProductsHtml({
      shopname: req.params.shopname,
      periodLabel,
      rows,
    });

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Inventory_${req.params.shopname}.pdf`
    );

    res.end(pdf);
  } catch (err) {
    console.error("❌ INVENTORY PDF ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};