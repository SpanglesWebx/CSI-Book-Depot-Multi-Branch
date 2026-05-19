
// server/routes/categoryRoutes.js
const express = require("express");
const { getCategories, updateCategories } = require("../controllers/categoryController");
const tenantAuth = require("../middleware/tenantAuth");
const tenantMiddleware = require("../middleware/tenantMiddleware");

const router = express.Router();

// ----------------------------
// Tenant API (/api/categories)
// ----------------------------
router.get("/", tenantAuth, tenantMiddleware, getCategories);
router.put("/", tenantAuth, tenantMiddleware, updateCategories);

module.exports = router;


