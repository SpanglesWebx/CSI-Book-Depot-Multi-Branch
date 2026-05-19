

// server/models/Supplier.js
const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    supplierId: { type: String, required: true },  // DO NOT USE unique: true in multi-tenant
    name: { type: String, required: true },
    mobile: { type: String },
    gstin: { type: String },
    address: { type: String },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
  },
  { timestamps: true }
);

// Important: For multi-tenant, DO NOT export global model.
// Tenant system compiles using conn.model()
module.exports = { schema: supplierSchema };
