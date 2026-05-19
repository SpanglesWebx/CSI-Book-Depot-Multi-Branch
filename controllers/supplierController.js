// server/controllers/supplierController.js
const mongoose = require("mongoose");

/**
 * Helper: escape regex special chars
 */
const escapeRegex = (text = "") => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getNextSupplierIdUtil = async (Counter, shopId, session = null) => {

  const counterKey = `supplier:${shopId}`;

  const counter = await Counter.findOneAndUpdate(
    { name: counterKey },
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true,
      session
    }
  );

  const seq = counter.seq.toString().padStart(5, "0");

  return `S${seq}`;
};



const previewNextSupplierId = async (Counter, shopId) => {

  const counterKey = `supplier:${shopId}`;

  const counter = await Counter.findOne({ name: counterKey }).lean();

  const nextSeq = (counter?.seq || 0) + 1;

  const seq = nextSeq.toString().padStart(5, "0");

  return `S${seq}`;
};

/**
 * Generate next supplierId for the shop in format SYY-N
 * e.g. S25-1, S25-2 ...
 * NOTE: not strictly atomic — we choose the last inserted for the year and increment.
 * For strict atomic sequences, use a Counter collection and transactions.
 */
const getNextSupplierId = async (req, res) => {
  try {
    const { Counter } = req.tenantModels;
    const shopId = req.user?.shopId || req.shop?._id;

    if (!shopId)
      return res.status(400).json({ message: "Shop context missing" });

    const nextSupplierId = await previewNextSupplierId(Counter, shopId);

    res.json({ nextSupplierId });
  } catch (err) {
    console.error("❌ getNextSupplierId error:", err);
    res.status(500).json({
      message: "Failed to get next supplier id",
      error: err.message,
    });
  }
};

/**
 * GET /api/suppliers
 * Query: page, limit, search, status ("all"|"active"|"inactive")
 * Search placeholder: id, name, mobile, gstin
 */
const getSuppliers = async (req, res) => {
  try {
    const { Supplier } = req.tenantModels;
    const shopId = req.user?.shopId || req.shop?._id;
    if (!shopId) return res.status(400).json({ message: "Shop context missing" });

    const page = Math.max(1, Number(req.query.page) || 1);
    const limitParam = Number(req.query.limit);
    const limit = limitParam > 0 ? limitParam : 10;
    const skip = (page - 1) * limit;

    const search = (req.query.search || "").trim();
    const statusFilter = (req.query.status || "all").toLowerCase();

    const query = { shop: shopId };

    if (statusFilter === "active") query.status = "active";
    else if (statusFilter === "inactive") query.status = "inactive";

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      query.$or = [
        { supplierId: regex },
        { name: regex },
        { mobile: regex },
        { gstin: regex },
      ];
    }

    const total = await Supplier.countDocuments(query);
    let suppliersQuery = Supplier.find(query).sort({ status: -1, createdAt: -1 }); // active (by enum) first, then newest

    suppliersQuery = suppliersQuery.skip(skip).limit(limit);

    const suppliers = await suppliersQuery.lean();

    res.json({
      suppliers,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      total,
    });
  } catch (err) {
    console.error("❌ getSuppliers error:", err);
    res.status(500).json({ message: "Failed to fetch suppliers", error: err.message });
  }
};

/**
 * POST /api/suppliers
 * body: { supplierId (optional), name, mobile, gstin, address }
 * If supplierId not provided -> generate next and insert
 */
const createSupplier = async (req, res) => {
  try {
    const { Supplier } = req.tenantModels;
    const shopId = req.user?.shopId || req.shop?._id;
    if (!shopId) return res.status(400).json({ message: "Shop context missing" });

    const data = req.body;
    if (!data.name || !data.mobile) {
      return res.status(400).json({ message: "Name and mobile are required" });
    }
    if (!/^\d{10}$/.test(String(data.mobile))) {
      return res.status(400).json({ message: "Mobile must be 10 digits" });
    }

    // compute supplierId if not provided
    // let supplierId = data.supplierId;

    // 🔐 ALWAYS generate supplierId on backend if creating new
    const supplierId = await getNextSupplierIdUtil(
      req.tenantModels.Counter,
      shopId
    );



    const doc = new Supplier({
      shop: shopId,
      supplierId,
      name: data.name,
      mobile: data.mobile,
      gstin: data.gstin || "",
      address: data.address || "",
      status: data.status || "active",
    });

    await doc.save();

    res.status(201).json(doc);
  } catch (err) {
    console.error("❌ createSupplier error:", err);
    res.status(500).json({ message: "Failed to create supplier", error: err.message });
  }
};

/**
 * GET /api/suppliers/:id  (id = mongo _id)
 */
const getSupplier = async (req, res) => {
  try {
    const { Supplier } = req.tenantModels;
    const shopId = req.user?.shopId || req.shop?._id;
    const id = req.params.id;
    if (!shopId) return res.status(400).json({ message: "Shop context missing" });

    const supplier = await Supplier.findOne({ shop: shopId, _id: id }).lean();
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });

    res.json(supplier);
  } catch (err) {
    console.error("❌ getSupplier error:", err);
    res.status(500).json({ message: "Failed to fetch supplier", error: err.message });
  }
};

/**
 * PATCH /api/suppliers/:id
 * body: { name, mobile, gstin, address, status }
 * supplierId is NOT editable
 */
const updateSupplier = async (req, res) => {
  try {
    const { Supplier } = req.tenantModels;
    const shopId = req.user?.shopId || req.shop?._id;
    const id = req.params.id;
    if (!shopId) return res.status(400).json({ message: "Shop context missing" });

    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.mobile !== undefined) {
      if (!/^\d{10}$/.test(String(req.body.mobile))) {
        return res.status(400).json({ message: "Mobile must be 10 digits" });
      }
      updates.mobile = req.body.mobile;
    }
    if (req.body.gstin !== undefined) updates.gstin = req.body.gstin;
    if (req.body.address !== undefined) updates.address = req.body.address;
    if (req.body.status !== undefined && ["active", "inactive"].includes(req.body.status)) {
      updates.status = req.body.status;
    }

    const updated = await Supplier.findOneAndUpdate(
      { shop: shopId, _id: id },
      { $set: updates },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Supplier not found" });

    res.json(updated);
  } catch (err) {
    console.error("❌ updateSupplier error:", err);
    res.status(500).json({ message: "Failed to update supplier", error: err.message });
  }
};

module.exports = {
  getSuppliers,
  createSupplier,
  getSupplier,
  updateSupplier,
  getNextSupplierId,
  getNextSupplierIdUtil,
  previewNextSupplierId,
};
