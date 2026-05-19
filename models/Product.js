

// models/Product.js
const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema(
  {
    batchNo: { type: String, required: true },
    qty: { type: Number, default: 0 },
    mrp: { type: Number, default: 0 },
    salePrice: { type: Number, default: 0 },
    value: { type: Number, default: 0 },   // qty * rate
    randomCode: { type: String },
    barcode: { type: String },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
  },
    { _id: false, timestamps: true } 
);




const stockHistorySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true }, // use local date at midnight IST to identify day
    openingStock: { type: Number, default: 0 },
    closingStock: { type: Number, default: 0 },
    change: { type: Number, default: 0 },
    reason: { type: String },   // e.g. "product-create", "batch-add", "purchase", "sale", "daily-rollover"
    batchNo: { type: String, default: null }
  },
{ _id: false } 
);


const productSaleHistorySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },     // exact time
    qty: { type: Number, required: true },    // SOLD qty (positive only)
    billId: { type: mongoose.Schema.Types.ObjectId, ref: "SalesBill" },
    billNo: { type: String },
    counter: { type: Number },
    soldBy: { type: String },                 // counter user / username
    reason: {
      type: String,
      enum: ["sale", "master-edit-sale"],
      default: "sale",
    },
  },
  { _id: false }
);



const productSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },

    // PRODUCT LEVEL
    code: { type: String, required: true },
    name: { type: String, required: true },
    shortName: { type: String },
    category: { type: String },
    taxPercent: { type: Number, default: 0 },     // now product-wise
    taxMode: {
      type: String,
      enum: ["inclusive", "exclusive"],
      default: "exclusive",
    },
    minQty: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
       totalQty: { type: Number, default: 0 },
         totalSoldQty: { type: Number, default: 0 },
       stockHistory: { type: [stockHistorySchema], default: [] },


    // NESTED BATCHES
    batches: { type: [batchSchema], default: [] },

    productSales: { type: [productSaleHistorySchema], default: [] },
// totalSoldQty: { type: Number, default: 0 },   // 🔥 FAST REPORT FIELD


  },        
  { timestamps: true }
);

productSchema.index({ shop: 1, code: 1 }, { unique: true });
productSchema.index({ shop: 1, status: 1 });
productSchema.index({ status: 1, totalQty: 1, minQty: 1 });
productSchema.index({ code: 1 }, { unique: true });
productSchema.index({ "batches.randomCode": 1 });


// module.exports = mongoose.models.Product || mongoose.model("Product", productSchema);


module.exports = {
  name: "Product",
  schema: productSchema
};



