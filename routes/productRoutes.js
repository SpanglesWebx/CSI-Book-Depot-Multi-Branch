
// server/routes/productRoutes.js
const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const tenantAuth = require("../middleware/tenantAuth");

// All routes are tenant-protected
router.get("/", tenantAuth, productController.getProducts);   
router.post("/", tenantAuth, productController.createProduct);




// Stock management
router.put("/increment-stock", tenantAuth, productController.incrementStock);
router.put("/decrement-stock", tenantAuth, productController.decrementStock);

// Batches & product codes
router.get("/batches/:code", tenantAuth, productController.getBatchesByCode);
router.get("/code/:code", tenantAuth, productController.getProductByCode);
router.get("/next-code", tenantAuth, productController.getNextProductCode);




// New: update product status
router.patch("/status", tenantAuth, productController.updateProductStatus);

// New: update batch status
router.patch("/batch-status", tenantAuth, productController.updateBatchStatus);


router.get("/low-stock", tenantAuth, productController.getLowStockProducts);


router.get("/search", tenantAuth, productController.searchProductsByName);
router.get("/search-by-code",tenantAuth, productController. searchProductsByCode);

router.patch("/update-product", tenantAuth, productController.updateProductDetails);

router.get("/active", tenantAuth, productController.getActiveProducts);


router.patch("/update", tenantAuth, productController.updateProduct);
router.post("/add-batch", tenantAuth, productController.addBatch);
router.patch("/update-batch-qty", tenantAuth, productController.updateBatchQty);

// server/routes/productRoutes.js,
router.get("/count", async (req, res) => {
  const shopname = req.query.shopname;
  const count = await Product.countDocuments({ shop: shopname });
  res.json({ count });
});


// Update minimum quantity
router.patch("/min-qty", tenantAuth, productController.updateMinQty);


router.get("/scan/:code", tenantAuth, productController.scanBarcode);





module.exports = router;
