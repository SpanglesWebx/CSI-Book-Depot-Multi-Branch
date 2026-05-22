


// src/utils/axiosInstance.js
import axios from "axios";
import { toast } from "react-toastify";


const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const axiosInstance = axios.create({
  baseURL: API,
  withCredentials: true,
});

// 🔑 Attach token + shopname automatically
axiosInstance.interceptors.request.use((config) => {
  const masterToken = localStorage.getItem("masterToken");
const tenantToken = localStorage.getItem("tenantToken");
const token = masterToken || tenantToken;

  // const token = localStorage.getItem("token"); 
  const user = JSON.parse(localStorage.getItem("user"));

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (user?.shopname) {
    config.headers["x-shopname"] = user.shopname;
  }

  return config;
});





// 🚨 Handle Token Expiry
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log("🔥 AXIOS ERROR:", error.response);

    if (error.response?.status === 401) {
      toast.error("Session expired. Please login again.");

      // Dispatch logout event
      window.dispatchEvent(new Event("autoLogout"));
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
