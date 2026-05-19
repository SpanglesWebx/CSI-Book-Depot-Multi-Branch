

// utils/getNextOrderNo.js
const Counter = require("../models/Counter").model;

/**
 * Generate or preview next order number for a shop, with year reset
 * @param {string} shopname - Unique identifier of the shop
 * @param {boolean} increment - true = increment counter, false = preview only
 * @returns {string} e.g., ORDER25-001
 */
async function getNextOrderNo(shopname, increment = true) {
  if (!shopname) throw new Error("Shopname is required");

  // Get current year’s last two digits, e.g., 2025 → "25"
  const currentYear = new Date().getFullYear().toString().slice(-2);

  // Counter key includes year + shop to reset every year
  const counterName = `order_${shopname}_${currentYear}`;

  if (increment) {
    // ✅ Atomic increment or create counter if it doesn’t exist
    const counter = await Counter.findOneAndUpdate(
      { name: counterName },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Format: ORDER25-1, ORDER25-2, etc.
    return `ORDER${currentYear}-${counter.seq}`;
  } else {
    // Preview next number without incrementing
    const counter = await Counter.findOne({ name: counterName });
    const nextSeq = counter ? counter.seq + 1 : 1;
    return `ORDER${currentYear}-${nextSeq}`;
  }
}

module.exports = getNextOrderNo;
