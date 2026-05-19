// Maps tenant name to MongoDB URL
const tenantMap = {
  shopkeeper1: process.env.MONGO_SHOP1,
  shopkeeper2: process.env.MONGO_SHOP2,
  shopkeeper3: process.env.MONGO_SHOP3,
  shopkeeper4: process.env.MONGO_SHOP4,
};

const getTenantDB = (tenant) => {
  const uri = tenantMap[tenant];
  if (!uri) throw new Error("Invalid tenant");
  return uri;
};

module.exports = { getTenantDB };
