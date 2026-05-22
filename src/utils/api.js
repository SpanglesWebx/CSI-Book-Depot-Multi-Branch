


// src/utils/api.js
export const getApiUrl = (endpoint, user, shopName) => {
  const ep = endpoint.replace(/^\/+/, ""); 
  const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

  // No user → public API
  if (!user) return `${BASE}/api/${ep}`;

  // Tenant user → always tenant DB
  if (user.role === "tenant") {
    return `${BASE}/api/${ep}`;
  }

  // Manager / Megaadmin → access tenant DB via master
  if ((user.role === "manager" || user.role === "megaadmin") && shopName) {
    const safeShop = shopName.trim().toLowerCase();
    return `${BASE}/api/tenant/shops/${encodeURIComponent(safeShop)}/${ep}`;
  }

  // Default fallback
  return `${BASE}/api/${ep}`;
};




import axios from "axios";
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Build API URL safely for tenant/shop endpoints
 * @param {string} endpoint - API endpoint, e.g., "orders" or "products"
 * @param {string} [shopname] - Tenant/shop name
 * @returns {string} Full URL
 */


export const tenantApiUrl = (endpoint, shopname) => {
  if (shopname) {
    // Ensure proper slash between name and endpoint
    const cleanShop = encodeURIComponent(shopname);
    return `${API_BASE}/api/tenant/shops/${cleanShop}/${endpoint}`;
  }
  // fallback to general endpoint
  return `${API_BASE}/api/${endpoint}`;
};

/**
 * Wrapper for GET requests with optional auth
 */
export const apiGet = async (url, token) => {
  try {
    const res = await axios.get(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return res.data;
  } catch (err) {
    console.error(`GET ${url} failed:`, err);
    throw err;
  }
};

/**
 * Wrapper for POST requests with optional auth
 */
export const apiPost = async (url, payload, token) => {
  try {
    const res = await axios.post(url, payload, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return res.data;
  } catch (err) {
    console.error(`POST ${url} failed:`, err.response || err);
    throw err;
  }
};

/**
 * Wrapper for PUT requests with optional auth
 */
export const apiPut = async (url, payload, token) => {
  try {
    const res = await axios.put(url, payload, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return res.data;
  } catch (err) {
    console.error(`PUT ${url} failed:`, err.response || err);
    throw err;
  }
};


/**
 * Wrapper for PATCH requests with optional auth
 */
export const apiPatch = async (url, payload, token) => {
  try {
    const res = await axios.patch(url, payload, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return res.data;   
  } catch (err) {
    console.error(`PATCH ${url} failed:`, err.response || err);
    throw err;
  }
};
