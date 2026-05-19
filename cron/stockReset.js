



// cron/stockReset.js
const cron = require("node-cron");
const Product = require("../models/Product");

module.exports = function startStockResetCron() {
  console.log("⏳ Daily Opening Stock Snapshot Cron Loaded...");

  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        console.log("🔄 Running Daily Opening Stock Snapshot...");

        const products = await Product.find({});

        const now = new Date(); // 00:00 IST timestamp

        for (const p of products) {
          const stock = Number(p.totalQty || 0);

          // write snapshot
          p.stockHistory.push({
            date: now,
            openingStock: stock,
            closingStock: stock,
            change: 0,
            reason: "daily-opening",
            batchNo: null,
          });

          await p.save();
        }

        console.log("✅ Daily Opening Snapshot Completed!");

      } catch (err) {
        console.error("❌ Daily Opening Snapshot Error:", err);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );
};
