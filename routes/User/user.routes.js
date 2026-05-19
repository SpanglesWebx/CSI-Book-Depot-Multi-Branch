// server/routes/User/user.routes.js
const express = require("express");
const { authMiddleware } = require("../../core/auth");
const { permit } = require("../../core/rbac");
const { getAllUsers, getUserById, updateUser, deleteUser } = require("../../controllers/user/userController");

const router = express.Router();

// Admin/Manager can manage users
router.use(authMiddleware);
router.use(permit("manager", "mega_admin"));

// CRUD user
router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

module.exports = router;
