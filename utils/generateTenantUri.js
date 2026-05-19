function generateTenantUri(shopname) {
  const base = process.env.TENANT_DB_URI; 
  return `${base}/${shopname}_db`;  
}

module.exports = { generateTenantUri };
