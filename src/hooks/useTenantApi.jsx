
// src/hooks/useTenantApi.jsx
import { useContext, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { ShopContext } from "../context/ShopContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function useTenantApi() {
  const { selectedShop } = useContext(ShopContext);
  const { user, getMasterToken, getTenantToken } = useAuth();

  // Helper to get headers
  const getHeaders = useCallback(() => {
    const token = user?.type === "master" ? getMasterToken() : getTenantToken();
    return {
      Authorization: `Bearer ${token}`,
      "x-shop-id": selectedShop?._id || "",
      "x-shop-name": selectedShop?.shopname || "",
    };
  }, [user, getMasterToken, getTenantToken, selectedShop]);

  // Safe GET request
  const get = useCallback(
    async (endpoint, signal) => {
      if (!selectedShop?.shopname) throw new Error("No shop selected");
      const encodedShopname = encodeURIComponent(selectedShop.shopname);

      try {
        const res = await axios.get(`${API_BASE}/api/tenant/shops/${encodedShopname}/${endpoint}`, {
          headers: getHeaders(),
          signal,
        });
        return res.data || [];
      } catch (err) {
        if (axios.isCancel(err)) return [];
        console.warn(`GET ${endpoint} failed:`, err.response?.data?.message || err.message);
        throw err;
      }
    },
    [selectedShop, getHeaders]
  );

  // Safe POST request
  const post = useCallback(
    async (endpoint, payload) => {
      if (!selectedShop?.shopname) throw new Error("No shop selected");
      const encodedShopname = encodeURIComponent(selectedShop.shopname);

      try {
        const res = await axios.post(`${API_BASE}/api/tenant/shops/${encodedShopname}/${endpoint}`, payload, {
          headers: getHeaders(),
        });
        return res.data;
      } catch (err) {
        console.warn(`POST ${endpoint} failed:`, err.response?.data?.message || err.message);
        throw err;
      }
    },
    [selectedShop, getHeaders]
  );

  // Safe PATCH request
  const patch = useCallback(
    async (endpoint, payload) => {
      if (!selectedShop?.shopname) throw new Error("No shop selected");
      const encodedShopname = encodeURIComponent(selectedShop.shopname);

      try {
        const res = await axios.patch(`${API_BASE}/api/tenant/shops/${encodedShopname}/${endpoint}`, payload, {
          headers: getHeaders(),
        });
        return res.data;
      } catch (err) {
        console.warn(`PATCH ${endpoint} failed:`, err.response?.data?.message || err.message);
        throw err;
      }
    },
    [selectedShop, getHeaders]
  );

  return { get, post, patch };
}
