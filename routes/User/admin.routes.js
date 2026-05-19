// server/routes/User/admin.routes.js
const express = require("express");
const { authMiddleware } = require("../../core/auth");
const { permit } = require("../../core/rbac");

const router = express.Router();

// Example: GET /api/admin/tenants
router.get("/tenants", authMiddleware, permit("mega_admin"), (req, res) => {
  res.json({ message: "List of tenants (view only)" });
});

// Example: GET /api/admin/metrics
router.get("/metrics", authMiddleware, permit("mega_admin"), (req, res) => {
  res.json({ message: "Metrics dashboard" });
});

module.exports = router;
