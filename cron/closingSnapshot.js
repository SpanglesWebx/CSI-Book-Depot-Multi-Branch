const cron = require("node-cron");
const Product = require("../models/Product");

module.exports = function startClosingSnapshotCron() {
  console.log("⏳ Daily Closing Snapshot Cron Loaded...");

  // Run every night at 11:59 PM IST
  cron.schedule(
    "59 23 * * *",
    async () => {
      try {
        console.log("🔄 Running Daily Closing Snapshot...");

        const products = await Product.find({});
        const now = new Date(); // timestamp: 11:59 PM IST

        for (const p of products) {
          const stock = Number(p.totalQty || 0);

          p.stockHistory.push({
            date: now,
            openingStock: stock,
            closingStock: stock,
            change: 0,
            reason: "daily-closing",
            batchNo: null,
          });

          await p.save();
        }

        console.log("✅ Daily Closing Snapshot Completed!");

      } catch (err) {
        console.error("❌ Daily Closing Snapshot Error:", err);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

};
    