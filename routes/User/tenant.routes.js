// server/routes/User/tenant.routes.js
const express = require("express");
const { authMiddleware } = require("../../core/auth");
const { permit } = require("../../core/rbac");
const { tenantResolver } = require("../../core/tenantResolver");

const router = express.Router();

// All routes pass through tenantResolver to get req.db
router.use(authMiddleware);
router.use(tenantResolver);
router.use(permit("user", "manager"));

// Example CRUD for tenant data
router.get("/todos", async (req, res) => {
  const Todo = req.db.model("Todo", new req.db.Schema({
    title: String,
    completed: Boolean
  }));
  const todos = await Todo.find();
  res.json(todos);
});

router.post("/todos", async (req, res) => {
  const Todo = req.db.model("Todo", new req.db.Schema({
    title: String,
    completed: Boolean
  }));
  const todo = await Todo.create(req.body);
  res.json(todo);
});

module.exports = router;
