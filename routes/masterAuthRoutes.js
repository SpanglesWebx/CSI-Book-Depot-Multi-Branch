// routes/masterAuthRoutes.js
const express = require("express");
const router = express.Router();
const MasterUser = require("../models/MasterUser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Shop = require("../models/Shop");

function generateToken(user) {
  return jwt.sign(
    { id: user._id, username: user.username, role: user.role, shopname: user.shopname, type: "master" },
    process.env.MASTER_JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Master Register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, shopname, role } = req.body;
    if (!username || !email || !password || !shopname)
      return res.status(400).json({ message: "Missing required fields" });

    const existingUser = await MasterUser.findOne({ $or: [{ username }, { email }] });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    // const hashedPassword = await bcrypt.hash(password, 10);
    const masterUser = await MasterUser.create({ username, email, password, shopname, role });

    const token = generateToken(masterUser);
    res.status(201).json({ user: { id: masterUser._id, username, email, shopname, role }, token });
  } catch (err) {
    res.status(500).json({ message: "Failed to create master user" });
  }
});

// Master Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const masterUser = await MasterUser.findOne({ username });
    if (!masterUser) return res.status(404).json({ message: "User not found" });

    const isMatch = await masterUser.matchPassword(password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });

    const token = generateToken(masterUser);
    res.json({ token, user: { id: masterUser._id, username, email: masterUser.email, role: masterUser.role, shopname: masterUser.shopname } });
  } catch (err) {
    res.status(500).json({ message: "Login failed" });
  }
});



// router.post("/login", async (req, res) => {
//   try {
//     const { username, password } = req.body;
//     const masterUser = await MasterUser.findOne({ username });

//     if (!masterUser) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     let isMatch = await masterUser.matchPassword(password);

//     // 🔥 HANDLE OLD PLAIN PASSWORD USERS
//     if (!isMatch && masterUser.password === password) {
//       console.log("⚠️ Upgrading plain password to hashed...");

//       masterUser.password = password; // triggers pre-save hash
//       await masterUser.save();

//       isMatch = true;
//     }

//     if (!isMatch) {
//       return res.status(401).json({ message: "Invalid password" });
//     }

//     const token = generateToken(masterUser);

//     res.json({
//       token,
//       user: {
//         id: masterUser._id,
//         username,
//         email: masterUser.email,
//         role: masterUser.role,
//         shopname: masterUser.shopname,
//       },
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Login failed" });
//   }
// });
module.exports = router;
