// utils/getNextBillNo.js
const Counter = require("../models/Counterbillno").model;

/**
 * Generate next bill number for a specific tenant/shop
 * @param {string} tenantName
 * @returns {string} formatted bill number, e.g. "B001"
 */
async function getNextBillNo(tenantName) {
  if (!tenantName) throw new Error("Tenant name is required for bill numbers");

  const counterName = `bill_${tenantName}`;

  const counter = await Counter.findOneAndUpdate(
    { name: counterName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return "B" + counter.seq.toString().padStart(3, "0");
}

module.exports = getNextBillNo;
