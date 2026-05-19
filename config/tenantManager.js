

// config/tenantManager.js
const mongoose = require("mongoose");
const { generateTenantUri } = require("./tenantUtils");

const connections = {};

async function getTenantDB(shopname, tenantDbUri) {
  const decodedShopname = decodeURIComponent(shopname.trim());

  if (connections[decodedShopname]) {
    return connections[decodedShopname];
  }

  const tenantUri = generateTenantUri(decodedShopname, tenantDbUri);

  try {
    console.log(`🔹 Connecting to tenant DB for ${decodedShopname}...`);
    console.log("Tenant URI:", tenantUri);

    const conn = await mongoose.createConnection(tenantUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }).asPromise();

    connections[decodedShopname] = conn;

    console.log(`🏪 Tenant DB connected → ${conn.name}`);
    console.log(`✅ Tenant DB connected for ${decodedShopname}`);
    

    return conn;
  } catch (err) {
    console.error(`❌ Failed to connect tenant DB for ${decodedShopname}:`, err.message);
    throw err;
  }
}

module.exports = { getTenantDB };