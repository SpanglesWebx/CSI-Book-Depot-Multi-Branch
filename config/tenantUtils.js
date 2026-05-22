// config/tenantUtils.js
const generateTenantUri = (shopname, baseUri) => {
  if (!baseUri) throw new Error("Base tenant DB URI not provided");

  const sanitizedName = shopname.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dbName = `${sanitizedName}_db`;

  let uri = baseUri.trim();

  // Split query parameters
  let query = "";
  if (uri.includes("?")) {
    const parts = uri.split("?");
    uri = parts[0];
    query = parts[1];
  }

  // Remove trailing slash
  uri = uri.replace(/\/+$/, "");

  const finalUri = `${uri}/${dbName}`;

  return query ? `${finalUri}?${query}` : finalUri;
};

module.exports = { generateTenantUri };