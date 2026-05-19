
//controllers/ userController.js
const Shop = require("../models/Shop");
const { getTenantDB } = require("../config/tenantManager");
const getTenantModels = require("../models/tenantModels");


exports.getUsers = async (req, res) => {
  try {
    let { search = "", status = "", page = 1, limit = 10, username } = req.query;
    page = Number(page);
    limit = Number(limit);

    const shops = await Shop.find({});
    let allUsers = [];

    for (const shop of shops) {
      const tenantConn = await getTenantDB(shop.shopname, shop.tenantDbUri);
      const { User } = getTenantModels(tenantConn);

      let query = {};
      if (username) {
        query.username = username.trim(); // exact match
      }

      const users = await User.find(query).sort({ createdAt: -1 }).lean();
      const usersWithShop = users.map((u) => ({ ...u, shopname: shop.shopname }));
      allUsers = [...allUsers, ...usersWithShop];
    }

    // Existing search filter (optional)
    if (!username && search) {
      const searchLower = search.toLowerCase();
      allUsers = allUsers.filter(
        (u) =>
           (u.name && u.name.toLowerCase().includes(searchLower)) ||
          (u.username && u.username.toLowerCase().includes(searchLower)) ||
          (u.mobileNumber && u.mobileNumber.toLowerCase().includes(searchLower)) ||
          (u.shopname && u.shopname.toLowerCase().includes(searchLower))
      );
    }

    // Status filter
    if (status) {
      const statusLower = status.toLowerCase();
      allUsers = allUsers.filter((u) => (u.status || "active").toLowerCase() === statusLower);
    }

    const totalUsers = allUsers.length;
    const totalPages = Math.ceil(totalUsers / limit);
    const start = (page - 1) * limit;
    const end = start + limit;

    const paginatedUsers = allUsers.slice(start, end);

    res.json({
      users: paginatedUsers,
      totalUsers,
      totalPages,
      page,
      usernameExists: username ? allUsers.length > 0 : undefined, // ✅ global username check flag
    });
  } catch (err) {
    console.error("getUsers error:", err);
    res.status(500).json({ message: "Failed to fetch users", error: err.message });
  }
};

/**
 * ADD tenant user
 */

exports.addUser = async (req, res) => {
  try {
    const { name, username, mobileNumber, password, role, shopname } = req.body;

    if (!name || !username || !password || !role || !shopname)
      return res.status(400).json({ message: "All required fields must be provided" });


    const shop = await Shop.findOne({ shopname });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    // ✅ Check username globally across all shops
    const shops = await Shop.find({});
    for (const s of shops) {
      const tenantConn = await getTenantDB(s.shopname, s.tenantDbUri);
      const { User } = getTenantModels(tenantConn);

      const exists = await User.findOne({ username: username.trim() });
      if (exists) {
        return res.status(400).json({
          message: "Username already exists in another shop",
          field: "username",
        });
      }
    }

    // Create user in current shop
    const tenantConn = await getTenantDB(shopname, shop.tenantDbUri);
    const { User } = getTenantModels(tenantConn);

    const user = await User.create({
      name,
      username: username.trim(),
      mobileNumber: mobileNumber || "",
      password, // consider hashing in production!
      role,
      shopname,
      status: "active",
    });

    res.status(201).json({ message: "Tenant user created", user });
  } catch (err) {
    console.error("addUser error:", err);
    res.status(500).json({ message: "Failed to add user", error: err.message });
  }
};


/**
 * UPDATE tenant user
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, mobileNumber, password, role, status, shopname } = req.body;

    if (!shopname) return res.status(400).json({ message: "shopname required" });

    const shop = await Shop.findOne({ shopname });
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const tenantConn = await getTenantDB(shopname, shop.tenantDbUri);
    const { User } = getTenantModels(tenantConn);

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (name) user.name = name;
    if (username) user.username = username;
    if (mobileNumber) user.mobileNumber = mobileNumber;
    if (role) user.role = role;
    if (status) user.status = status;
    if (password) user.password = password;

    await user.save();
    res.json({ message: "Tenant user updated", user });
  } catch (err) {
    console.error("updateUser error:", err);
    res.status(500).json({ message: "Failed to update user" });
  }
};
