
//utils/apiClient.js
import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Attach shopname for tenants
  const shopname = localStorage.getItem("shopname");
  if (shopname) config.headers["x-shopname"] = shopname;

  return config;
});

export default apiClient;



