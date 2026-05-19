//models/Counterbillno.js
const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  tenant: { type: String, required: true },
  type: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

// Compound index for uniqueness per tenant & type
counterSchema.index({ tenant: 1, type: 1 }, { unique: true });

// ✅ Only create model if not already compiled
// const Counter = mongoose.models.Counter || mongoose.model("Counter2", counterSchema);

// module.exports = Counter;


module.exports = {
  name: "Counter2",
  schema: counterSchema
};