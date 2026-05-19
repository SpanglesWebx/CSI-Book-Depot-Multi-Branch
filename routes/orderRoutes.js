
const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const tenantAuth = require("../middleware/tenantAuth");
const tenantMiddleware = require("../middleware/tenantMiddleware");

// ✅ All routes protected
router.use(tenantAuth, tenantMiddleware);

router.get("/", orderController.getOrders);
router.get("/:id", orderController.getOrderById);
router.post("/", orderController.createOrder);
router.put("/:id", orderController.updateOrder);
router.put("/:id/confirm", orderController.confirmOrder);
router.put("/:id/status", orderController.updateOrderStatus);
router.delete("/:id", orderController.deleteOrder);

// ✅ Safe endpoint for preview (no increment)
router.get("/next-order-no/preview", orderController.previewNextOrderNo);

module.exports = router;
