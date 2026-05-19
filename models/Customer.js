// server/models/Customer.js
const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
     shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

module.exports = {
  schema: customerSchema,                  // ✅ export schema
  model: mongoose.model("Customer", customerSchema)  // ✅ export model (optional global use)
};