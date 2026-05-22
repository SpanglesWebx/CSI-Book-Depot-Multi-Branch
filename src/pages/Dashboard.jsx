// src/pages/Dashboard/Dashboard.jsx    
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { FaBoxOpen, FaExclamationTriangle, FaFileInvoice, FaShoppingCart, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import apiClient from "../utils/apiClient";
import { getApiUrl } from "../utils/api";
import { useNavigate } from "react-router-dom";

const CARD_BASE_STYLE = "relative bg-white rounded-xl p-4 shadow-sm border";
const PRIMARY = "#00A76F";
const PRIMARY_DARK = "#007867";
const SOFT = "#C8FAD6";

const cardHover = {
  scale: 1.02,
  boxShadow: `0 12px 30px -12px rgba(0,167,111,0.28), 0 6px 18px -10px rgba(0,120,103,0.08)`,
};

export default function TenantDashboard() {
  const { user, token } = useAuth();

  const shopTitle = user?.shopname || user?.shop || "Current Shop";

  const [productsCount, setProductsCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [salesData, setSalesData] = useState({ bills: 0, amount: 0 });
  const [salesRange, setSalesRange] = useState("today");
  const [loading, setLoading] = useState({ products: false, lowstock: false, sales: false });
  const [error, setError] = useState(null);

  const [recentBills, setRecentBills] = useState([]);
  const [lowStockBatches, setLowStockBatches] = useState([]);
  const [totalStock, setTotalStock] = useState(0);
  const [recentLowStock, setRecentLowStock] = useState([]);
  const [loadingLowStock, setLoadingLowStock] = useState(false);

  const navigate = useNavigate();
  const [topSelling, setTopSelling] = useState([]);
  const [loadingTopSelling, setLoadingTopSelling] = useState(false);

  // IMPORTANT: include shopTitle when generating API paths so getApiUrl can construct correct shop-specific endpoints
  const PRODUCTS_API = useMemo(() => getApiUrl("product-total", user, shopTitle), [user, shopTitle]);
  const SALES_API = useMemo(() => getApiUrl("sales-bills", user, shopTitle), [user, shopTitle]);
  const LOW_STOCK_API = useMemo(() => getApiUrl("products/low-stock/recent", user, shopTitle), [user, shopTitle]);
  const TOP_SELLING_API = useMemo(() => getApiUrl("products/top-selling", user, shopTitle), [user, shopTitle]);

  // ----------------------------
  // Fetch product & low stock counts
  // ----------------------------
  useEffect(() => {
    if (shopTitle) fetchProductsCount();
  }, [PRODUCTS_API, shopTitle]);

  useEffect(() => {
    if (shopTitle) fetchSales(salesRange);
  }, [SALES_API, salesRange, shopTitle]);



  async function fetchProductsCount() {
    setLoading((s) => ({ ...s, products: true, lowstock: true }));
    try {
      const token = user?.token || localStorage.getItem("token");
      if (!token) throw new Error("No auth token found");

      const res = await apiClient.get(PRODUCTS_API, {
        headers: {
          "x-shopname": shopTitle,
          Authorization: `Bearer ${token}`,
        },
      });

      const data = res?.data ?? {};

      // ✅ Normalize product total
      const totalProducts =
        data.totalProducts ??
        data.total ??
        data.totalCount ??
        data.productsCount ??
        0;

      // ✅ Normalize total stock (compute manually if missing)
      let totalStockNormalized = data.totalStock ?? data.stockTotal;
      if (totalStockNormalized == null) {
        const productsArray = data.products ?? [];
        totalStockNormalized = productsArray.reduce((sum, p) => {
          const batches = Array.isArray(p.batches) ? p.batches : [];
          return (
            sum + batches.reduce((bSum, b) => bSum + Number(b.qty ?? 0), 0)
          );
        }, 0);
      }

      // ✅ Identify possible low-stock arrays
      let lowCount =
        data.lowStockCount ??
        data.lowStockLength ??
        0;

      const lowItems =
        data.lowStockItems ??
        data.lowStock ??
        data.recentLowStock ??
        data.products ??
        data.batches ??
        data.items ??
        [];

      if (!lowCount) {
        if (Array.isArray(lowItems)) lowCount = lowItems.length;
        else lowCount = 0;
      }

      // ✅ Normalize & aggregate low-stock by product code
      const productMap = new Map();

      if (Array.isArray(lowItems) && lowItems.length > 0) {
        const first = lowItems[0];
        if (first && ("batchNo" in first || "qty" in first)) {
          // batch-like → aggregate by code
          lowItems.forEach((b) => {
            const code = b.code || b.productCode || "";
            const name = b.name || b.productName || "";
            const qty = Number(b.qty ?? 0);
            const minQty = Number(b.minQty ?? b.min_quantity ?? 0);

            if (!productMap.has(code)) {
              productMap.set(code, {
                _id: b._id,
                code,
                name,
                totalQty: 0,
                minQty,
                mrp: Number(b.mrp ?? b.price ?? 0),
                salePrice: Number(b.salePrice ?? b.rate ?? 0),
              });
            }

            const prod = productMap.get(code);
            prod.totalQty += qty;
            prod.minQty = prod.minQty || minQty;
          });
        } else {
          // product-like → flatten batches
          lowItems.forEach((p) => {
            const code = p.code ?? "";
            const name = p.name ?? "";
            const minQty = Number(p.minQty ?? p.min_quantity ?? 0);
            const batches = p.batches ?? [];
            let totalQty = 0;

            (Array.isArray(batches) ? batches : []).forEach((b) => {
              totalQty += Number(b.qty ?? 0);
            });

            if (!productMap.has(code)) {
              productMap.set(code, {
                _id: p._id,
                code,
                name,
                totalQty,
                minQty,
              });
            } else {
              const prod = productMap.get(code);
              prod.totalQty += totalQty;
              prod.minQty = prod.minQty || minQty;
            }
          });
        }
      }

      // ✅ Filter only low-stock (totalQty <= minQty)
      const normalizedLowProducts = Array.from(productMap.values()).filter(
        (p) => p.totalQty <= p.minQty
      );

      // ✅ Final normalized state updates
      setProductsCount(Number(totalProducts));
      setTotalStock(Number(totalStockNormalized));
      setLowStockCount(normalizedLowProducts.length);
      setLowStockBatches(normalizedLowProducts);

    } catch (err) {
      console.error("fetchProductsCount error:", err?.response?.data ?? err.message);
      setError(err?.response?.data?.message || "Failed to load products");
      setProductsCount(0);
      setTotalStock(0);
      setLowStockCount(0);
      setLowStockBatches([]);
    } finally {
      setLoading((s) => ({ ...s, products: false, lowstock: false }));
    }
  }



  async function fetchSales(range = "today") {
    setLoading((s) => ({ ...s, sales: true }));
    try {
      const token = user?.token || localStorage.getItem("token");
      const url = `${SALES_API}/summary?period=${encodeURIComponent(range)}`;
      const res = await apiClient.get(url, {
        headers: {
          "x-shopname": shopTitle,
          Authorization: `Bearer ${token}`,
        },
      });

      const bills = res?.data?.totalBills ?? 0;
      const amount = res?.data?.totalNetAmount ?? res?.data?.totalAmount ?? 0;

      setSalesData({ bills: Number(bills), amount: Number(amount) });
    } catch (err) {
      console.error("fetchSales error:", err?.response?.data ?? err.message);
      setError(err?.response?.data?.message || "Failed to load sales");
      setSalesData({ bills: 0, amount: 0 });
    } finally {
      setLoading((s) => ({ ...s, sales: false }));
    }
  }

  // Simple date formatter
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  async function fetchRecentBills() {
    try {
      const token = user?.token || localStorage.getItem("token");
      const res = await apiClient.get(`${SALES_API}/recent`, {
        headers: {
          "x-shopname": shopTitle,
          Authorization: `Bearer ${token}`,
        },
      });
      setRecentBills(res.data.bills || res.data?.items || []);
    } catch (err) {
      console.error("fetchRecentBills error:", err?.response?.data ?? err.message);
    }
  }

  useEffect(() => {
    if (user && shopTitle) fetchRecentBills();
  }, [user, shopTitle]);

  const formatCurrency = (n) => {
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
    } catch {
      return `₹${n.toFixed(2)}`;
    }
  };

  const handleRangeChange = (v) => setSalesRange(v);

  async function fetchRecentLowStock() {
    setLoadingLowStock(true);
    try {
      const token = user?.token || localStorage.getItem("token");
      const res = await apiClient.get(LOW_STOCK_API, {
        headers: {
          "x-shopname": shopTitle,
          Authorization: `Bearer ${token}`,
        },
      });

      const raw = res?.data?.products ?? [];

      // Only take the 5 most recent low stock products
      const limited = raw
        .filter((p) => Number(p.totalQty) <= Number(p.minQty)) // optional if backend already filters
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 5);

      setRecentLowStock(limited);
    } catch (err) {
      console.error("fetchRecentLowStock error:", err?.response?.data ?? err.message);
      setRecentLowStock([]);
    } finally {
      setLoadingLowStock(false);
    }
  }


  async function fetchTopSelling() {
    setLoadingTopSelling(true);
    try {
      const token = user?.token || localStorage.getItem("token");
      const res = await apiClient.get(TOP_SELLING_API, {
        headers: { "x-shopname": shopTitle, Authorization: `Bearer ${token}` },
      });

      console.log("fetchTopSelling response:", res.data);
      setTopSelling(res.data.topProducts || res.data?.items || []);
    } catch (err) {
      console.error("fetchTopSelling error:", err?.response?.data ?? err.message);
    } finally {
      setLoadingTopSelling(false);
    }
  }

  useEffect(() => {
    if (user) fetchRecentLowStock();
  }, [user, shopTitle]);

  useEffect(() => {
    fetchTopSelling();
  }, [shopTitle]);

  return (
    <div className="tenant-dashboard  md:p-6 space-y-6 pt-10 sm:pt-10">
      <div className="max-w-full mx-auto">
        {/* Header */}
        {/* <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold">{shopTitle}</h1>
        </div> */}


        {/* Header with Action Buttons */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4 pt-3">

          {/* Shop Title */}
          <h1 className="text-2xl sm:text-3xl font-bold mb-6   text-[28px]  text-[#00a76f]">
            {shopTitle}
          </h1>

          {/* Three Action Buttons */}
          <div className="flex items-center gap-3">

            {/* Products Button */}


            <button
              onClick={() => navigate("/stock/products")}
              className="
    inline-flex items-center gap-2   justify-center
    px-4 py-2 w-44
    rounded-lg 
    font-semibold
    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0
  "
            >
              <FaBoxOpen className="text-lg" />
              Products
            </button>



            {/* Purchase Button */}
            <button
              onClick={() => navigate("/stock/purchase")}
              className="inline-flex items-center justify-center w-44 gap-2 px-4 py-2 
         rounded-lg     
    font-semibold
    text-[#007867]
    bg-[#c8fad6]     
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
        
    transition-all duration-150
    hover:-translate-y-[1px]    
    active:translate-y-0          
            
      "
            >
              <FaShoppingCart className="text-lg" />
              Purchase
            </button>

            {/* Sales Bill Button */}
            <button
              onClick={() => navigate("/sales")}
              className="inline-flex items-center justify-center w-44 gap-2 px-4 py-2 
                      rounded-lg 
    font-semibold
    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0  "
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
              // whileHover={cardHover}
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
              // whileHover={cardHover}
              className="rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center overflow-hidden"
              style={{
                background: "linear-gradient(320deg, rgba(255, 205, 210, 0.7) 0%, #ffffff 70%)",
              }}
            >
              <div className="text-xs uppercase tracking-wide text-gray-600">Low Stock</div>
              <div className="mt-3 text-3xl font-semibold text-red-500">{loading.lowstock ? "..." : lowStockCount}</div>
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
              <select value={salesRange} onChange={(e) => handleRangeChange(e.target.value)} className="text-xs border rounded px-2 py-1">
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
                <span style={{ color: PRIMARY }}>{loading.sales ? "..." : `${salesData.bills} Bills`}</span>
              </div>
            </motion.div>
          </div>
        </div>




        {/* Error display */}
        {error && <div className="mt-4 text-red-600 font-medium">{error}</div>}

        {/* === Recently Added Invoices === */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-700">Recently Added Invoices</h2>
            <button onClick={() => navigate("/sales")} className="text-green-600 hover:text-green-800 text-sm font-medium">
              View All →
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: "600px" }}>
            <thead>
              <tr>
                {["S.No", "Date", "Bill No", "Customer", "Status", "Net Amount"].map((h) => (
                  <th key={h} style={{ textAlign: "left", color: "#111", fontWeight: 700, padding: "12px 10px", background: "#f3f4f6", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>


            <tbody>
              {recentBills.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="border px-3 py-3 text-center text-gray-500"
                  >
                    No recently added invoices
                  </td>
                </tr>
              ) : (
                recentBills.map((bill, i) => (
                  <tr key={bill._id} style={{ transition: "background 0.2s" }}>
                    <td style={{ padding: "12px 10px", borderTop: "1px solid #e5e7eb", color: "#222" }}>{i + 1}</td>
                    <td style={{ padding: "12px 10px", borderTop: "1px solid #e5e7eb", color: "#222" }}>{formatDate(bill.date)}</td>
                    <td style={{ padding: "12px 10px", borderTop: "1px solid #e5e7eb", color: "#222" }}>{bill.billNo}</td>
                    <td style={{ padding: "12px 10px", borderTop: "1px solid #e5e7eb", color: "#222" }}>{bill.customerName}</td>
                    <td style={{ padding: "12px 10px", borderTop: "1px solid #e5e7eb", color: "#222" }}>
                      {bill.status?.toLowerCase() === "active" ? (
                        (() => {
                          const cancelledCount = bill.items.filter(i => i.status === "cancelled").length;

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
                    <td style={{ padding: "12px 10px", borderTop: "1px solid #e5e7eb", color: "#222", textAlign: "right" }}>
                      ₹{bill.netAmount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

          </table>
        </div>

        {/* === Third Row: Low Stock + Top Selling === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Low Stock Products */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-700">Low Stock Products</h2>
              <button
                onClick={() => navigate("/stock/min-qty")}
                className="text-green-600 hover:text-green-800 text-sm font-medium"
              >
                View All →
              </button>
            </div>

            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
              }}
            >
              <thead>
                <tr>
                  {["S.No", "Product Code", "Product Name", "Total Qty", "Min Qty"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          color: "#111",
                          fontWeight: 700,
                          padding: "12px 10px",
                          background: "#f3f4f6",
                          whiteSpace: "nowrap",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>



              <tbody>
                {recentLowStock.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="border px-3 py-2 text-center text-gray-500"
                    >
                      No low stock products
                    </td>
                  </tr>
                ) : (
                  recentLowStock.map((p, i) => (
                    <tr key={`${p._id}-${i}`} className="hover:bg-green-100">
                      <td
                        style={{
                          padding: "12px 10px",
                          borderTop: "1px solid #e5e7eb",
                          color: "#222",
                        }}
                      >
                        {i + 1}
                      </td>
                      <td
                        style={{
                          padding: "12px 10px",
                          borderTop: "1px solid #e5e7eb",
                          color: "#222",
                        }}
                      >
                        {p.code}
                      </td>
                      <td
                        style={{
                          padding: "12px 10px",
                          borderTop: "1px solid #e5e7eb",
                          color: "#222",
                        }}
                      >
                        {p.name}
                      </td>
                      <td
                        style={{
                          padding: "12px 10px",
                          borderTop: "1px solid #e5e7eb",
                          color: "#dc2626",
                          textAlign: "right",
                        }}
                      >
                        {p.totalQty}
                      </td>
                      <td
                        style={{
                          padding: "12px 10px",
                          borderTop: "1px solid #e5e7eb",
                          textAlign: "right",
                          color: "#222",
                        }}
                      >
                        {p.minQty}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

            </table>
          </div>



          {/* Top Selling Products */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-lg font-medium mb-4 text-gray-700">
              Top Selling Products
            </h2>

            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  {["S.No", "Product", "Qty Sold", "Sales Value"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        color: "#111",
                        fontWeight: 700,
                        padding: "12px 10px",
                        background: "#f3f4f6",
                        whiteSpace: "nowrap",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {topSelling.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="border px-3 py-2 text-center text-gray-500"
                    >
                      No top selling products
                    </td>
                  </tr>
                ) : (
                  topSelling.slice(0, 5).map((p, i) => (
                    <tr key={p.code || i} className="hover:bg-green-100">
                      <td
                        style={{
                          padding: "12px 10px",
                          borderTop: "1px solid #e5e7eb",
                          color: "#222",
                        }}
                      >
                        {i + 1}
                      </td>

                      <td
                        style={{
                          padding: "12px 10px",
                          borderTop: "1px solid #e5e7eb",
                          color: "#222",
                        }}
                      >
                        {p.name}
                      </td>

                      <td
                        style={{
                          padding: "12px 10px",
                          borderTop: "1px solid #e5e7eb",
                          textAlign: "right",
                          color: "#222",
                        }}
                      >
                        {p.totalQty}
                      </td>

                      <td
                        style={{
                          padding: "12px 10px",
                          borderTop: "1px solid #e5e7eb",
                          textAlign: "right",
                          color: "#222",
                        }}
                      >
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
  );
}
