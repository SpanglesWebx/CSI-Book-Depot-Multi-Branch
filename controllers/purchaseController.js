// server/controllers/purchaseController.js
const {
  generateUniqueRandomCode,
  generateBarcode
} = require("../utils/randomCode");

/**
 * Generate next order number
 */


// const getNextPurchaseOrderNo = async (Counter, shopId) => {
//   const year = new Date().getFullYear().toString().slice(-2);
//   const counterKey = `purchase:${shopId}:${year}`;

//   const counter = await Counter.findOneAndUpdate(
//     { name: counterKey },
//     { $inc: { seq: 1 } },
//     { new: true, upsert: true }
//   );

//   return `O${year}-${counter.seq}`;
// };

const getNextPurchaseOrderNo = async (Counter, shopId) => {

  const counterKey = `purchase:${shopId}`;

  const counter = await Counter.findOneAndUpdate(
    { name: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seq = counter.seq.toString().padStart(5, "0");

  return `ORD${seq}`;
};

module.exports = getNextPurchaseOrderNo;


// const previewNextPurchaseOrderNo = async (Counter, shopId) => {
//   const year = new Date().getFullYear().toString().slice(-2);
//   const counterKey = `purchase:${shopId}:${year}`;

//   const counter = await Counter.findOne({ name: counterKey }).lean();
//   const nextSeq = (counter?.seq || 0) + 1;

//   return `O${year}-${nextSeq}`;
// };


const previewNextPurchaseOrderNo = async (Counter, shopId) => {

  const counterKey = `purchase:${shopId}`;

  const counter = await Counter.findOne({ name: counterKey }).lean();

  const nextSeq = (counter?.seq || 0) + 1;

  const formatted = nextSeq.toString().padStart(5, "0");

  return `ORD${formatted}`;
};

module.exports = previewNextPurchaseOrderNo;




const getNextOrderNo = async (req, res) => {
  try {
    const { Counter } = req.tenantModels;
    const shopId = req.user?.shopId;

    const nextOrderNo = await previewNextPurchaseOrderNo(Counter, shopId);
    res.json({ nextOrderNo });

  } catch (err) {
    console.error("getNextOrderNo ERROR:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
};




/**
 * CREATE PURCHASE + UPDATE PRODUCT BATCHES (UNIFIED SAVE)
 */
const createPurchase = async (req, res) => {
  const { Purchase, Product } = req.tenantModels;

  const session = await Purchase.db.startSession();
  session.startTransaction();

  try {
    const shopId = req.user?.shopId;
    if (!shopId) return res.status(400).json({ message: "Shop missing" });

    const {
      orderNo: providedOrderNo,
      supplierId,
      supplierName,
      supplierMobile,
      invoiceNo,
      invoiceDate,
      stockedDate,
      batches,
    } = req.body;

    if ( !invoiceNo || !invoiceDate || !stockedDate)
      return res.status(400).json({ message: "Missing required fields" });

    if (!Array.isArray(batches) || batches.length === 0)
      return res.status(400).json({ message: "No batches provided" });


    /**
     * Generate orderNo
     */
    // let orderNo = providedOrderNo;


    const orderNo = await getNextPurchaseOrderNo(
  req.tenantModels.Counter,
  shopId
);
   


    /**
     * Compute totals
     */
    const totalAmount = batches.reduce((acc, b) => acc + Number(b.value), 0);
    const noOfItems = batches.length;


    /**
     * Save Purchase
     */
    const purchase = await Purchase.create(
      [
        {
          orderNo,
          supplierId,
          supplierName,
          supplierMobile,
          invoiceNo,
          invoiceDate,
          stockedDate,
          noOfItems,
          totalAmount,
          batches,
          shop: shopId,
        },
      ],
      { session }
    );


    /**
     * Update Product Batches
     */
    for (const b of batches) {
      const product = await Product.findOne({
        shop: shopId,
        code: b.code
      }).session(session);

      if (!product) continue;

      let batch = product.batches.find(x => x.batchNo === b.batchNo);

      if (!batch) {
        // NEW batch
        const randomCode = await generateUniqueRandomCode(Product);
        const barcode = await generateBarcode(randomCode);

        product.batches.push({
          batchNo: b.batchNo,
          qty: Number(b.qty),
          mrp: Number(b.mrp),
          salePrice: Number(b.rate),
          gst: Number(b.gst),
          taxMode: b.taxMode,
          value: Number(b.value),
          randomCode,
          barcode,
          status: "active",
        });
      } else {
        // EXISTING batch — update inside document
        batch.qty += Number(b.qty);

        // important: update pricing fields if needed
        batch.mrp = Number(b.mrp);
        batch.salePrice = Number(b.rate);
        batch.gst = Number(b.gst);
        batch.taxMode = b.taxMode;
      }

      // ⭐ Update totalQty always
      product.totalQty = product.batches.reduce(
        (sum, x) => sum + Number(x.qty || 0),
        0
      );


// ⭐ STOCK MOVEMENT FOR PURCHASE (Always stock-in)
const previous = product.totalQty - Number(b.qty || 0);
const change = Number(b.qty || 0);
const closing = previous + change;

product.stockHistory.push({
  date: new Date(),
  openingStock: previous,
  closingStock: closing,
  change,
  reason: "purchase",
  batchNo: b.batchNo,
  invoiceNo: invoiceNo
});





      await product.save({ session });
    }


    /**
     * Commit Transaction
     */
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Purchase created + Product batches updated",
      purchase: purchase[0]
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ createPurchase ERROR:", err);
    return res.status(500).json({
      message: "Failed to create purchase",
      error: err.message,
    });
  }
};


/**
 * List Purchases
 */
const listPurchases = async (req, res) => {
  try {
    const { Purchase } = req.tenantModels;
    const shopId = req.user?.shopId;

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    const query = { shop: shopId };

    if (search.trim()) {
      const s = search.trim();
      query.$or = [
        { orderNo: { $regex: s, $options: "i" } },
        { invoiceNo: { $regex: s, $options: "i" } },
        { supplierId: { $regex: s, $options: "i" } },
        { supplierName: { $regex: s, $options: "i" } },
        { supplierMobile: { $regex: s, $options: "i" } },
      ];
    }

    const total = await Purchase.countDocuments(query);

    const purchases = await Purchase.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      purchases,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });

  } catch (err) {
    console.error("listPurchases ERROR:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
};


/**
 * Update Purchase Status
 */
const updatePurchase = async (req, res) => {
  try {
    const { Purchase } = req.tenantModels;
    const shopId = req.user?.shopId;
    const id = req.params.id;
    const { status } = req.body;

    if (!["placed", "received", "cancelled"].includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const ObjectId = Purchase.db.base.Types.ObjectId;
    if (!ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid id" });

    const updated = await Purchase.findOneAndUpdate(
      { _id: id, shop: shopId },
      { status },
      { new: true }
    );

    res.json({ message: "Updated", purchase: updated });

  } catch (err) {
    console.error("updatePurchase ERROR:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
};


module.exports = {
  getNextOrderNo,
  createPurchase,
  listPurchases,
  updatePurchase
};
