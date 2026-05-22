




// controllers/salesBillController.js
const mongoose = require("mongoose");
const getNextBillNoUtil = require("../utils/getNextBillNoUtil");
const previewNextBillNo = require("../utils/previewNextBillNo");
// const counterManager = require("../utils/counterManager");


// ==========================
// ✅ Fetch All Sales Bills
// ==========================
exports.getSalesBills = async (req, res) => {
  try {
    if (!req.shop || !req.shop._id) {
      return res.status(400).json({ message: "Shop context missing" });
    }

    const {
      page = 1,
      limit = 10,
      search = "",
      filter = "",
      fromDate,
      toDate,
      counter,
      statusFilter,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const { SalesBill } = req.tenantModels;

    const query = { shop: req.shop._id };

    // ---------- 🔍 Search ----------
    // if (search.trim()) {
    //   const regex = new RegExp(search.trim(), "i");
    //   query.$or = [
    //     { billNo: regex },
    //     { customerName: regex },
    //     { mobile: regex },
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


    // ---------- 📅 Date Filters ----------
    const now = new Date();

    if (filter) {
      switch (filter) {
        case "today":
          query.date = {
            $gte: new Date(now.setHours(0, 0, 0, 0)),
            $lte: new Date(now.setHours(23, 59, 59, 999)),
          };
          break;

        case "this-week": {
          const firstDay = new Date(now.getDate() - now.getDay());
          firstDay.setHours(0, 0, 0, 0);
          const lastDay = new Date(firstDay);
          lastDay.setDate(firstDay.getDate() + 6);
          lastDay.setHours(23, 59, 59, 999);
          query.date = { $gte: firstDay, $lte: lastDay };
          break;
        }

        case "this-month": {
          const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastDayMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23,
            59,
            59,
            999
          );
          query.date = { $gte: firstDayMonth, $lte: lastDayMonth };
          break;
        }

        case "custom":
          if (fromDate && toDate) {
            query.date = {
              $gte: new Date(fromDate),
              $lte: new Date(toDate + "T23:59:59.999Z"),
            };
          }
          break;
      }
    }

    // ---------- 📊 Fetch Data ----------
    const totalBills = await SalesBill.countDocuments(query);
    const bills = await SalesBill.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      bills,
      totalPages: Math.ceil(totalBills / Number(limit)),
      totalBills,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    console.error("❌ getSalesBills error:", error);
    res.status(500).json({
      message: "Server Error while fetching sales bills",
      error: error.message,
    });
  }
};

// -----------------------------
// GET sales bill by ID
// -----------------------------
exports.getSalesBillById = async (req, res) => {
  try {
    const { SalesBill } = req.tenantModels;
    const idOrNext = req.params.id;

    // Handle dynamic "next-bill-no"
    if (idOrNext === "next-bill-no") {
      // support optional query param ?counter=1
      const counter = Number(req.query.counter) || 1;


      // const nextBillNo = await getNextBillNoUtil(SalesBill, req.shop._id, counter);

      const nextBillNo = await previewNextBillNo(
        req.tenantModels.Counter,
        req.shop._id,
        counter
      );

      return res.json({ billNo: nextBillNo });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(idOrNext)) {
      return res.status(400).json({ message: "Invalid bill ID" });
    }

    const bill = await SalesBill.findOne({
      _id: idOrNext,
      shop: req.shop._id,
    });

    if (!bill) return res.status(404).json({ message: "Bill not found" });

    res.json(bill);
  } catch (error) {
    console.error("getSalesBillById error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// -----------------------------
// CREATE a sales bill
// -----------------------------



exports.createSalesBill = async (req, res) => {
  try {
    const { SalesBill, Product } = req.tenantModels;


    // const billNo = await getNextBillNoUtil(SalesBill, counterNo);
    const counterNo =
  Number(req.user.counter) ||
  Number(req.body.counter) ||
  1;

const billNo = await getNextBillNoUtil(
  req.tenantModels.Counter,
  req.shop._id,
  counterNo
);


    req.body.discountPercent = req.body.discountPercent || 0;
    req.body.cgst = req.body.cgst || 0;
    req.body.sgst = req.body.sgst || 0;
    req.body.totalGst = Number(req.body.totalGst || 0);

    /* ------------------------------------------------------------------
        ⭐ SANITIZE ITEMS (Opening & Closing stock from FRONTEND)
       ------------------------------------------------------------------ */
    const sanitizedItems = (req.body.items || []).map((it) => {
      const opening = Number(it.openingStock || 0);
      const closing =
        typeof it.closingStock !== "undefined"
          ? Number(it.closingStock)
          : Math.max(0, opening - Number(it.qty || 0));

      return {
        code: it.code,
        name: it.name,
        batch: it.batch,
        mrp: Number(it.mrp || 0),
        rate: Number(it.rate || 0),
        qty: Number(it.qty || 0),
        gst: Number(it.gst || 0),
        taxable: Number(it.taxable || 0),
        // gstAmount: Number(it.gstAmount || 0),
        value: Number(it.value || 0),
        isInclusive: !!it.isInclusive,

        // ⭐ Snapshot
        openingStock: opening,
        closingStock: closing,
      };
    });



    /* ------------------------------------------------------------------
        ⭐ PAYMENT AUTO-FILL LOGIC
    ------------------------------------------------------------------ */

    let paymentMethod = req.body.paymentMethod || "cash";
    let paymentStatus = req.body.paymentStatus || "paid";
    let netAmt = Number(req.body.netAmount || 0);

    // extract values safely
    let sentCash = Number(req.body.payment?.cash || 0);
    let sentUpi = Number(req.body.payment?.upi || 0);
    let sentCard = Number(req.body.payment?.card || 0);

    let payment = {
      cash: sentCash,
      upi: sentUpi,
      card: sentCard
    };

    // If user manually entered split → do NOT override anything
    const userEnteredCustom =
      (sentCash > 0 && sentUpi > 0) ||
      (sentCash > 0 && sentCard > 0) ||
      (sentUpi > 0 && sentCard > 0);

    // If exactly one method selected but amount does NOT match → user manually edited
    const manualSingleEntry =
      (paymentMethod === "cash" && sentCash > 0 && sentCash !== netAmt) ||
      (paymentMethod === "upi" && sentUpi > 0 && sentUpi !== netAmt) ||
      (paymentMethod === "card" && sentCard > 0 && sentCard !== netAmt);

    // If user manually typed something OR method = partial → preserve values
    if (paymentMethod === "partial" || userEnteredCustom || manualSingleEntry) {
      paymentStatus = sentCash + sentUpi + sentCard >= netAmt ? "paid" : "partial";
    }
    else {
      // AUTO-FILL logic ONLY when user did not touch fields
      if (paymentMethod === "cash") {
        payment = { cash: netAmt, upi: 0, card: 0 };
      }
      if (paymentMethod === "upi") {
        payment = { cash: 0, upi: netAmt, card: 0 };
      }
      if (paymentMethod === "card") {
        payment = { cash: 0, upi: 0, card: netAmt };
      }
    }

    // else partial → keep values sent from frontend


    // SAVE BILL
    const newBill = new SalesBill({
      shop: req.shop._id,
      ...req.body,
      items: sanitizedItems,
      billNo,
      counter: Number(counterNo),


      total: Number(req.body.total || 0),
      totalGst: Number(req.body.totalGst || 0),
      // ⭐ Audit fields
      createdBy: req.body.createdBy || "",
      createdById: req.body.createdById || null,
      counterUser: req.body.counterUser || "",
      // deviceInfo: req.body.deviceInfo || {},
      editedBy: null,

      // ⭐ DEVICE TRACE (FIX)
      deviceInfo: {
        ip: req.body.deviceInfo?.ip || "",
        userAgent: req.body.deviceInfo?.userAgent || "",
        mac: "",                    
      },

      // ⭐ FINAL — USE our calculated values
      paymentMethod: paymentMethod,
      payment: payment,
      paymentStatus: paymentStatus,
    });

    const savedBill = await newBill.save();


    for (const item of savedBill.items) {
      if (!item.code || item.qty <= 0) continue;

      await Product.updateOne(
        { shop: req.shop._id, code: item.code },
        {
          $inc: { totalSoldQty: item.qty },   // ✅ increment product sold
          $push: {
            productSales: {
              date: savedBill.date,
              qty: item.qty,
              billId: savedBill._id,
              billNo: savedBill.billNo,
              counter: savedBill.counter,
              soldBy: savedBill.counterUser || savedBill.createdBy,
              reason: "sale",
            },
          },
        }
      );
    }


    /* ------------------------------------------------------------------
         ❌ DO NOT UPDATE REAL STOCK HERE (frontend already decremented)
         ⭐ Keep this block ONLY if skipStockUpdate == false
       ------------------------------------------------------------------ */
    if (!req.body.skipStockUpdate) {
      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          if (item.code && item.batch && item.qty > 0) {
            await Product.updateOne(
              { code: item.code, "batches.batchNo": item.batch },
              { $inc: { "batches.$.qty": -Math.abs(item.qty) } }
            );
          }
        }
      }
    }

    res.status(201).json(savedBill);
  } catch (error) {
    console.error("createSalesBill error:", error);
    res
      .status(400)
      .json({ message: "Error saving bill", error: error.message });
  }
};










exports.updateSalesBill = async (req, res) => {
  try {
    const { SalesBill, Product } = req.tenantModels;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid bill ID" });
    }

    const bill = await SalesBill.findOne({ _id: id, shop: req.shop._id });
    if (!bill) return res.status(404).json({ message: "Bill not found" });

    const oldItems = bill.items || [];
    const newItems = req.body.items || [];

    const oldMap = new Map(oldItems.map(i => [`${i.code}_${i.batch}`, i]));
    const newMap = new Map(newItems.map(i => [`${i.code}_${i.batch}`, i]));

    /* -------------------------------------------------------------
      ⭐ 1. ADJUST STOCK FOR UPDATED ITEMS
    ------------------------------------------------------------- */
    for (const newItem of newItems) {
      const key = `${newItem.code}_${newItem.batch}`;
      const oldItem = oldMap.get(key);

      const oldQty = oldItem ? Number(oldItem.qty) : 0;
      const newQty = Number(newItem.qty);
      const delta = newQty - oldQty;

      if (delta !== 0) {
        await Product.updateOne(
          { code: newItem.code, "batches.batchNo": newItem.batch },
          { $inc: { "batches.$.qty": -delta } } // ⭐ Correct batch stock update
        );
      }
    }

    /* -------------------------------------------------------------
      ⭐ 2. IF ANY OLD ITEMS REMOVED → RESTORE THEIR STOCK
    ------------------------------------------------------------- */
    for (const oldItem of oldItems) {
      const key = `${oldItem.code}_${oldItem.batch}`;
      if (!newMap.has(key)) {
        await Product.updateOne(
          { code: oldItem.code, "batches.batchNo": oldItem.batch },
          { $inc: { "batches.$.qty": oldItem.qty } }
        );
      }
    }

    /* -------------------------------------------------------------
      ⭐ 3. SANITIZE ITEMS + REBUILD STOCK SNAPSHOT
    ------------------------------------------------------------- */
    const sanitizedItems = await Promise.all(
      newItems.map(async (it) => {
        const prod = await Product.findOne({
          code: it.code,
          "batches.batchNo": it.batch
        });

        const batchObj = prod?.batches?.find(
          b =>
            (b.batchNo || "").toLowerCase() ===
            (it.batch || "").toLowerCase()
        );

        const opening = Number(batchObj?.qty || 0) + Number(it.qty);
        const closing = Number(batchObj?.qty || 0);

        return {
          code: it.code,
          name: it.name,
          batch: it.batch,
          mrp: Number(it.mrp || 0),
          rate: Number(it.rate || 0),
          qty: Number(it.qty || 0),
          gst: Number(it.gst || 0),
          taxable: Number(it.taxable || 0),
          gstAmount: Number(it.gstAmount || 0),
          value: Number(it.value || 0),
          isInclusive: !!it.isInclusive,

          // snapshot
          openingStock: opening,
          closingStock: closing,
        };
      })
    );

    bill.items = sanitizedItems;
    bill.customerName = req.body.customerName;
    bill.mobile = req.body.mobile;
    bill.counter = req.body.counter;
    bill.total = req.body.total;
    bill.discount = req.body.discount;
    bill.netAmount = req.body.netAmount;
    bill.cashGiven = req.body.cashGiven;
    bill.balance = req.body.balance;
    bill.cgst = req.body.cgst;
    bill.sgst = req.body.sgst;
    bill.discountPercent = req.body.discountPercent;

    const updatedBill = await bill.save();
    res.json(updatedBill);

  } catch (error) {
    console.error("updateSalesBill error:", error);
    res.status(500).json({ message: "Server Error", error });
  }
};



// -----------------------------
// DELETE a sales bill
// -----------------------------
exports.deleteSalesBill = async (req, res) => {
  try {
    const { SalesBill } = req.tenantModels;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid bill ID" });
    }

    const deletedBill = await SalesBill.findOneAndDelete({ _id: id, shop: req.shop._id });
    if (!deletedBill) return res.status(404).json({ message: "Bill not found" });

    res.json({ message: "Bill deleted successfully" });
  } catch (error) {
    console.error("deleteSalesBill error:", error);
    res.status(500).json({ message: "Server Error", error });
  }
};

// -----------------------------
// GET next bill number
// -----------------------------
exports.getNextBillNo = async (req, res) => {
  try {
    const counterNo = Number(req.query.counter) || 1;

    const billNo = await previewNextBillNo(
      req.tenantModels.Counter,
      req.shop._id,
      counterNo
    );

    res.json({ billNo });
  } catch (error) {
    console.error("getNextBillNo error:", error);
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};


