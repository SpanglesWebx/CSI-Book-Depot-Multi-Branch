

// server/routes/reports.js
const express = require("express");
const mongoose = require("mongoose");
const SalesBill = require("../models/SalesBill");
const authTenantOrMaster = require("../middleware/authTenantOrMaster");
const { getTenantDB } = require("../config/tenantManager");

const router = express.Router();

async function getTenantSalesBillModel(shopname) {
  const tenantConn = await getTenantDB(shopname);
  return tenantConn.model("SalesBill", SalesBill.schema);
}

// 1️⃣ All bills
router.get("/shops/:shopname/dashboard/sales-bills", authTenantOrMaster, async (req, res) => {
  try {
    const shopname = decodeURIComponent(req.params.shopname);
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const SalesBillTenant = await getTenantSalesBillModel(shopname);
    const total = await SalesBillTenant.countDocuments();
    const bills = await SalesBillTenant.find().sort({ date: -1 }).skip(skip).limit(limit);

    res.json({ bills, total, page, limit });
  } catch (err) {
    console.error("Failed to fetch bills:", err);
    res.status(500).json({ error: "Failed to fetch bills" });
  }
});

// 2️⃣ Single bill
router.get("/shops/:shopname/dashboard/sales-bills/:billId", authTenantOrMaster, async (req, res) => {
  try {
    const shopname = decodeURIComponent(req.params.shopname);
    const { billId } = req.params;

    const SalesBillTenant = await getTenantSalesBillModel(shopname);

    let bill = null;
    if (mongoose.Types.ObjectId.isValid(billId)) {
      bill = await SalesBillTenant.findById(billId);
    }
    if (!bill) {
      bill = await SalesBillTenant.findOne({ billNo: billId });
    }

    if (!bill) return res.status(404).json({ message: "Bill not found" });
    res.json({ bill });
  } catch (err) {
    console.error("Failed to fetch bill:", err);
    res.status(500).json({ error: "Failed to fetch bill" });
  }
});


router.get(
  "/shops/:shopname/dashboard/sales-bills-cards/summary",
  authTenantOrMaster,
  async (req, res) => {
    try {
      const shopname = decodeURIComponent(req.params.shopname);
      const SalesBillTenant = await getTenantSalesBillModel(shopname);
 
      // 1️⃣ Fetch all bills for this shop
      const bills = await SalesBillTenant.find().sort({ date: -1 }).lean();
 
      // 2️⃣ Sum the netAmount
      const totalNetAmount = bills.reduce(
        (sum, bill) => sum + (bill.netAmount || 0),
        0
      );
 
      // 3️⃣ Count total bills
      const totalBills = bills.length;
 
      // 4️⃣ Respond with summary + bills
      res.json({
        shop: { shopname },
        summary: { totalBills, totalNetAmount },
        salesBills: bills,
        totalBillsFetched: bills.length,
      });
    } catch (err) {
      console.error("Failed to fetch sales bill summary:", err);
      res.status(500).json({ error: "Failed to fetch sales bill summary" });
    }
  }
);




// 4️⃣ Bills in date range
router.get("/shops/:shopname/dashboard/sales-bills/range", authTenantOrMaster, async (req, res) => {
  try {
    const shopname = decodeURIComponent(req.params.shopname);
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ message: "Start and end dates required" });

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const SalesBillTenant = await getTenantSalesBillModel(shopname);
    const bills = await SalesBillTenant.find({ date: { $gte: startDate, $lte: endDate } }).sort({ date: -1 });

    res.json({ bills, total: bills.length });
  } catch (err) {
    console.error("Failed to fetch bills by range:", err);
    res.status(500).json({ error: "Failed to fetch bills by range" });
  }
});




module.exports = router;
