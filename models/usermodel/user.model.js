// server/models/userModel/user.model.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["megaadmin", "manager", "user"], default: "user" },
  tenantId: { type: String }, 
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);


