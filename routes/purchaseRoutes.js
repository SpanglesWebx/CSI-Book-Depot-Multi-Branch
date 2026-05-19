

// server/routes/purchaseRoutes.js
const express = require("express");
const router = express.Router();
const tenantAuth = require("../middleware/tenantAuth");
const purchaseCtrl = require("../controllers/purchaseController");

// tenant-protected
router.get("/next-order-no", tenantAuth, purchaseCtrl.getNextOrderNo);
router.post("/", tenantAuth, purchaseCtrl.createPurchase);
router.get("/", tenantAuth, purchaseCtrl.listPurchases);
// PATCH to update (status or other editable fields)
router.patch("/:id", tenantAuth, purchaseCtrl.updatePurchase);

module.exports = router;
