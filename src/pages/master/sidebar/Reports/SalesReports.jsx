
// src/pages/master/sidebar/Reports/SalesReports.jsx

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useShop } from "../../../../context/ShopContext";
import { useAuth } from "../../../../context/AuthContext";
import "../../../../styles/reports/SalesReport.css";
import Pagination from "../../../../components/Pagination";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,

} from "recharts";
import {
  FaTimes, FaEye, FaChevronRight,
  FaChevronLeft
} from "react-icons/fa";
import Select from "react-select";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ---- Deterministic color per shop ----
const hashString = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const colorForShop = (name) => {
  const h = hashString(name) % 360;
  const s = 60 + (hashString(name + "s") % 20);
  const l = 45 + (hashString(name + "l") % 20);
  return `hsl(${h}, ${s}%, ${l}%)`;
};

const options = [
  { value: "day", label: "Day" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

const customStyles = {
  control: (provided) => ({
    ...provided,
    borderRadius: "6px",
    border: "1px solid #ccc",
    padding: "2px 6px",
    fontWeight: 500,
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isFocused ? "#00a76f" : "white",
    color: state.isFocused ? "white" : "black",
    cursor: "pointer",
  }),
};

export default function SalesReport() {
  const { getToken } = useAuth();
  const { selectedShop, setSelectedShop } = useShop();

  const navigate = useNavigate();

  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chartFilter, setChartFilter] = useState("day");
  const [chartData, setChartData] = useState([]);
  const [chartPeriod, setChartPeriod] = useState(new Date());
  const [hoveredShop, setHoveredShop] = useState(null);

  const [bills, setBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [viewBill, setViewBill] = useState(null);

  const [billPage, setBillPage] = useState(1);
  const [loadingChart, setLoadingChart] = useState(false);

  const [modalShop, setModalShop] = useState(null); // 👈 Local, temporary shop for modal
  const [printView, setPrintView] = useState(false);

  // ---- Fetch shops with totalNetAmount ----
  const fetchShopsWithTotal = async () => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) throw new Error("No auth token found");

      // Fetch shops list
      const res = await axios.get(`${API}/api/shops?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const shopData = res.data?.shops || [];

      // Fetch per-shop totals concurrently
      const shopsWithTotals = await Promise.all(
        shopData.map(async (shop) => {
          try {
            const summaryRes = await axios.get(
              `${API}/api/shops/${encodeURIComponent(shop.shopname)}/dashboard/sales-bills-cards/summary`,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            const totalNetAmount = summaryRes.data?.summary?.totalNetAmount || 0;

            return {
              _id: shop._id,
              shopname: shop.shopname,
              color: colorForShop(shop.shopname),
              totalNetAmount,
            };
          } catch (err) {
            console.error(`Failed summary for ${shop.shopname}:`, err);
            return {
              _id: shop._id,
              shopname: shop.shopname,
              color: colorForShop(shop.shopname),
              totalNetAmount: 0,
            };
          }
        })
      );

      setShops(shopsWithTotals);
    } catch (err) {
      console.error("Failed to fetch shops:", err);
      setShops([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchShopsWithTotal();
  }, []);



  // ---- Helper: Start/end of day (not directly used here but useful) ----
  const startOfDay = (d) => {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  };

  const endOfDay = (d) => {
    const dt = new Date(d);
    dt.setHours(23, 59, 59, 999);
    return dt;
  };

  // ---- Build periods for chart queries (last 4 units including current) ----
  const getPeriodDates = (filter, referenceDate) => {
    const periods = [];
    const ref = new Date(referenceDate);

    if (filter === "day") {
      for (let i = 3; i >= 0; i--) {
        const d = new Date(ref);
        d.setDate(ref.getDate() - i);
        periods.push(d);
      }
    } else if (filter === "week") {
      const dayOfWeek = ref.getDay();
      const thisWeekStart = new Date(ref);
      thisWeekStart.setDate(ref.getDate() - dayOfWeek); // Sunday start
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(thisWeekStart);
        weekStart.setDate(weekStart.getDate() - i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        periods.push({ start: weekStart, end: weekEnd });
      }
    } else if (filter === "month") {
      for (let i = 3; i >= 0; i--) {
        const monthStart = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
        periods.push(monthStart);
      }
    } else if (filter === "year") {
      for (let i = 3; i >= 0; i--) {
        const yearStart = new Date(ref.getFullYear() - i, 0, 1);
        periods.push(yearStart);
      }
    }

    return periods;
  };


  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();

    const ampm = hours >= 12 ? "PM" : "AM";
    const h = hours % 12 || 12;
    const mm = minutes.toString().padStart(2, "0");
    const ss = seconds.toString().padStart(2, "0");

    return `${h}:${mm}:${ss} ${ampm}`;
  };


  const fetchShopBills = async (shopname) => {
    if (!shopname) return;
    setLoadingBills(true);

    try {
      const token = getToken();
      if (!token) throw new Error("No auth token");

      const res = await axios.get(
        `${API}/api/shops/${encodeURIComponent(shopname)}/report-charts/respetive-shop-sales/summary`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      console.log("🧩 API raw response for", shopname, res.data);

      // ✅ Corrected key name
      const billsData = Array.isArray(res.data?.bills)
        ? res.data.bills
        : [];

      console.log("✅ Bills parsed:", billsData);
      setBills(billsData);
    } catch (err) {
      console.error("❌ Failed to fetch bills:", err);
      setBills([]);
    } finally {
      setLoadingBills(false);
    }
  };


  // ---- Build chart dataset by querying each shop for each period ----


  const fetchBillDetails = async (billId) => {
    if (!billId || !modalShop?.shopname) return; // ✅ use modalShop

    try {
      const token = getToken();
      const res = await axios.get(
        `${API}/api/shops/${encodeURIComponent(modalShop.shopname)}/sales-bills/${billId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // ✅ Ensure we store the real bill object, not the wrapper
      const billData = res.data?.bill || res.data || {};
      setViewBill(billData);
    } catch (err) {
      console.error("Failed to fetch bill details:", err);
      setViewBill(null);
    }
  };


  const fetchChartData = async () => {
    try {
      const token = getToken();
      if (!token) return;

      setLoadingChart(true);

      const periods = getPeriodDates(chartFilter, chartPeriod);

      const allData = await Promise.all(
        shops.map(async (shop) => {
          const totals = {};

          for (const period of periods) {
            let from, to, label;

            if (chartFilter === "day") {
              from = new Date(period);
              from.setHours(0, 0, 0, 0);
              to = new Date(period);
              to.setHours(23, 59, 59, 999);
              label = from.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
            } else if (chartFilter === "week") {
              from = new Date(period.start);
              to = new Date(period.end);
              label = `${from.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} - ${to.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
            } else if (chartFilter === "month") {
              from = new Date(period.getFullYear(), period.getMonth(), 1);
              to = new Date(period.getFullYear(), period.getMonth() + 1, 0, 23, 59, 59, 999);
              label = period.toLocaleString("default", { month: "short", year: "numeric" });
            } else if (chartFilter === "year") {
              from = new Date(period.getFullYear(), 0, 1);
              to = new Date(period.getFullYear(), 11, 31, 23, 59, 59, 999);
              label = period.getFullYear().toString();
            }

            // Query backend per shop per period
            const res = await axios.get(
              `${API}/api/shops/${encodeURIComponent(shop.shopname)}/report-charts/sales-bills/summary`,
              {
                params: { from: from.toISOString(), to: to.toISOString() },
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            totals[label] = res.data?.totalNetAmount || 0;
          }

          return { shop: shop.shopname, color: shop.color, totals };
        })
      );

      // collect labels and build data array
      const allLabels = new Set();
      allData.forEach(({ totals }) => Object.keys(totals).forEach((l) => allLabels.add(l)));
      const sortedLabels = [...allLabels];

      const chartData = sortedLabels.map((label) => {
        const entry = { label };
        allData.forEach(({ shop, totals }) => {
          entry[shop] = totals[label] || 0;
        });
        return entry;
      });

      setChartData(chartData);
    } catch (err) {
      console.error("❌ Error fetching chart data:", err);
    } finally {
      setLoadingChart(false); // ✅ hide loader end
    }
  };

  useEffect(() => {
    if (shops.length) fetchChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shops, chartFilter, chartPeriod]);

  const handlePrev = () => {
    const d = new Date(chartPeriod);
    if (chartFilter === "day") d.setDate(d.getDate() - 3);
    else if (chartFilter === "week") d.setDate(d.getDate() - 7);
    else if (chartFilter === "month") d.setMonth(d.getMonth() - 1);
    else if (chartFilter === "year") d.setFullYear(d.getFullYear() - 1);
    setChartPeriod(d);
  };

  const handleNext = () => {
    const d = new Date(chartPeriod);
    if (chartFilter === "day") d.setDate(d.getDate() + 3);
    else if (chartFilter === "week") d.setDate(d.getDate() + 7);
    else if (chartFilter === "month") d.setMonth(d.getMonth() + 1);
    else if (chartFilter === "year") d.setFullYear(d.getFullYear() + 1);
    setChartPeriod(d);
  };

  // ---- Tooltip that uses hoveredShop (as requested) ----
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const hoveredBar = payload.find((p) => p.dataKey === hoveredShop);
    if (!hoveredBar) return null;

    const { dataKey: shopName, value, fill: color } = hoveredBar;

    return (
      <div
        style={{
          background: "white",
          border: `1px solid ${color}`,
          borderRadius: "8px",
          padding: "8px 12px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ fontWeight: "bold", color }}>{shopName}</div>
        <div style={{ color: "#333" }}>Total Sales: ₹{Number(value || 0).toLocaleString()}</div>
        <div style={{ fontSize: 12, color: "#777" }}>{label}</div>
      </div>
    );
  };

  // ---- Helper to format dates used in bills table and bill modal ----
  const formatDate = (d) => {
    if (!d) return "-";
    const dt = new Date(d);
    return dt.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="sales-report-container pt-10 sm:pt-10">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6   text-[28px]  text-[#00a76f]">Sales Reports</h1>

      {/* 🟢 SHOP CARDS CONTAINER */}
      <div
        className="shops-cards-section"
        style={{
          width: "100%",
          marginBottom: "40px",
        }}
      >
        <div
          className="shops-cards-container"
          style={{ display: "flex", flexWrap: "wrap", gap: 16 }}
        >
          {shops.map((shop) => (
            <div
              key={shop._id}
              className="shop-card bg-gradient-info"
              style={{
                flex: "1 1 calc(25% - 16px)",
                minWidth: 220,
                borderLeft: `5px solid ${shop.color}`,
                padding: "16px",
                transition: "all 0.3s ease",
              }}
            >
              <h3>{shop.shopname}</h3>
              <p style={{ margin: "8px 0", fontWeight: "bold" }}>
                Total Sales: ₹{Number(shop.totalNetAmount || 0).toLocaleString()}
              </p>


              <span
                className="view-bills-text text-[#007867] hover:underline cursor-pointer"
                onClick={() => navigate(`/reports/sales/shop/${shop.shopname}`)}
              >
                View Details
              </span>

            </div>
          ))}
        </div>
      </div>


      {/* 🟢 CHART + CONTROLS CONTAINER */}
      <div
        className="chart-section"
        style={{
          width: "100%",
          background: "#fff",
          padding: "20px",
          borderRadius: "12px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        }}
      >
        <div
          className="chart-controls"
          style={{
            margin: "16px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            width: "100%",
            maxWidth: "100%", // 🟢 changed from 400px to 100%
            marginInline: 0,  // 🟢 changed from "auto" to 0 for full alignment
          }}
        >
          <button
            onClick={handlePrev}
            style={{
              padding: "6px 12px",
              border: "1px solid #ccc",
              borderRadius: "6px",
              backgroundColor: "#c8fad6",
              color: "#007867",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginLeft: 0, // 🟢 ensure no left margin
            }}
          >
            <FaChevronLeft /> Previous
          </button>

          <select
            value={chartFilter}
            onChange={(e) => setChartFilter(e.target.value)}
            className="chart-select"
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              background: "white",

              fontWeight: "500",
              width: "120px",
            }}
          >
            <option value="day">Day</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>

          <button
            onClick={handleNext}
            style={{
              padding: "6px 12px",
              border: "1px solid #ccc",
              borderRadius: "6px",
              backgroundColor: "#c8fad6",
              color: "#007867",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginRight: 0, // 🟢 ensure no right margin
            }}
          >
            Next <FaChevronRight />
          </button>
        </div>

        <div style={{ position: "relative", width: "100%", height: 400 }}>
          {loadingChart && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.6)",
                zIndex: 10,
              }}
            >
              <p
                style={{
                  color: "#00A76F",
                  fontWeight: "600",
                  fontSize: "18px",
                  animation: "pulse 1.2s infinite",
                }}
              >
                Loading…
              </p>
            </div>
          )}

          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(0, 167, 111, 0.1)" }}
              />
              <Legend />
              {shops.map((shop) => (
                <Bar
                  key={shop._id}
                  dataKey={shop.shopname}
                  name={shop.shopname}
                  fill={shop.color}
                  barSize={40}
                  onMouseOver={() => setHoveredShop(shop.shopname)}
                  onMouseOut={() => setHoveredShop(null)}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>







    </div>
  );
}
