//server/middleware/masterAuth.js
const jwt = require("jsonwebtoken");
const MasterUser = require("../models/MasterUser");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer "))
      return res.status(401).json({ message: "Unauthorized - No token" });

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.MASTER_JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }

    if (decoded.type !== "master")
      return res.status(401).json({ message: "Unauthorized - Wrong token type" });

    const user = await MasterUser.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "Master user not found" });

    req.user = { id: user._id, role: user.role, shopname: user.shopname };
    next();
  } catch (err) {
    console.error("masterAuth error:", err);
    res.status(401).json({ message: "Unauthorized" });
  }
};
