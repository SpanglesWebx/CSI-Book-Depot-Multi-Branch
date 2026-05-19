// server/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const { getUsers, addUser, updateUser } = require("../controllers/userController");
const masterAuth = require("../middleware/masterAuth");

// ✅ Master-only endpoints
router.get("/", masterAuth, getUsers);        // fetch all users (all shops)
router.post("/", masterAuth, addUser);        // add tenant user
router.put("/:id", masterAuth, updateUser);   // update tenant user

// ✅ Update user active/inactive status
router.put("/:id/status", masterAuth, async (req, res) => {
  try {
    const { status } = req.body;

    // validate status
    if (!["active", "inactive"].includes(status.toLowerCase())) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const updated = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });

    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: `User ${status.toUpperCase()} successfully`, user: updated });
  } catch (err) {
    console.error("Update user status error:", err);
    res.status(500).json({ message: "Failed to update status", error: err.message });
  }
});



module.exports = router;
