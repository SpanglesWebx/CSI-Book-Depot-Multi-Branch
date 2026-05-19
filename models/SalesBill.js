
//models/SalesBill.js
const mongoose = require("mongoose");



// ---------------------------------------------
// ITEM MOVEMENT SUB-SCHEMA (for master edits)
// ---------------------------------------------
const stockMovementSchema = mongoose.Schema(
  {
    code: String,
    name: String,
    batch: String,

    oldQty: Number,      // qty before this master edit
    newQty: Number,      // qty after this master edit
    deltaQty: Number,    // newQty - oldQty ( +ve = extra sale, -ve = return )

    // Stock snapshot for this movement
    openingStock: Number,  // stock before this edit
    closingStock: Number,  // stock after this edit

    taxable: Number,     // value before GST (optional)
    value: Number,       // line total (incl GST if inclusive)

    direction: {
      type: String,
      enum: ["increase", "decrease"], // increase = stock in (return), decrease = stock out (extra sale)
    },

    reason: {
      type: String,
      enum: ["edit-qty", "row-cancel", "bill-cancel"],
    },

    at: { type: Date, default: Date.now }, // when change happened

    editedBy: String, // username who did master edit
  },
  { _id: false }
);


// ---------------------------------------------
// BILL ITEM SCHEMA
// ---------------------------------------------

const salesItemSchema = mongoose.Schema({
  code: String,
  name: String,
  batch: String,
  mrp: Number,
  rate: Number,
  qty: Number,
  gst: Number,

  // ⭐ NEW FIELDS FOR GST VALUE STORAGE
  taxable: Number,     // value before GST
 
status: { type: String, default: "active" },
  // ⭐ REQUIRED FOR ITEMWISE SALES REPORT
  openingStock: Number,
  closingStock: Number,
  
  value: Number,
   isInclusive: Boolean // inclusive/exclusive flag
});



// ---------------------------------------------
// BILL SCHEMA
// ---------------------------------------------

const salesBillSchema = mongoose.Schema(
  {
     shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    billNo: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    customerName: { type: String, required: true },
    mobile: { type: String },
    counter: { type: Number, default: 1 },
    items: [salesItemSchema],
    total: Number,
    discount: Number,
    netAmount: Number,
    cashGiven: Number,
    balance: Number,

        // discount value
    discountPercent: Number,     // ★ FIX ADDED

    cgst: Number,                // ★ FIX ADDED
    sgst: Number,   // ★ FIX ADDED

    totalGst: Number,


     // ---------- BILL STATUS ----------
    status: {
      type: String,
      enum: ["active", "cancelled"],
      default: "active",
    },


  

    // ---------- PAYMENT ----------
    paymentMethod: {
  type: String,
  enum: ["cash", "upi", "mixed"],   // allow mixed
  default: "cash",
},

payment: {
  cash: { type: Number, default: 0 },
  upi: { type: Number, default: 0 },
},

paymentStatus: {
  type: String,
  enum: ["paid", "partial"],
  default: "paid",
},

// convenience virtuals or fields you may also have:
amountPaid: { type: Number, default: 0 },   // optional persisted
balanceDue: { type: Number, default: 0 },   // optional persisted



    // ---------- MOVEMENT LOG (MASTER EDIT ONLY) ----------
    movements: [stockMovementSchema],



        // ---------------------------------------------------------
    // ⭐ NEW AUDIT FIELDS
    // ---------------------------------------------------------
    createdBy: { type: String },        // username of logged user
    createdById: { type: mongoose.Schema.Types.ObjectId }, // user _id
    counterUser: { type: String },      // user who made bill at counter

    editedBy: { type: String, default: null }, // user who edited bill

    // ---------------------------------------------------------
    // ⭐ NEW DEVICE INFO STORAGE
    // ---------------------------------------------------------
    deviceInfo: {
      ip: { type: String },
      userAgent: { type: String },
      mac: { type: String }, 
    },
  },
  { timestamps: true }
);


salesBillSchema.index({ date: 1 });
salesBillSchema.index({ shop: 1 });
salesBillSchema.index({ "items.code": 1 });



// module.exports = {
//   schema: salesBillSchema,                         
//   model: mongoose.model("SalesBill", salesBillSchema) 
// };


module.exports = {
  name: "SalesBill",
  schema: salesBillSchema
};

