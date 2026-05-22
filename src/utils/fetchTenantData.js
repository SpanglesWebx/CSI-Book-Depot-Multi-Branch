import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Safely fetch tenant/shop data from API
 * @param {string} shopname - Name of the shop/tenant
 * @param {string} endpoint - API endpoint, e.g., "products" or "orders"
 * @returns {Promise<any>} - API response data
 */
export async function fetchTenantData(shopname, endpoint) {
  if (!shopname) {
    console.warn("fetchTenantData: shopname is undefined!");
    return null;
  }

  const url = `${API_BASE}/api/tenant/shops/${encodeURIComponent(shopname)}/${endpoint}`;

  try {
    const res = await axios.get(url);
    return res.data;
  } catch (err) {
    console.error(`fetchTenantData error [${url}]:`, err.message);
    return null;
  }
}
