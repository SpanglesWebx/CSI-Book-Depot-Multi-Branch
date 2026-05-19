// utils/peekNextOrderNo.js
const Counter = require("../models/Counter").model;

/**
 * Returns the *next* order number for display — without incrementing.
 */
async function peekNextOrderNo(shopname) {
  if (!shopname) throw new Error("Shopname is required");

  const counterName = `order_${shopname}`;

  const counter = await Counter.findOne({ name: counterName });
  const nextSeq = counter ? counter.seq + 1 : 1;

  return "ORDER" + nextSeq.toString().padStart(3, "0");
}

module.exports = peekNextOrderNo;
