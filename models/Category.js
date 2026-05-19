// server/models/Category.js
const mongoose = require("mongoose");


const CategorySchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true }, // shop reference at document level
    categories: [
      {
        type: String, // the category name
        required: true,
      },
    ],
  },
  { timestamps: true }
);

module.exports = {
  schema: CategorySchema,
  model: mongoose.models.Category || mongoose.model("Category", CategorySchema),
};
