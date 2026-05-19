

//models/Purchase.js
 const mongoose = require("mongoose");
const PurchaseSchema = new mongoose.Schema(
  {
    orderNo: { type: String, required: true },

    supplierId: { type: String },
    supplierName: { type: String, required: true },
    supplierMobile: { type: String },

    invoiceNo: { type: String, required: true },
    invoiceDate: { type: Date, required: true },
    stockedDate: { type: Date, required: true },

    noOfItems: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },

    batches: [
      {
        code: String,
        name: String,
        batchNo: String,
        mrp: Number,
        rate: Number,
        gst: Number,
        qty: Number,
        value: Number,
        taxMode: String,
      }
    ],

    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
  },
  { timestamps: true }
);
 module.exports = mongoose.model("Purchase", PurchaseSchema);
