// server/routes/expenseRoutes.js
const express = require("express");
const router = express.Router();
const tenantAuth = require("../middleware/tenantAuth");
const expenseCtrl = require("../controllers/expenseController");

// /api/expenses/next-receipt
router.get("/next-receipt", tenantAuth, expenseCtrl.getNextReceiptNo);

// /api/expenses
router.get("/", tenantAuth, expenseCtrl.listExpenses);
router.post("/", tenantAuth, expenseCtrl.createExpense);

module.exports = router;
