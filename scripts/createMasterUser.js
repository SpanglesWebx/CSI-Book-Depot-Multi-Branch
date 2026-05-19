const mongoose = require("mongoose");
const dotenv = require("dotenv");
const MasterUser = require("../models/MasterUser");

dotenv.config();

async function createMasterUser() {
  try {
    await mongoose.connect(process.env.MASTER_DB_URI);
    console.log("✅ Connected to MASTER DB");

    // 🔍 Check if already exists
    const existing = await MasterUser.findOne({ email: "webxadmin@gmail.com" });
    if (existing) {
      console.log("⚠️ Master user already exists");
      process.exit();
    }

    // ✅ Create new master user
    const user = new MasterUser({
      username: "WebXAdmin",
      email: "webxadmin@gmail.com",
      password: "Admin@123",
      role: "megaadmin",
      shopname: "WebX Admin",
      status: "active" 
    });

    await user.save();

    console.log("🎉 Master user created with ACTIVE status!");
    process.exit();
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

createMasterUser();