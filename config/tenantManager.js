

// config/tenantManager.js
const mongoose = require("mongoose");
const { generateTenantUri } = require("./tenantUtils");

const connections = {};

async function getTenantDB(shopname, tenantDbUri) {
  const decodedShopname = decodeURIComponent(shopname.trim());

  if (connections[decodedShopname]) {
    return connections[decodedShopname];
  }

  // In non-production (development) force use of the dev base URI from env
  // to prevent accidentally connecting to live tenant DBs during development.
  const baseUri = process.env.NODE_ENV === "production" ? tenantDbUri : process.env.TENANT_DB_URI || tenantDbUri;
  if (baseUri !== tenantDbUri) {
    console.log("⚠️ Development mode: overriding shop tenantDbUri with local TENANT_DB_URI to avoid live DB writes.");
  }

  const tenantUri = generateTenantUri(decodedShopname, baseUri);

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