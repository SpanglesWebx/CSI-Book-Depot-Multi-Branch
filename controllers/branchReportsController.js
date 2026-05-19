// controllers/branchReportsController.js
const mongoose = require("mongoose");

// GET /api/branch-reports/salesbills
exports.getBranchSalesBills = async (req, res) => {
  try {
    if (!req.shop || !req.shop._id) {
      return res.status(400).json({ message: "Shop context missing" });
    }

    const {
      page = 1,
      limit = 10,
      search = "",
      counter,
      from,
      to,
      export: isExport,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const { SalesBill } = req.tenantModels;

    /* ==========================================================
       BUILD QUERY
       ========================================================== */
    const query = { shop: req.shop._id };

    /* -------------------- SEARCH -------------------- */
    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");

      query.$or = [
        { billNo: regex },
        { customerName: regex },
        { mobile: regex },
        { counter: !isNaN(search) ? Number(search) : undefined },
      ].filter(Boolean);
    }

    /* ---------------- Counter Filter ---------------- */
    if (counter && counter !== "") {
      query.counter = Number(counter);
    }

    /* ---------------- DATE RANGE FILTER (from & to) ---------------- */
    if (from && to) {
      const start = new Date(from);
      const end = new Date(to);

      // normalize start-end
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      query.date = {
        $gte: start,
        $lte: end,
      };
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



    /* ==========================================================
       FETCH DATA
       ========================================================== */
    const totalBills = await SalesBill.countDocuments(query);

    const bills = await SalesBill.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      bills,
      totalBills,
      totalPages: Math.ceil(totalBills / Number(limit)),
      page: Number(page),
      limit: Number(limit),
    });






  } catch (err) {
    console.error("❌ branchReports.getSalesBills error:", err);
    res.status(500).json({
      message: "Server Error fetching branch sales bills",
      error: err.message,
    });
  }
};









// ---------------------------------------------
// ITEMWISE BILL REPORT — PRODUCT WISE 
// ---------------------------------------------
exports.getItemwiseBillReport = async (req, res) => {
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
        return res
          .status(404)
          .json({ message: `Shop '${shopname}' not found` });

      SalesBill = tenantDb.model("SalesBill");
    } else {
      return res.status(500).json({ message: "Tenant DB manager not initialized" });
    }

    if (!SalesBill)
      return res.status(400).json({ message: "SalesBill model not found" });

    // ---- Query params ----
    const search = req.query.search?.trim();
    const counter = req.query.counter?.trim();
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

    // ⭐ FETCH ALL BILLS — NO PAGINATION
    const bills = await SalesBill.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // ⭐ MERGE ITEMS PRODUCT-WISE + CALCULATE GST
    bills.forEach((bill) => {
      const map = new Map();

      (bill.items || []).forEach((it) => {
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

        const ref = map.get(it.code);

        ref.qty += Number(it.qty || 0);
        ref.value += Number(it.value || 0);

        // ⭐ Calculate GST amount dynamically
        let gstAmt = 0;

        if (it.isInclusive) {
          // inclusive calculation
          gstAmt = it.value - (it.value / (1 + it.gst / 100));
        } else {
          // exclusive calculation
          gstAmt = (it.taxable * it.gst) / 100;
        }

        ref.gstAmount += gstAmt;
      });

      bill.items = Array.from(map.values());
    });

    res.json({
      bills,
      total: bills.length
    });

  } catch (err) {
    console.error("❌ getItemwiseBillReport error:", err);
    res.status(500).json({
      message: "Failed to fetch bill-wise report",
      error: err.message
    });
  }
};




// ---------------------------------------------
// ITEMWISE SALES REPOR
// ---------------------------------------------

exports.getItemwiseSalesReport = async (req, res) => {
  try {
    let SalesBill, Product;
    let shopId;

    // ---------------- Tenant / Master ----------------
    if (req.tenantModels) {
      SalesBill = req.tenantModels.SalesBill;
      Product = req.tenantModels.Product;
      shopId = req.shop?._id || null;
    } else if (req.dbManager?.getTenantDb) {
      const tenantDb = req.dbManager.getTenantDb(req.params.shopname);
      SalesBill = tenantDb.model("SalesBill");
      Product = tenantDb.model("Product");
    } else {
      return res.status(500).json({ message: "Tenant DB not initialized" });
    }



    // ---------------- Date Filter ----------------
    const match = {};
    if (shopId) match.shop = shopId;

    let fromDate, toDate;

    if (req.query.from && req.query.to) {
      // User-selected range
      fromDate = new Date(req.query.from);
      toDate = new Date(req.query.to);
      match.date = { $gte: fromDate, $lte: toDate };
    } else {
      // ✅ DEFAULT: FULL HISTORY
      fromDate = new Date("1970-01-01T00:00:00.000Z");
      toDate = new Date(); // now
    }


    // ---------------- Billing Aggregation ----------------
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



    const calculateSoldQty = (product, fromDate, toDate) => {
      let soldQty = 0;
      let returnQty = 0;
      let editAdjustment = 0;

      // 1️⃣ NORMAL SALES (productSales)
      if (Array.isArray(product.productSales)) {
        soldQty += product.productSales
          .filter(ps => {
            const d = new Date(ps.date);
            return d >= fromDate && d <= toDate;
          })
          .reduce((sum, ps) => sum + Number(ps.qty || 0), 0);
      }

      // 2️⃣ RETURNS + EDITS (stockHistory)
      if (Array.isArray(product.stockHistory)) {
        product.stockHistory.forEach(h => {
          const d = new Date(h.date);
          if (d < fromDate || d > toDate) return;

          // RETURN → reduce sold qty
          if (h.reason === "return" && Number(h.change) > 0) {
            returnQty += Number(h.change);
          }

          // EDIT-QTY → manual correction
          if (h.reason === "edit-qty") {
            editAdjustment += Number(h.change);
          }
        });
      }

      // 3️⃣ FINAL NET SOLD QTY
      return Math.max(0, soldQty - returnQty + editAdjustment);
    };


    // ---------------- Stock Logic (SOURCE OF TRUTH) ----------------


    for (const it of rows) {
      const product = await Product.findOne(
        { code: it.code },
        { productSales: 1, stockHistory: 1 }
      ).lean();




      const history = product.stockHistory
        .map(h => ({
          date: new Date(h.date),
          opening: Number(h.openingStock || 0),
          closing: Number(h.closingStock || 0),
          change: Number(h.change || 0),
          reason: h.reason
        }))
        .sort((a, b) => a.date - b.date);


      it.qty = calculateSoldQty(product, fromDate, toDate);


      // ---------- QTY (ACTUAL STOCK SOLD) ----------
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

      // ---------- OPENING STOCK ----------
      // const beforePeriod = history.filter(h => h.date < fromDate);
      // it.openingStock = beforePeriod.at(-1)?.closing ?? 0;

      // ---------- OPENING STOCK (FIXED) ----------
      if (soldMovements.length > 0) {
        // ✅ Opening stock = openingStock of FIRST sale in period
        it.openingStock = soldMovements[0].opening;
      } else {
        // No sales in period → fallback to last known stock before range
        const beforePeriod = history.filter(h => h.date < fromDate);
        it.openingStock = beforePeriod.at(-1)?.closing ?? 0;
      }

      // ---------- CLOSING STOCK ----------
      const uptoPeriod = history.filter(h => h.date <= toDate);
      it.closingStock = uptoPeriod.at(-1)?.closing ?? 0;

      it.netSale = it.totalSales + it.totalGst;
    }

    // ---------------- Summary ----------------
    const summary = {
      totalItemsSold: rows.reduce((s, r) => s + r.qty, 0),
      totalSales: rows.reduce((s, r) => s + r.totalSales, 0),
      totalGst: rows.reduce((s, r) => s + r.totalGst, 0),
      totalNetSale: rows.reduce(
        (s, r) => s + r.totalSales + r.totalGst,
        0
      )
    };

    // ---------------- First / Last Bill Date ----------------
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
    res.status(500).json({ message: err.message });
  }
};




// ----------------------------------------------------------
// COLLECTION REPORTS CONTROLLER
// ----------------------------------------------------------

exports.getDateWiseReport = async (req, res) => {
  try {
    const { SalesBill } = req.tenantModels;
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

    // ---- AGGREGATION ----
    const data = await SalesBill.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            day: { $dayOfMonth: "$date" },
          },
          billNos: { $addToSet: "$billNo" },
          qty: { $sum: "$items.qty" },
          totalSales: { $sum: "$netAmount" },
        },
      },
      {
        $addFields: {
          billCount: { $size: "$billNos" },
          date: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: "$_id.day",
            },
          },
        },
      },
      { $sort: { date: 1 } },
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
        summary,
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
        totalRecords,
      },
    });

  } catch (err) {
    console.error("❌ getDateWiseReport error:", err);
    res.status(500).json({
      message: "Failed to load date-wise report",
      error: err.message,
    });
  }
};






exports.getCollectionsCounterReport = async (req, res) => {
  try {
    const { SalesBill } = req.tenantModels;


    const isExport = req.query.export === "1";

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const counter = req.query.counter?.trim();
    const method = req.query.method; // all, cash, upi, card
    const from = req.query.from;
    const to = req.query.to;

    const match = {};

    // Counter filter
    if (counter) match.counter = Number(counter);

    // Date filter
    if (from && to) {
      match.date = {
        $gte: new Date(from),
        $lte: new Date(to)
      };
    }

    // Payment filter
    if (method && method !== "all") {
      match.paymentMethod = method.toUpperCase();
    }

    // ------------------------------
    // AGGREGATE COUNTER-WISE
    // ------------------------------
    const data = await SalesBill.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$counter",
          totalBills: { $sum: 1 },
          totalQty: { $sum: { $sum: "$items.qty" } },
          // paymentCash: {
          //   $sum: {
          //     $cond: [{ $eq: ["$paymentMethod", "CASH"] }, "$netAmount", 0]
          //   }
          // },
          // paymentUpi: {
          //   $sum: {
          //     $cond: [{ $eq: ["$paymentMethod", "UPI"] }, "$netAmount", 0]
          //   }
          // },

          paymentCash: { $sum: "$payment.cash" },
          paymentUpi: { $sum: "$payment.upi" },
          paymentCard: { $sum: "$payment.card" },   // if exists


          total: { $sum: "$netAmount" }
        }
      },
      { $sort: { _id: 1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    const countAgg = await SalesBill.aggregate([
      { $match: match },
      { $group: { _id: "$counter" } },
      { $count: "count" }
    ]);



    const total = countAgg[0]?.count || 0;

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
      rows: data.map(d => ({
        counter: d._id,
        totalBills: d.totalBills,
        totalQty: d.totalQty,
        paymentCash: d.paymentCash,
        paymentUpi: d.paymentUpi,
        total: d.total
      })),
      total,
      // totalPages: Math.ceil(total / limit),
      totalPages: isExport ? 1 : Math.ceil(total / limit),
      page,
      limit,
      firstDate,
      lastDate
    });

  } catch (err) {
    console.error("❌ Counter collection report error:", err);
    res.status(500).json({ message: "Failed to load counter report", error: err.message });
  }
};

// ----------------------------------------------------------
// FETCH USERS LIST FOR DROPDOWN
// ----------------------------------------------------------
exports.getUsersList = async (req, res) => {
  try {
    const { User } = req.tenantModels;

    const users = await User.find({}, "username name role").sort({ username: 1 });

    res.json({ users });
  } catch (err) {
    console.error("❌ getUsersList error:", err);
    res.status(500).json({ message: "Failed to load users", error: err.message });
  }
};






// ----------------------------------------------------------
// USER + COUNTER WISE COLLECTION REPORT
// ----------------------------------------------------------
exports.getCollectionsUserReport = async (req, res) => {
  try {
    const { SalesBill } = req.tenantModels;
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
      // totalPages: Math.ceil(total / limit),
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
};








// ----------------------------------------------------------
// COLLECTION STATEMENT REPORT (COUNTER + USER + SUMMARY)
// ----------------------------------------------------------
exports.getCollectionStatementReport = async (req, res) => {
  try {
    const { SalesBill, User } = req.tenantModels;

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 25);

    const from = req.query.from;
    const to = req.query.to;
    const method = req.query.method;

    const match = {};

    // ------------------------------
    // DATE FILTER
    // ------------------------------
    if (from && to) {
      match.date = {
        $gte: new Date(from),
        $lte: new Date(to)
      };
    }

    // ------------------------------
    // PAYMENT METHOD FILTER (CORRECT FOR MIXED)
    // ------------------------------
    if (method && method !== "all") {
      if (method.toLowerCase() === "cash") {
        match["payment.cash"] = { $gt: 0 };
      }
      if (method.toLowerCase() === "upi") {
        match["payment.upi"] = { $gt: 0 };
      }
      if (method.toLowerCase() === "card") {
        match["payment.card"] = { $gt: 0 };
      }
    }

    // ------------------------------
    // GET ALL COUNTERS
    // ------------------------------
    const allCounters = await SalesBill.distinct("counter");

    // ------------------------------
    // GET ALL USERS
    // ------------------------------
    const allUsers = await User.find({}, { username: 1, name: 1 }).lean();

    // ------------------------------
    // COUNTER WISE AGGREGATION
    // ------------------------------
    const counterAgg = await SalesBill.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$counter",
          totalBills: { $sum: 1 },
          totalQty: { $sum: { $sum: "$items.qty" } },
          total: { $sum: "$netAmount" },

          paymentCash: { $sum: { $ifNull: ["$payment.cash", 0] } },
          paymentUpi: { $sum: { $ifNull: ["$payment.upi", 0] } },
          paymentCard: { $sum: { $ifNull: ["$payment.card", 0] } }
        }
      }
    ]);

    const counterRows = allCounters.map(cnt => {
      const found = counterAgg.find(r => r._id === cnt);
      if (found) return found;

      return {
        _id: cnt,
        totalBills: 0,
        totalQty: 0,
        total: 0,
        paymentCash: 0,
        paymentUpi: 0,
        paymentCard: 0
      };
    });

    // ------------------------------
    // USER WISE AGGREGATION (COLLECTOR)
    // ------------------------------
    const userAgg = await SalesBill.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$counterUser",
          totalBills: { $sum: 1 },
          totalQty: { $sum: { $sum: "$items.qty" } },
          total: { $sum: "$netAmount" },

          paymentCash: { $sum: { $ifNull: ["$payment.cash", 0] } },
          paymentUpi: { $sum: { $ifNull: ["$payment.upi", 0] } },
          paymentCard: { $sum: { $ifNull: ["$payment.card", 0] } }
        }
      }
    ]);

    const userRows = allUsers.map(u => {
      const found = userAgg.find(r => r._id === u.username);
      if (found) {
        return {
          ...found,
          name: u.name || u.username
        };
      }

      return {
        _id: u.username,
        name: u.name || u.username,
        totalBills: 0,
        totalQty: 0,
        total: 0,
        paymentCash: 0,
        paymentUpi: 0,
        paymentCard: 0
      };
    });

    // ------------------------------
    // SUMMARY
    // ------------------------------
    const summaryAgg = await SalesBill.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          cash: { $sum: { $ifNull: ["$payment.cash", 0] } },
          upi: { $sum: { $ifNull: ["$payment.upi", 0] } },
          card: { $sum: { $ifNull: ["$payment.card", 0] } },
          total: { $sum: "$netAmount" }
        }
      }
    ]);

    const summary = summaryAgg[0] || {
      cash: 0,
      upi: 0,
      card: 0,
      total: 0
    };

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
      counterRows,
      userRows,
      summary,
      page,
      totalPages: 1,
      limit,
      firstDate,
      lastDate
    });

  } catch (err) {
    console.error("❌ Statement report error:", err);
    res.status(500).json({
      message: "Failed to load statement report",
      error: err.message
    });
  }
};







// ---------------------------------------------
// STOCK REPORT
// ---------------------------------------------
exports.getStockReport = async (req, res) => {
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
        status: p.status,
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
        status: prod.status,
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

    // if (isAll) {
    //   // 🔥 PRINT / PDF PATH (NO PAGINATION)
    //   return res.json({
    //     rows,        // ✅ ALL DATA
    //     summary,
    //   });
    // }


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
};





/**
 * CATEGORY WISE STOCK REPORT

 */


// exports.getStockcategorywiseReport = async (req, res) => {
//   try {
//     const { Product } = req.tenantModels;

//     const {
//       page = 1,
//       limit = 25,
//       from,
//       to,
//       all
//     } = req.query;

//     const isAll = all === "true";

//     const pageNum = Number(page);
//     const pageSize = Number(limit);

//     const fromDate = from ? new Date(from) : null;
//     const toDate = to ? new Date(to) : null;

//     const products = await Product.find({ status: "active" }).lean();

//     const categoryMap = new Map();

//     let globalMin = null;
//     let globalMax = null;

//     for (const p of products) {
//       const category = p.category || "Uncategorized";

//       if (!Array.isArray(p.stockHistory)) continue;

//       // ----------------------------------
//       // TRACK GLOBAL DATE RANGE
//       // ----------------------------------
//       p.stockHistory.forEach(h => {
//         if (!h.date) return;
//         const d = new Date(h.date);
//         if (!globalMin || d < globalMin) globalMin = d;
//         if (!globalMax || d > globalMax) globalMax = d;
//       });

//       // ----------------------------------
//       // FILTER HISTORY BY DATE RANGE
//       // ----------------------------------

//       const isAllFilter = !fromDate && !toDate;

//       const filteredHistory = p.stockHistory.filter(h => {
//         if (!h.date) return false;
//         if (isAllFilter) return true;
//         const d = new Date(h.date);
//         if (fromDate && d < fromDate) return false;
//         if (toDate && d > toDate) return false;
//         return true;
//       });

//       if (!filteredHistory.length) continue;

//       filteredHistory.sort(
//         (a, b) => new Date(a.date) - new Date(b.date)
//       );

//       // ---------------------------------- 
//       // CLOSING STOCK AT END OF RANGE
//       // ----------------------------------
//       const closingStock =
//         Number(filteredHistory[filteredHistory.length - 1].closingStock) || 0;

//       if (closingStock < 0) continue;

//       // ----------------------------------
//       // CALCULATE VALUE FROM BATCHES
//       // ----------------------------------
    

//       const batches = (p.batches || []).filter(
//   b => b.status === "active"
// );

//       let remainingQty = closingStock;
//       let productValue = 0;

//       // FIFO style batch valuation
//       for (const b of batches) {
//         if (remainingQty <= 0) break;

//         const batchQty = Number(b.qty || 0);
//         const price = Number(b.salePrice || b.mrp || 0);

//         if (batchQty <= 0 || price <= 0) continue;

//         const usedQty = Math.min(batchQty, remainingQty);
//         productValue += usedQty * price;
//         remainingQty -= usedQty;
//       }

//       // ----------------------------------
//       // AGGREGATE CATEGORY WISE
//       // ----------------------------------
//       if (!categoryMap.has(category)) {
//         categoryMap.set(category, {
//           category,
//           itemCount: 1,
//           totalQty: closingStock,
//           value: productValue,
//         });
//       } else {
//         const entry = categoryMap.get(category);
//         entry.itemCount += 1;
//         entry.totalQty += closingStock;
//         entry.value += productValue;
//       }
//     }

//     const rows = Array.from(categoryMap.values()).sort((a, b) =>
//       a.category.localeCompare(b.category)
//     );

//     if (isAll) {
//       return res.json({
//         rows,
//         summary: {
//           categories: rows.length,
//           totalQty: rows.reduce((s, r) => s + r.totalQty, 0),
//           totalValue: rows.reduce((s, r) => s + r.value, 0),
//         },
//         firstHistoryDate: globalMin,
//         lastHistoryDate: globalMax,
//       });
//     }

//     const totalRecords = rows.length;
//     const totalPages = Math.ceil(totalRecords / pageSize);

//     const paginatedRows = rows.slice(
//       (pageNum - 1) * pageSize,
//       pageNum * pageSize
//     );

//     return res.json({
//       success: true,
//       rows: paginatedRows,
//       summary: {
//         categories: rows.length,
//         totalQty: rows.reduce((s, r) => s + r.totalQty, 0),
//         totalValue: rows.reduce((s, r) => s + r.value, 0),
//       },
//       pagination: {
//         page: pageNum,
//         limit: pageSize,
//         totalRecords,
//         totalPages,
//       },
//       firstHistoryDate: globalMin,
//       lastHistoryDate: globalMax,
//     });
//   } catch (err) {
//     console.error("❌ getStockcategorywiseReport error:", err);
//     return res.status(500).json({ message: "Server Error" });
//   }
// };








exports.getStockcategorywiseReport = async (req, res) => {
  try {
    const { Product } = req.tenantModels;

    const {
      page = 1,
      limit = 25,
      all
    } = req.query;

    const isAll = all === "true";

    const pageNum = Number(page);
    const pageSize = Number(limit);

    // ----------------------------------
    // FETCH PRODUCTS (IMPORTANT FIX)
    // ----------------------------------
    const products = await Product.find({ status: "active" })
      .select("category batches totalQty stockHistory") // ✅ include needed fields
      .lean();

    const categoryMap = new Map();

    let globalMin = null;
    let globalMax = null;

    // ----------------------------------
    // LOOP PRODUCTS
    // ----------------------------------
    for (const p of products) {
      const category = p.category || "Uncategorized";

      // ----------------------------------
      // TRACK GLOBAL DATE RANGE (ONLY FOR UI)
      // ----------------------------------
      if (Array.isArray(p.stockHistory)) {
        p.stockHistory.forEach(h => {
          if (!h.date) return;
          const d = new Date(h.date);
          if (!globalMin || d < globalMin) globalMin = d;
          if (!globalMax || d > globalMax) globalMax = d;
        });
      }

      // ----------------------------------
      // CURRENT STOCK (IGNORE DATE FILTER)
      // ----------------------------------
      const closingStock = Number(p.totalQty || 0);

      // ❌ skip only negative
      if (closingStock < 0) continue;

      // ----------------------------------
      // CALCULATE VALUE FROM BATCHES
      // ----------------------------------
      const batches = (p.batches || []).filter(
        b => b.status === "active"
      );

      let remainingQty = closingStock;
      let productValue = 0;

      // FIFO valuation
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
      // AGGREGATE CATEGORY WISE
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

    // ----------------------------------
    // FINAL ROWS
    // ----------------------------------
    const rows = Array.from(categoryMap.values()).sort((a, b) =>
      a.category.localeCompare(b.category)
    );

    // ----------------------------------
    // RETURN ALL (PRINT / PDF)
    // ----------------------------------
    if (isAll) {
      return res.json({
        rows,
        summary: {
          categories: rows.length,
          totalQty: rows.reduce((s, r) => s + r.totalQty, 0),
          totalValue: rows.reduce((s, r) => s + r.value, 0),
        },
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

    // ----------------------------------
    // FINAL RESPONSE
    // ----------------------------------
    return res.json({
      success: true,
      rows: paginatedRows,
      summary: {
        categories: rows.length,
        totalQty: rows.reduce((s, r) => s + r.totalQty, 0),
        totalValue: rows.reduce((s, r) => s + r.value, 0),
      },
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
    console.error("❌ getStockcategorywiseReport error:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};



// ---------------------------------------------
// PURCHASE REPORT
// ---------------------------------------------

// exports.getCategoryProductsReport = async (req, res) => {
//   try {
//     const { Product } = req.tenantModels;

//     const {
//       category,
//       from,
//       to,
//       page = 1,
//       limit = 10,
//       all,
//     } = req.query;

//     if (!category) {
//       return res.status(400).json({ message: "Category required" });
//     }

//     const pageNum = Number(page);
//     const pageSize = Number(limit);

//     // ----------------------------------
//     // DATE RANGE
//     // ----------------------------------
//     const fromDate = from ? new Date(from) : null;
//     const toDate = to ? new Date(to) : null;

//     if (toDate) {
//       toDate.setHours(23, 59, 59, 999);
//     }

//     // ----------------------------------
//     // FETCH PRODUCTS
//     // ----------------------------------
//     const products = await Product.find({
//       category,
//       status: "active",
//     })
//       .select("code name batches stockHistory")
//       .lean();

//     // ----------------------------------
//     // BUILD ROWS
//     // ----------------------------------
//     const allRows = [];

//     for (const p of products) {
//       if (!Array.isArray(p.stockHistory)) continue;

//       // -------------------------------
//       // FILTER STOCK HISTORY BY DATE
//       // -------------------------------
//       const filteredHistory = p.stockHistory.filter(h => {
//         if (!h.date) return false;
//         const d = new Date(h.date);
//         if (fromDate && d < fromDate) return false;
//         if (toDate && d > toDate) return false;
//         return true;
//       });

//       if (!filteredHistory.length) continue;

//       filteredHistory.sort(
//         (a, b) => new Date(a.date) - new Date(b.date)
//       );

//       // -------------------------------
//       // CLOSING STOCK IN RANGE
//       // -------------------------------
//       const closingStock =
//         Number(filteredHistory[filteredHistory.length - 1].closingStock) || 0;

//       if (closingStock <= 0) continue;

//       // -------------------------------
//       // CALCULATE VALUE (FIFO FROM BATCHES)
//       // -------------------------------
//       const batches = Array.isArray(p.batches) ? p.batches : [];

//       let remainingQty = closingStock;
//       let productValue = 0;

//       for (const b of batches) {
//         if (remainingQty <= 0) break;

//         const batchQty = Number(b.qty || 0);
//         const price = Number(b.salePrice || b.mrp || 0);

//         if (batchQty <= 0 || price <= 0) continue;

//         const usedQty = Math.min(batchQty, remainingQty);
//         productValue += usedQty * price;
//         remainingQty -= usedQty;
//       }

//       allRows.push({
//         code: p.code,
//         name: p.name,
//         qty: closingStock,
//         value: productValue,
//       });
//     }

//     // ----------------------------------
//     // PRINT / PDF → RETURN ALL
//     // ----------------------------------
//     if (all === true || all === "true") {
//       return res.json({
//         success: true,
//         rows: allRows,
//       });
//     }

//     // ----------------------------------
//     // PAGINATION
//     // ----------------------------------
//     const totalRecords = allRows.length;
//     const totalPages = Math.ceil(totalRecords / pageSize);

//     const paginatedRows = allRows.slice(
//       (pageNum - 1) * pageSize,
//       pageNum * pageSize
//     );

//     return res.json({
//       success: true,
//       rows: paginatedRows,
//       pagination: {
//         page: pageNum,
//         limit: pageSize,
//         totalRecords,
//         totalPages,
//       },
//       allRows, // 🔑 for modal print/pdf
//     });
//   } catch (err) {
//     console.error("❌ getCategoryProductsReport", err);
//     res.status(500).json({ message: "Server Error" });
//   }
// };





exports.getCategoryProductsReport = async (req, res) => {
  try {
    const { Product } = req.tenantModels;

    const {
      category,
      page = 1,
      limit = 10,
      all,
    } = req.query;

    if (!category) {
      return res.status(400).json({ message: "Category required" });
    }

    const pageNum = Number(page);
    const pageSize = Number(limit);

    // ----------------------------------
    // FETCH PRODUCTS (IMPORTANT FIX)
    // ----------------------------------
    const products = await Product.find({
      category,
      status: "active",
    })
      .select("code name batches totalQty") // ✅ USE totalQty
      .lean();

    const allRows = [];

    let categoryTotalQty = 0;
    let categoryTotalValue = 0;

    // ----------------------------------
    // LOOP PRODUCTS
    // ----------------------------------
    for (const p of products) {

      // ✅ CURRENT STOCK (IGNORE DATE FILTER)
      const closingStock = Number(p.totalQty || 0);

      if (closingStock < 0) continue;

      // ✅ ONLY ACTIVE BATCHES
      const batches = (p.batches || []).filter(
        b => b.status === "active"
      );

      let remainingQty = closingStock;
      let productValue = 0;

      // ----------------------------------
      // FIFO VALUE CALCULATION
      // ----------------------------------
      for (const b of batches) {
        if (remainingQty <= 0) break;

        const batchQty = Number(b.qty || 0);
        const price = Number(b.salePrice || b.mrp || 0);

        if (batchQty <= 0 || price <= 0) continue;

        const usedQty = Math.min(batchQty, remainingQty);
        productValue += usedQty * price;
        remainingQty -= usedQty;
      }

      // ✅ ADD CATEGORY TOTALS
      categoryTotalQty += closingStock;
      categoryTotalValue += productValue;

      // ✅ PUSH ROW
      allRows.push({
        code: p.code,
        name: p.name,
        qty: closingStock,
        value: productValue,
      });
    }

    // ----------------------------------
    // RETURN ALL (PRINT / PDF)
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

    // ----------------------------------
    // FINAL RESPONSE
    // ----------------------------------
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
      allRows, // for modal / print
    });

  } catch (err) {
    console.error("❌ getCategoryProductsReport", err);
    res.status(500).json({ message: "Server Error" });
  }
};




exports.getpurchaseregisterwiseReport = async (req, res) => {
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
      return res.status(500).json({ message: "Tenant DB manager not initialized" });
    }

    if (!Purchase) {
      return res.status(400).json({ message: "Purchase model missing" });
    }

    /* ------------------------------------------------------------
       BUILD QUERY (DATE FILTER)
       ------------------------------------------------------------ */
    const query = {};

    // if (from && to) {
    //   const fromDate = new Date(from);
    //   const toDate = new Date(to);
    //   fromDate.setHours(0, 0, 0, 0);
    //   toDate.setHours(23, 59, 59, 999);
    //   query.createdAt = { $gte: fromDate, $lte: toDate };
    // }


    const isAllFilter = !from || !to;
    let fromDate = null;
    let toDate = null;

    if (!isAllFilter) {
      fromDate = new Date(from);
      toDate = new Date(to);

      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);

      query.createdAt = { $gte: fromDate, $lte: toDate };
    }

    /* ------------------------------------------------------------
       FETCH PURCHASES
       ------------------------------------------------------------ */
    const purchases = await Purchase.find(query)
      // .sort({ stockedDate: -1 })
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
        amount,
        tax: taxAmount,
        groundTotal: pur.totalAmount,
        batches: pur.batches || []   // ⭐ ADD THIS
      });


    }


    // let firstDate = null;
    // let lastDate = null;

    // if (purchases.length > 0) {
    //   firstDate = purchases[0].invoiceDate;
    //   lastDate = purchases[purchases.length - 1].invoiceDate;
    // }


    let firstCreatedDate = null;
    let lastCreatedDate = null;

    purchases.forEach((p) => {
      const d = new Date(p.createdAt);

      if (!firstCreatedDate || d < firstCreatedDate) {
        firstCreatedDate = d;
      }

      if (!lastCreatedDate || d > lastCreatedDate) {
        lastCreatedDate = d;
      }
    });


    /* ------------------------------------------------------------
       SUMMARY
       ------------------------------------------------------------ */
    const summary = {
      totalQty: totalQtySum,
      amount: totalAmountSum,
      tax: totalTaxSum,
      grandTotal: grandTotalSum,
      firstDate: firstCreatedDate,
      lastDate: lastCreatedDate,
    };

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

    // ⭐ EXPORT MODE → RETURN ALL ROWS
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
    console.error("❌ getpurchaseregisterwiseReport error:", err);
    return res.status(500).json({
      message: "Failed to build purchase register wise report",
      error: err.message,
    });
  }
};



exports.getpurchasenameregisterReport = async (req, res) => {
  try {
    const { Purchase } = req.tenantModels || {};
    const { from, to, page = 1, limit = 10, export: isExport } = req.query;

    const query = {};


    const isAllFilter = !from || !to;

    // if (from && to) {
    //   const f = new Date(from);
    //   const t = new Date(to);

    //   f.setHours(0, 0, 0, 0);
    //   t.setHours(23, 59, 59, 999);

    //   query.createdAt = { $gte: f, $lte: t };
    // }


    let fromDate = null;
    let toDate = null;

    if (!isAllFilter) {
      fromDate = new Date(from);
      toDate = new Date(to);

      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);

      query.createdAt = { $gte: fromDate, $lte: toDate };
    }

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
          noOfProducts: 0,   // ⭐ NEW FIELD — total batches
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

      // ⭐ ADD total batch count = no. of products
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

    // SUMMARY
    const rows = Array.from(map.values());


    let firstCreatedDate = null;
    let lastCreatedDate = null;

    if (purchases.length > 0) {
      firstCreatedDate = purchases[0].createdAt;
      lastCreatedDate = purchases[purchases.length - 1].createdAt;
    }


    /* ------------------ FIRST & LAST DATE ------------------ */
    let firstDate = null;
    let lastDate = null;

    purchases.forEach((p) => {
      const d = new Date(p.createdAt);

      if (!firstDate || d < firstDate) {
        firstDate = d;
      }

      if (!lastDate || d > lastDate) {
        lastDate = d;
      }
    });

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

    res.json({
      rows: paginatedRows,
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

      pagination: {
        page: pageNum,
        limit: pageSize,
        totalRecords,
        totalPages,
      },
    });

  } catch (err) {
    console.error("❌ name-register error:", err);
    res.status(500).json({
      message: "Failed to build name register report",
      error: err.message,
    });
  }
};



exports.getPurchaseGstReport = async (req, res) => {
  try {
    const { Purchase } = req.tenantModels || {};
    const { from, to, page = 1, limit = 10, export: isExport } = req.query;

    if (!Purchase) {
      return res.status(400).json({ message: "Purchase model missing" });
    }

    /* ------------------------
       DATE FILTER
    ------------------------ */
    const query = {};

    const isAllFilter = !from || !to;

    let fromDate = null;
    let toDate = null;

    if (!isAllFilter) {
      fromDate = new Date(from);
      toDate = new Date(to);

      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);

      query.createdAt = { $gte: fromDate, $lte: toDate };
    }
    /* ------------------------
       FETCH PURCHASES
    ------------------------ */


    const purchases = await Purchase.find(query)
      .sort({ createdAt: 1 })   // ✅ IMPORTANT
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

    purchases.forEach((p) => {
      const d = new Date(p.createdAt);

      if (!firstDate || d < firstDate) {
        firstDate = d;
      }

      if (!lastDate || d > lastDate) {
        lastDate = d;
      }
    });




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

    // res.json({ rows, summary });

    if (isExport === "1") {
      return res.json({
        rows,
        summary,
      });
    }
    res.json({
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
    res.status(500).json({
      message: "Failed to build GST report",
      error: err.message,
    });
  }
};


exports.getSupplierBillsByPeriod = async (req, res) => {
  try {
    const { supplierName } = req.params;
    const { from, to } = req.query;
    const { Purchase } = req.tenantModels;

    const query = { supplierName };

    if (from && to) {
      const f = new Date(from);
      const t = new Date(to);
      f.setHours(0, 0, 0, 0);
      t.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: f, $lte: t };
    }

    const purchases = await Purchase.find(query)
      .sort({ createdAt: 1 })
      .lean();

    res.json({ rows: purchases });
  } catch (err) {
    console.error("Supplier bills error", err);
    res.status(500).json({ message: "Failed to load supplier bills" });
  }
};



// Expense Reports
exports.getExpenseReport = async (req, res) => {
  try {
    const { Expense } = req.tenantModels || {};
    const { from, to, page = 1, limit = 10, export: isExport } = req.query;

    if (!Expense) {
      return res.status(400).json({ message: "Expense model missing" });
    }

    const query = {};

    // ✅ DATE FILTER (APPLIES TO UI + EXPORT)
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

    // ✅ UI MODE (WITH PAGINATION)
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
    res.status(500).json({
      message: "Failed to build expense report",
      error: err.message,
    });
  }
};



exports.getExpenseCategoryReport = async (req, res) => {
  try {
    const { Expense } = req.tenantModels || {};
    const {
      from,
      to,
      category,
      page = 1,
      limit = 10,
      export: isExport,
    } = req.query;

    if (!Expense) {
      return res.status(400).json({ message: "Expense model missing" });
    }

    const query = {};

    // DATE FILTER
    if (from && to) {
      const f = new Date(from);
      const t = new Date(to);
      f.setHours(0, 0, 0, 0);
      t.setHours(23, 59, 59, 999);
      query.date = { $gte: f, $lte: t };
    }

    // CATEGORY FILTER
    if (category?.trim()) {
      query.category = new RegExp(category.trim(), "i");
    }

    // FETCH ALL MATCHING EXPENSES
    const expenses = await Expense.find(query).sort({ date: 1 }).lean();

    // FIRST / LAST DATE
    let firstDate = null;
    let lastDate = null;
    if (expenses.length) {
      firstDate = expenses[0].date;
      lastDate = expenses[expenses.length - 1].date;
    }

    // GROUP BY CATEGORY
    const map = new Map();
    for (const e of expenses) {
      const cat = (e.category || "Uncategorized").trim();
      if (!map.has(cat)) {
        map.set(cat, { category: cat, entries: 0, totalAmount: 0 });
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

    /* ===============================
       NORMAL MODE (WITH PAGINATION)
       =============================== */
    const pageNum = Math.max(1, Number(page));
    const pageSize = Math.max(1, Number(limit));
    const totalRecords = rows.length;
    const start = (pageNum - 1) * pageSize;

    const paginatedRows = rows.slice(start, start + pageSize);

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
    res.status(500).json({
      message: "Failed to build expense category report",
      error: err.message,
    });
  }
};



exports.getExpenseCategoryDetails = async (req, res) => {
  try {
    const { Expense } = req.tenantModels;
    const { category, from, to, page = 1, limit = 5, export: isExport } = req.query;

    const query = {};
    if (category) query.category = category;

    if (from && to) {
      query.date = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
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

    const pageNum = Math.max(1, Number(page));
    const pageSize = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * pageSize;

    const totalRecords = await Expense.countDocuments(query);

    const rows = await Expense.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    res.json({
      rows,
      totalPages: Math.ceil(totalRecords / pageSize),
    });
  } catch (err) {
    console.error("Category expense details error:", err);
    res.status(500).json({ message: "Failed to load category expense details" });
  }
};




