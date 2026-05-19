// routes/salesBillRoutes.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const authTenantOrMaster = require("../middleware/authTenantOrMaster");

// 🔹 Utility: Get next bill number safely
async function getNextBillNo(shopname, SalesBill) {
  const lastBill = await SalesBill.findOne().sort({ createdAt: -1 });
  let nextBillNo = "B001";
  if (lastBill && lastBill.billNo) {
    const lastNum = parseInt(lastBill.billNo.replace(/^B/, ""), 10);
    nextBillNo = "B" + (lastNum + 1).toString().padStart(3, "0");
  }
  return nextBillNo;
}

// -------------------------
// Sales Bills CRUD
// -------------------------

// ✅ GET /shops/:shopname/sales-bills (List bills with search, filters, pagination)
router.get("/shops/:shopname/master-sales-bills", authTenantOrMaster, async (req, res) => {
  try {
    const { SalesBill } = req.tenantModels;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const search = (req.query.search ?? "").trim();
    const filter = req.query.filter;
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;

    const query = { shop: req.shop._id };

    // 🔍 SEARCH
    if (search) {
      query.$or = [
        { billNo: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    // 📅 DATE FILTERS
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
      query.date = { $gte: new Date(fromDate), $lte: new Date(toDate + "T23:59:59.999Z") };
    }

    // 📊 FETCH DATA
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

// ✅ GET /shops/:shopname/sales-bills/:id
router.get("/shops/:shopname/master-sales-bills/:id", authTenantOrMaster, async (req, res) => {
  try {
    const { SalesBill } = req.tenantModels;
    const id = req.params.id;

    if (id === "next-billno" || id === "next-bill-no") {
      const nextBillNo = await getNextBillNo(req.shop.shopname, SalesBill);
      return res.json({ nextBillNo });
    }

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid bill ID" });

    const bill = await SalesBill.findOne({ _id: id, shop: req.shop._id });
    if (!bill) return res.status(404).json({ message: "Bill not found" });

    res.json({ bill, accessedBy: req.authType });
  } catch (err) {
    console.error("Get bill by ID error:", err);
    res.status(500).json({ message: "Failed to fetch bill", error: err.message });
  }
});

// ✅ POST /shops/:shopname/sales-bills
router.post("/shops/:shopname/master-sales-bills", authTenantOrMaster, async (req, res) => {
  try {
    const { SalesBill, Product } = req.tenantModels;

    const nextBillNo = await getNextBillNo(req.shop.shopname, SalesBill);
    const newBill = new SalesBill({
      ...req.body,
      billNo: nextBillNo,
      shop: req.shop._id,
    });

    const saved = await newBill.save();

    // 🔥 Adjust stock if items exist
    if (req.body.items && Array.isArray(req.body.items)) {
      for (const item of req.body.items) {
        if (item.code && item.batch && item.qty > 0) {
          await Product.findOneAndUpdate(
            { code: item.code, batch: item.batch },
            { $inc: { stock: -Math.abs(item.qty) } },
            { new: true }
          );
        }
      }
    }

    res.status(201).json({ saved, accessedBy: req.authType });
  } catch (err) {
    console.error("Create sales bill error:", err);
    res.status(500).json({ message: "Failed to create sales bill", error: err.message });
  }
});

// ✅ PUT /shops/:shopname/sales-bills/:id
router.put("/shops/:shopname/master-sales-bills/:id", authTenantOrMaster, async (req, res) => {
  try {
    const { SalesBill, Product } = req.tenantModels;
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid bill ID" });

    const bill = await SalesBill.findOne({ _id: id, shop: req.shop._id });
    if (!bill) return res.status(404).json({ message: "Bill not found" });

    const oldItems = bill.items || [];
    const newItems = req.body.items || [];

    const oldMap = new Map(oldItems.map((i) => [`${i.code}_${i.batch}`, i]));
    const newMap = new Map(newItems.map((i) => [`${i.code}_${i.batch}`, i]));

    // Update stock changes
    for (const newItem of newItems) {
      const key = `${newItem.code}_${newItem.batch}`;
      const oldItem = oldMap.get(key);
      const oldQty = oldItem ? Number(oldItem.qty) : 0;
      const newQty = Number(newItem.qty);
      const delta = newQty - oldQty;

      if (delta !== 0) {
        await Product.findOneAndUpdate(
          { code: newItem.code, batch: newItem.batch },
          { $inc: { stock: -delta } },
          { new: true }
        );
      }
    }

    // Restore stock for removed items
    for (const oldItem of oldItems) {
      const key = `${oldItem.code}_${oldItem.batch}`;
      if (!newMap.has(key)) {
        await Product.findOneAndUpdate(
          { code: oldItem.code, batch: oldItem.batch },
          { $inc: { stock: oldItem.qty } }
        );
      }
    }

    Object.assign(bill, req.body);
    const updated = await bill.save();

    res.json({ updated, accessedBy: req.authType });
  } catch (err) {
    console.error("Update sales bill error:", err);
    res.status(500).json({ message: "Failed to update sales bill", error: err.message });
  }
});

// ✅ DELETE /shops/:shopname/sales-bills/:id
router.delete("/shops/:shopname/master-sales-bills/:id", authTenantOrMaster, async (req, res) => {
  try {
    const { SalesBill } = req.tenantModels;
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid bill ID" });

    const deleted = await SalesBill.findOneAndDelete({ _id: id, shop: req.shop._id });
    if (!deleted) return res.status(404).json({ message: "Bill not found" });

    res.json({ message: "Bill deleted successfully", accessedBy: req.authType });
  } catch (err) {
    console.error("Delete sales bill error:", err);
    res.status(500).json({ message: "Failed to delete bill", error: err.message });
  }
});

// ✅ GET /shops/:shopname/sales-bills/summary
router.get("/shops/:shopname/master-sales-bills/summary", authTenantOrMaster, async (req, res) => {
  try {
    const { SalesBill } = req.tenantModels;
    const shopId = req.shop._id;
    const period = req.query.period;

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
      { $group: { _id: null, totalAmount: { $sum: "$netAmount" }, count: { $sum: 1 } } },
    ]);

    res.json({
      shop: req.shop.shopname,
      period,
      summary: totalSales[0] || { totalAmount: 0, count: 0 },
      accessedBy: req.authType,
    });
  } catch (err) {
    console.error("Sales summary error:", err);
    res.status(500).json({ message: "Failed to fetch sales summary", error: err.message });
  }
});

// ✅ GET /shops/:shopname/sales-bills/next-billno
router.get("/shops/:shopname/master-sales-bills/next-billno", authTenantOrMaster, async (req, res) => {
  try {
    const { SalesBill } = req.tenantModels;
    const nextBillNo = await getNextBillNo(req.shop.shopname, SalesBill);
    res.json({ nextBillNo });
  } catch (err) {
    console.error("Get next bill number error:", err.message);
    res.status(500).json({ message: `Failed to get next bill number: ${err.message}` });
  }
});

module.exports = router;
