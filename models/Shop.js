// models/Shop.js
const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema(
  {
    shopname: { type: String, required: true, unique: true },
    designation: { type: String },
    address: { type: String },
    contact: { type: String },
    tenantDbUri: { type: String, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);


module.exports =
  mongoose.models.Shop || mongoose.model("Shop", shopSchema);