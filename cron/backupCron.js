const cron = require("node-cron");
const runBackup = require("./backup");
const runRestore = require("./restore");

let isRunning = false;

module.exports = function () {

  console.log("🕛 Cron Started");

  // 🕕 6 PM → Backup + Restore
  cron.schedule("0 18 * * *", async () => {

    // cron.schedule("* * * * *", async () => {

    if (isRunning) return;

    try {
      isRunning = true;

      console.log("🕕 Backup + Restore Running");

      await runRestore();
      await runBackup();

    } finally {
      isRunning = false;
    }

  }, { timezone: "Asia/Kolkata" });


  // 🌅 6 AM → Restore only
  cron.schedule("0 6 * * *", async () => {
    // cron.schedule("* * * * *", async () => {

    console.log("🌅 Morning Restore");

    await runRestore();

  }, { timezone: "Asia/Kolkata" });

};