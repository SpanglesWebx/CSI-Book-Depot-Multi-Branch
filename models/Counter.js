
//model/Counter.js
const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ✅ Avoid OverwriteModelError in dev/hot-reload
// const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// module.exports = { schema: counterSchema, model: Counter };



module.exports = {
  name: "Counter",
  schema: counterSchema
};