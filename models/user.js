// models/user.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    name: { type: String, required: true },
    mobileNumber: { type: String }, // optional
    password: { type: String, required: true }, // stored as plain text
    shopname: { type: String, required: true },
    role: { type: String, default: "user" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);



const User = mongoose.model("User", userSchema);
module.exports = User;
module.exports.schema = userSchema;
