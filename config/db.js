// config/db.js
const mongoose = require("mongoose");

async function connectMasterDB() {
  try {
    // await mongoose.connect(process.env.MASTER_DB_URI);
        const conn = await mongoose.connect(process.env.MASTER_DB_URI);
    console.log(`🗄️ Master DB connected → ${conn.connection.name}`);
  } catch (err) {
    console.error("❌ Master DB Connection Error:", err);
    process.exit(1); 
  }
}

module.exports = { connectMasterDB };



