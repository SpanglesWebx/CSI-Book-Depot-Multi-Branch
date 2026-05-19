

// routes/salesBillRoutes.js
const express = require("express");
const {
  getSalesBills,
  getSalesBillById,
  createSalesBill,
  updateSalesBill,
  deleteSalesBill,
  getNextBillNo,
} = require("../controllers/salesBillController");

const tenantAuth = require("../middleware/tenantAuth");       // ✅ auth
const tenantMiddleware = require("../middleware/tenantMiddleware");

const router = express.Router();

// Attach tenantAuth and tenantMiddleware to all routes
router.use(tenantAuth, tenantMiddleware);

// GET next bill number
router.get("/next-billno", getNextBillNo);

// CRUD routes
router.route("/")
  .get(getSalesBills)
  .post(createSalesBill);

router.route("/:id")
  .get(getSalesBillById)
  .put(updateSalesBill)
  .delete(deleteSalesBill);

module.exports = router;
