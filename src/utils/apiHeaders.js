// src/utils/apiHeaders.js

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Returns headers object containing Authorization and x-shopname.
 * @param {Object} user - Optional user object containing token & shopname. Defaults to localStorage if not provided.
 */
export function getAuthHeaders(user) {
  const token = user?.token || localStorage.getItem("token");
  const shopname = user?.shopname || localStorage.getItem("shopname");

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (shopname) headers["x-shopname"] = shopname;

  return headers;
}

export { API };
