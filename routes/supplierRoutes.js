// server/routes/supplierRoutes.js
const express = require("express");
const router = express.Router();
const tenantAuth = require("../middleware/tenantAuth");
const supplierController = require("../controllers/supplierController");

// All tenant-protected
router.get("/", tenantAuth, supplierController.getSuppliers);
router.post("/", tenantAuth, supplierController.createSupplier);
router.get("/next-supplier-id", tenantAuth, supplierController.getNextSupplierId);

router.get("/:id", tenantAuth, supplierController.getSupplier);
router.patch("/:id", tenantAuth, supplierController.updateSupplier);

module.exports = router;
