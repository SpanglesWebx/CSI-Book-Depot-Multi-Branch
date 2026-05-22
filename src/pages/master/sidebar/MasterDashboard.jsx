
// src/pages/master/sidebar/MasterDashboard.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FaBoxOpen, FaExclamationTriangle, FaFileInvoice } from "react-icons/fa";
import { useAuth } from "../../../context/AuthContext";
import apiClient from "../../../utils/apiClient";
import { useNavigate } from "react-router-dom";
import { useShop } from "../../../context/ShopContext";



const PRIMARY = "#00A76F"; ``

const cardHover = {
  scale: 1.02,
  boxShadow: `0 12px 30px -12px rgba(0,167,111,0.28), 0 6px 18px -10px rgba(0,120,103,0.08)`,
};

export default function MasterDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [shops, setShops] = useState([]);
  const [shopStats, setShopStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [salesRange, setSalesRange] = useState("today");

  const token = user?.token || localStorage.getItem("token");

  const { setSelectedShop } = useShop();


  useEffect(() => {
    fetchShops();
  }, []);

  useEffect(() => {
    if (shops.length > 0) {
      fetchAllStats(salesRange);
      const interval = setInterval(() => fetchAllStats(salesRange), 20000);
      return () => clearInterval(interval);
    }
  }, [shops, salesRange]);

  const fetchShops = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/shops`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = res?.data?.shops || res?.data?.list || [];
      setShops(list);
    } catch (err) {
      console.error("fetchShops error:", err.response?.data || err.message);
      setError("Failed to load shops");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStats = async (range = "today") => {
    if (!shops || shops.length === 0) return;
    const results = {};

    await Promise.all(
      shops.map(async (shop) => {
        const shopName = shop.shopname?.trim();
        if (!shopName) return;
        try {
          const [prodRes, saleRes] = await Promise.all([
            apiClient.get(`/api/shops/${shopName}/dashboard/product-total`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            apiClient.get(`/api/shops/${shopName}/dashboard/sales-bills/summary?period=${range}`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

          const data = prodRes.data || {};
          const products = data.products || [];
          const totalProducts = data.totalProducts || products.length || 0;
          const lowStockCount = products.reduce((count, p) => {
            const batches = p.batches || [];
            const totalQty = batches.reduce((sum, b) => sum + Number(b.qty || 0), 0);
            const minQty = Number(p.minQty || 0);
            return count + (totalQty <= minQty ? 1 : 0);
          }, 0);

          const totalBills = saleRes?.data?.totalBills ?? 0;
          const totalAmount = saleRes?.data?.totalNetAmount ?? 0;

          results[shopName] = {
            totalProducts,
            lowStockCount,
            totalBills,
            totalAmount,
          };
        } catch (err) {
          console.error(`Error fetching stats for ${shop.shopname}:`, err.message);
        }
      })
    );

    setShopStats(results);
  };

  const formatCurrency = (n) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);


  const handleSelectShop = (shop) => {
    setSelectedShop({
      _id: shop._id,
      shopname: shop.shopname,
      designation: shop.designation || "",
    });
    // pushToast(`Selected shop: ${shop.shopname}`);

    navigate("/user-dashboard");
  };

  return (
    <div className="pt-10 sm:pt-10 px-4">
      <div className="max-w-full mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <h1 className=" text-2xl sm:text-3xl font-bold mb-6   text-[28px]  text-[#00a76f] ">Dashboard</h1>
          <div>
            <select
              value={salesRange}
              onChange={(e) => setSalesRange(e.target.value)}
              className="text-sm border rounded px-3 py-2"
            >
              <option value="today">Today</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        {error && <div className="text-red-600 font-medium mb-4">{error}</div>}

        {loading ? (
          <div className="text-center text-green-500">Loading shops...</div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {shops.map((shop) => {
              const s = shopStats[shop.shopname] || {};
              return (
                <motion.div
                  key={shop._id}
                  whileHover={cardHover}
                  className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 cursor-pointer"

                  onClick={() => handleSelectShop(shop)}

                >
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-700">{shop.shopname}</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Total Products */}
                    <div
                      className="rounded-2xl p-4 shadow-sm text-center"
                      style={{
                        background: "linear-gradient(320deg, rgba(211, 252, 210, 0.7) 0%, #ffffff 70%)",
                      }}
                    >
                      <div className="text-xs uppercase text-gray-600">Total Products</div>
                      <div className="mt-3 text-2xl font-semibold" style={{ color: PRIMARY }}>
                        {s.totalProducts ?? "..."}
                      </div>
                      <div className="mt-3 text-2xl" style={{ color: PRIMARY }}>
                        <FaBoxOpen />
                      </div>
                    </div>

                    {/* Low Stock */}
                    <div
                      className="rounded-2xl p-4 shadow-sm text-center"
                      style={{
                        background: "linear-gradient(320deg, rgba(255, 205, 210, 0.7) 0%, #ffffff 70%)",
                      }}
                    >
                      <div className="text-xs uppercase text-gray-600">Low Stock</div>
                      <div className="mt-3 text-2xl font-semibold text-red-500">
                        {s.lowStockCount ?? "..."}
                      </div>
                      <div className="mt-3 text-2xl text-red-500">
                        <FaExclamationTriangle />
                      </div>
                    </div>

                    {/* Total Sales */}
                    <div
                      className="rounded-2xl p-4 shadow-sm text-center"
                      style={{
                        background: "linear-gradient(320deg, rgba(201, 253, 245, 0.7) 0%, #ffffff 70%)",
                      }}
                    >
                      <div className="text-xs uppercase text-gray-600">Total Sales</div>
                      <div className="mt-3 text-2xl font-semibold" style={{ color: PRIMARY }}>
                        {s.totalAmount ? formatCurrency(s.totalAmount) : "..."}
                      </div>
                      <div className="mt-3 flex items-center justify-center gap-2 text-gray-600 font-medium">
                        <FaFileInvoice style={{ color: PRIMARY }} />
                        <span style={{ color: PRIMARY }}>{s.totalBills ?? 0} Bills</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
