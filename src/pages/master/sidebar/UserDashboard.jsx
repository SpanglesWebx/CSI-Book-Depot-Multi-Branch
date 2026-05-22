
// src/pages/master/sidebar/UserDashboard.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FaBoxOpen, FaExclamationTriangle, FaFileInvoice, FaShoppingCart, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { useAuth } from "../../../context/AuthContext";
import { useShop } from "../../../context/ShopContext";
import apiClient from "../../../utils/apiClient";
import { useNavigate } from "react-router-dom";

const PRIMARY = "#00A76F";
const SOFT = "#C8FAD6";

const cardHover = {
  scale: 1.02,
  boxShadow: `0 12px 30px -12px rgba(0,167,111,0.28), 0 6px 18px -10px rgba(0,120,103,0.08)`,
};

export default function TenantDashboard() {
  const { user } = useAuth();
  const { selectedShop } = useShop();
  const navigate = useNavigate();

  const [productsCount, setProductsCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [salesData, setSalesData] = useState({ bills: 0, amount: 0 });
  const [salesRange, setSalesRange] = useState("today");
  const [loading, setLoading] = useState({ products: false, lowstock: false, sales: false });
  const [error, setError] = useState(null);
  const [recentBills, setRecentBills] = useState([]);
  const [recentLowStock, setRecentLowStock] = useState([]);
  const [topSelling, setTopSelling] = useState([]);
  const [totalStock, setTotalStock] = useState(0);

  const shopName = selectedShop?.shopname?.trim();
  const token = user?.token || localStorage.getItem("token");

  useEffect(() => {
    if (selectedShop) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [selectedShop]);

  const fetchProductsCount = async () => {
    if (!shopName) return;
    setLoading((s) => ({ ...s, products: true, lowstock: true }));

    try {
      const res = await apiClient.get(`/api/shops/${shopName}/dashboard/product-total`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = res.data || {};
      const products = data.products || [];

      // 🔹 Count products
      const totalProducts = data.totalProducts || products.length || 0;

      // 🔹 Calculate total stock (sum of all batch.qty)
      const totalStock = products.reduce((sum, p) => {
        const batches = p.batches || [];
        const productTotal = batches.reduce((bSum, b) => bSum + (b.qty || 0), 0);
        return sum + productTotal;
      }, 0);

      // 🔹 Calculate low-stock count (✅ per product, not per batch)
      const lowStockCount = products.reduce((count, p) => {
        const batches = p.batches || [];
        const totalQty = batches.reduce((sum, b) => sum + Number(b.qty || 0), 0);
        const minQty = Number(p.minQty || 0);
        return count + (totalQty <= minQty ? 1 : 0);
      }, 0);

      setProductsCount(totalProducts);
      setTotalStock(totalStock);
      setLowStockCount(lowStockCount);
    } catch (err) {
      console.error("fetchProductsCount error:", err.response?.data || err.message);
      setError(err.response?.data?.message || "Failed to load products");
      setProductsCount(0);
      setTotalStock(0);
      setLowStockCount(0);
    } finally {
      setLoading((s) => ({ ...s, products: false, lowstock: false }));
    }
  };


  const fetchSales = async (range = "today") => {
    if (!shopName) return;
    setLoading((s) => ({ ...s, sales: true }));

    try {
      const res = await apiClient.get(
        `/api/shops/${shopName}/dashboard/sales-bills/summary?period=${range}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const bills = res?.data?.totalBills ?? 0;
      const amount = res?.data?.totalNetAmount ?? 0;
      setSalesData({ bills, amount });
    } catch (err) {
      console.error("fetchSales error:", err.response?.data || err.message);
      setError(err.response?.data?.message || "Failed to load sales");
      setSalesData({ bills: 0, amount: 0 });
    } finally {
      setLoading((s) => ({ ...s, sales: false }));
    }
  };

  const handleRangeChange = (range) => {
    setSalesRange(range);
    fetchSales(range);
  };

  const fetchRecentBills = async () => {
    if (!shopName) return;
    try {
      const res = await apiClient.get(`/api/shops/${shopName}/dashboard/sales-bills/recent`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const bills = res.data.bills || [];
      setRecentBills(bills);
    } catch (err) {
      console.error("fetchRecentBills error:", err.response?.data || err.message);
    }
  };



  const fetchRecentLowStock = async () => {
    if (!shopName) return;
    try {
      const res = await apiClient.get(
        `/api/shops/${shopName}/dashboard/products/low-stock/recent`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const products = res.data.products || [];

      // ✅ Aggregate total qty across all batches per product code
      const aggregated = products.map((p) => {
        let totalQty = 0;
        if (p.batches && p.batches.length > 0) {
          totalQty = p.batches.reduce((sum, b) => sum + Number(b.qty || 0), 0);
        } else {
          totalQty = p.qty || 0;
        }

        return {
          _id: p._id,
          code: p.code,
          name: p.name,
          totalQty,
          minQty: p.minQty || 0,
        };
      });

      // ✅ Filter only products below minQty
      const lowStockProducts = aggregated.filter((p) => p.totalQty <= p.minQty);

      // ✅ Limit to only 5 most recent items
      const limitedLowStock = lowStockProducts.slice(0, 5);

      setRecentLowStock(limitedLowStock);
    } catch (err) {
      console.error(
        "fetchRecentLowStock error:",
        err.response?.data || err.message
      );
    }
  };



  const fetchTopSelling = async () => {
    if (!shopName) return;
    try {
      const res = await apiClient.get(`/api/shops/${shopName}/dashboard/products/top-selling`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const topProducts = res.data.topProducts || [];
      setTopSelling(topProducts);
    } catch (err) {
      console.error("fetchTopSelling error:", err.response?.data || err.message);
    }
  };

  useEffect(() => {
    if (!shopName) return;
    fetchProductsCount();
    fetchRecentBills();
    fetchRecentLowStock();
    fetchTopSelling();
  }, [shopName]);

  useEffect(() => {
    if (!shopName) return;
    fetchSales(salesRange);
  }, [shopName, salesRange]);

  const formatCurrency = (n) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      : "-";

  return (
    <div className="tenant-dashboard p-8 md:p-6 space-y-6 pt-10 sm:pt-10">
      <div className="max-w-full mx-auto">
        {/* <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold">{shopName}</h1>
        </div> */}




        {/* Header with Action Buttons */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4 pt-3">

          {/* Shop Title */}
          <h1 className="text-2xl md:text-3xl text-[28px] font-bold text-[#00a76f] m-0">
            {shopName}
          </h1>

          {/* Three Action Buttons */}
          <div className="flex items-center gap-3">

            {/* Products Button */}
            <button
              onClick={() => navigate("/stock/master-products")}
              className="inline-flex items-center justify-center w-44 gap-2 px-4 py-2 
         rounded-lg     
    font-semibold
    text-[#007867]
    bg-[#c8fad6]     
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
        
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0    "
            >
              <FaBoxOpen className="text-lg" />
              Products
            </button>

            {/* Purchase Button */}
            <button
              onClick={() => navigate("/stock/master-purchase")}
              className="inline-flex items-center justify-center w-44 gap-2 px-4 py-2 
         rounded-lg     
    font-semibold
    text-[#007867]
    bg-[#c8fad6]     
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
        
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0    "
            >
              <FaShoppingCart className="text-lg" />
              Purchase
            </button>

            {/* Sales Bill Button */}
            <button
              onClick={() => navigate("/master-sales")}
              className="inline-flex items-center justify-center w-44 gap-2 px-4 py-2 
         rounded-lg     
    font-semibold
    text-[#007867]
    bg-[#c8fad6]     
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
        
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0    "
            >
              <FaFileInvoice className="text-lg" />
              Sales Bill
            </button>

          </div>
        </div>


        {/* === Main Dashboard Grid === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Total Products */}
            <motion.div
              className="rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center overflow-hidden"
              style={{
                background: "linear-gradient(320deg, rgba(211, 252, 210, 0.7) 0%, #ffffff 70%)",
              }}
            >
              <div className="text-xs uppercase tracking-wide text-gray-600">Total Products</div>
              <div className="mt-3 text-3xl font-semibold" style={{ color: PRIMARY }}>
                {loading.products ? "..." : productsCount}
              </div>
              <div className="mt-3 text-3xl" style={{ color: PRIMARY }}>
                <FaBoxOpen />
              </div>
            </motion.div>

            {/* Low Stock */}
            <motion.div
              className="rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center overflow-hidden"
              style={{
                background: "linear-gradient(320deg, rgba(255, 205, 210, 0.7) 0%, #ffffff 70%)",
              }}
            >
              <div className="text-xs uppercase tracking-wide text-gray-600">Low Stock</div>
              <div className="mt-3 text-3xl font-semibold text-red-500">
                {loading.lowstock ? "..." : lowStockCount}
              </div>
              <div className="mt-3 text-3xl text-red-500">
                <FaExclamationTriangle />
              </div>
            </motion.div>
          </div>

          {/* Total Sales */}
          <div
            className="rounded-2xl p-6 shadow-sm relative overflow-hidden"
            style={{
              background: "linear-gradient(320deg, rgba(201, 253, 245, 0.7) 0%, #ffffff 70%)",
            }}
          >
            <div className="text-xs uppercase tracking-wide text-gray-600 mb-6">Total Sales</div>
            <div className="absolute top-4 right-4">
              <select
                value={salesRange}
                onChange={(e) => handleRangeChange(e.target.value)}
                className="text-xs border rounded px-2 py-1"
              >
                <option value="today">Today</option>
                <option value="weekly">Week</option>
                <option value="monthly">Month</option>
                <option value="yearly">Year</option>
              </select>
            </div>

            <motion.div className="flex flex-col items-center justify-center gap-4">
              <div className="text-3xl md:text-4xl font-bold" style={{ color: PRIMARY }}>
                {loading.sales ? "..." : formatCurrency(salesData.amount)}
              </div>
              <div className="flex items-center gap-2 text-gray-600 font-medium">
                <FaFileInvoice style={{ color: PRIMARY }} />
                <span style={{ color: PRIMARY }}>
                  {loading.sales ? "..." : `${salesData.bills} Bills`}
                </span>
              </div>
            </motion.div>
          </div>
        </div>

        {error && <div className="mt-4 text-red-600 font-medium">{error}</div>}

        {/* Recent Invoices */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">


          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-700">Recently Added Invoices</h2>
            <button
              onClick={() => navigate("/master-sales")}
              className="text-green-600 hover:text-green-800 text-sm font-medium"
            >
              View All →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-sm">

              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-3 py-2">S.No</th>
                  <th className="border px-3 py-2">Date</th>
                  <th className="border px-3 py-2">Bill No</th>
                  <th className="border px-3 py-2">Customer</th>
                  <th className="border px-3 py-2">Status</th>
                  <th className="border px-3 py-2 text-right">Net Amount</th>
                </tr>
              </thead>


              <tbody>
                {recentBills.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="border px-3 py-4 text-center text-gray-500"
                    >
                      No recently added invoices
                    </td>
                  </tr>
                ) : (
                  recentBills.map((bill, i) => (
                    <tr key={bill._id} className="hover:bg-green-100 border-t">
                      <td className="border px-3 py-2">{i + 1}</td>
                      <td className="border px-3 py-2">{formatDate(bill.date)}</td>
                      <td className="border px-3 py-2">{bill.billNo}</td>
                      <td className="border px-3 py-2">{bill.customerName}</td>

                      <td className="border px-3 py-2">
                        {bill.status?.toLowerCase() === "active" ? (
                          (() => {
                            const cancelledCount = bill.items.filter(
                              i => i.status === "cancelled"
                            ).length;

                            return (
                              <div className="flex flex-col">
                                <span className="flex items-center gap-1 text-green-600 font-semibold">
                                  <FaCheckCircle />
                                  Active
                                </span>

                                {cancelledCount > 0 && (
                                  <span className="text-red-500 text-xs ml-6">
                                    ({cancelledCount} product{cancelledCount > 1 ? "s" : ""} cancelled)
                                  </span>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 font-semibold">
                            <FaTimesCircle />
                            Cancelled
                          </span>
                        )}
                      </td>

                      <td className="border px-3 py-2 text-right">
                        ₹{bill.netAmount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

            </table>
          </div>
        </div>

        {/* Low Stock + Top Selling */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Low Stock */}

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-700">Low Stock Products</h2>
              <button
                onClick={() => navigate("/master/stock/min-qty")}
                className="text-green-600 hover:text-green-800 text-sm font-medium"
              >
                View All →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2 text-left">S.No</th>
                    <th className="border px-3 py-2 text-left">Product Code</th>
                    <th className="border px-3 py-2 text-left">Product Name</th>
                    <th className="border px-3 py-2 text-right">Total Qty</th>
                    <th className="border px-3 py-2 text-right">Min Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLowStock.length > 0 ? (
                    recentLowStock.map((p, i) => (
                      <tr key={p._id} className="hover:bg-green-100">
                        <td className="border px-3 py-2">{i + 1}</td>
                        <td className="border px-3 py-2">{p.code}</td>
                        <td className="border px-3 py-2">{p.name}</td>
                        <td className="border px-3 py-2 text-right text-red-600">
                          {p.totalQty}
                        </td>
                        <td className="border px-3 py-2 text-right">{p.minQty}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="5"
                        className="border px-3 py-2 text-center text-gray-500"
                      >
                        No low stock products
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>


          {/* Top Selling */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-lg font-medium mb-4 text-gray-700">Top Selling Products</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2">S.No</th>
                    <th className="border px-3 py-2">Code</th>
                    <th className="border px-3 py-2">Product</th>
                    <th className="border px-3 py-2 text-right">Qty Sold</th>
                    <th className="border px-3 py-2 text-right">Value</th>
                  </tr>
                </thead>


                <tbody>
                  {topSelling.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="border px-3 py-2 text-center text-gray-500"
                      >
                        No top selling products
                      </td>
                    </tr>
                  ) : (
                    topSelling.slice(0, 5).map((p, i) => (
                      <tr key={p._id} className="hover:bg-green-100">
                        <td className="border px-3 py-2">{i + 1}</td>
                        <td className="border px-3 py-2">{p._id}</td>
                        <td className="border px-3 py-2">{p.name}</td>
                        <td className="border px-3 py-2 text-right">{p.totalQty}</td>
                        <td className="border px-3 py-2 text-right">
                          ₹{Number(p.totalValue || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

