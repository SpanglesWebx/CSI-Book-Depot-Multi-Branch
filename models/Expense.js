// server/models/Expense.js
const mongoose = require("mongoose");

const ExpenseSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },

    date: { type: Date, required: true },

    // R25-1, R25-2, etc. (per year)
    receiptNo: { type: String, required: true },

    reason: { type: String, default: "" },

    amount: { type: Number, required: true, default: 0 },

        category: { type: String, default: "" },
    spendTo: { type: String, default: "" },


    // bill | voucher
    refType: {
      type: String,
      enum: ["bill", "voucher"],
      default: "bill",
    },

    // bill / voucher number
    refNumber: { type: String, default: "" },

    // who added it
    addedByName: { type: String, default: "" },
    addedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Expense", ExpenseSchema);
