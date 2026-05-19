// routes/productRoutes.js
const express = require("express");
const router = express.Router();
const {
  searchProductsByName,
  searchProductsByCode,
} = require("../controllers/ProductSearchController");

const tenantAuth = require("../middleware/tenantAuth");
const tenantMiddleware = require("../middleware/tenantMiddleware");

router.get("/search", tenantAuth, tenantMiddleware,searchProductsByName);
router.get("/search-by-code",tenantAuth, tenantMiddleware, searchProductsByCode);

module.exports = router;
