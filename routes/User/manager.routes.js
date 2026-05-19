// server/routes/User/manager.routes.js
const express = require("express");
const { authMiddleware } = require("../../core/auth");
const { permit } = require("../../core/rbac");

const router = express.Router();

// Manager can view + control across tenants
router.get("/dashboard", authMiddleware, permit("manager"), (req, res) => {
  res.json({ message: "Manager dashboard with full access" });
});

// Example: CRUD on tenants (full control)
router.post("/create-tenant", authMiddleware, permit("manager"), (req, res) => {
  res.json({ message: "Tenant created" });
});

module.exports = router;
