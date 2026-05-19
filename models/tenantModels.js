// server/models/tenantModels.js
const mongoose = require("mongoose");

const modelCache = {};

/**
 * Attach all tenant-specific models to a tenant connection.
 * Uses caching so models are not recompiled on each request.
 *
 * @param {mongoose.Connection} conn - tenant DB connection
 * @returns {Object} tenant models
 */
function getTenantModels(conn) {
  
  if (modelCache[conn.name]) {
    return modelCache[conn.name];
  }

  // Lazy-load schemas to avoid circular requires
  const User = require("./user");
  const Product = require("./Product");
  const Customer = require("./Customer");
  const Order = require("./Order");
  const SalesBill = require("./SalesBill");
  const Category = require("./Category");
  const Counter = require("./Counter");
  const Supplier = require("./Supplier");
    const Purchase = require("./Purchase");
      const Expense = require("./Expense");

  const models = {
    User: conn.models.User || conn.model("User", User.schema),
    Product: conn.models.Product || conn.model("Product", Product.schema),
    Customer: conn.models.Customer || conn.model("Customer", Customer.schema),
    Order: conn.models.Order || conn.model("Order", Order.schema),
    SalesBill: conn.models.SalesBill || conn.model("SalesBill", SalesBill.schema),
    Category: conn.models.Category || conn.model("Category", Category.schema),
    Counter: conn.models.Counter || conn.model("Counter", Counter.schema),
    Supplier: conn.models.Supplier || conn.model("Supplier", Supplier.schema),
    Purchase: conn.models.Purchase || conn.model("Purchase", Purchase.schema),
     Expense: conn.models.Expense || conn.model("Expense", Expense.schema),

  };

  modelCache[conn.name] = models;
  return models;
}

module.exports = getTenantModels;
