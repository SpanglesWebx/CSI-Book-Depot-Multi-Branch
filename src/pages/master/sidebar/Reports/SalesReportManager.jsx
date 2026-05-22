import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useShop } from "../../../../context/ShopContext";
import { useAuth } from "../../../../context/AuthContext";
import "../../../../styles/reports/SalesReport.css";
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

export const SalesReportManager = () => {
  const { getToken } = useAuth();
  const { setSelectedShop } = useShop();
  const navigate = useNavigate();

  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chartFilter, setChartFilter] = useState("day"); // "day" | "week" | "month" | "year"
  const [chartData, setChartData] = useState([]);
  const [chartPeriod, setChartPeriod] = useState(new Date()); // reference date
  const [hoveredShop, setHoveredShop] = useState(null);


  // ---- Fetch shops with totalNetAmount ----
  const fetchShopsWithTotal = async () => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) throw new Error("No auth token found");

      const res = await axios.get(`${API}/api/shops?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const shopData = res.data?.shops || [];

      const shopsWithTotals = await Promise.all(
        shopData.map(async (shop) => {
          try {
            const summaryRes = await axios.get(
              `${API}/api/shops/${encodeURIComponent(shop.shopname)}/dashboard/sales-bills-cards/summary`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            // const totalNetAmount = summaryRes.data?.totalNetAmount || 0;
            const totalNetAmount = summaryRes.data?.summary?.totalNetAmount || 0;

            return {
              _id: shop._id,
              shopname: shop.shopname,
              color: colorForShop(shop.shopname),
              totalNetAmount,
            };
          } catch (err) {
            console.error(`Failed to fetch summary for ${shop.shopname}:`, err);
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

  // ---- Helper: Start/end of day ----
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




  const getPeriodDates = (filter, referenceDate) => {
    const periods = [];
    const ref = new Date(referenceDate);

    if (filter === "day") {
      // 🟢 Last 4 days including the reference date
      for (let i = 3; i >= 0; i--) {
        const d = new Date(ref);
        d.setDate(ref.getDate() - i);
        periods.push(d);
      }
    } else if (filter === "week") {
      // 🟢 Last 4 full weeks including the week of reference date
      const dayOfWeek = ref.getDay(); // 0=Sunday
      const thisWeekStart = new Date(ref);
      thisWeekStart.setDate(ref.getDate() - dayOfWeek);
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(thisWeekStart);
        weekStart.setDate(weekStart.getDate() - i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        periods.push({ start: weekStart, end: weekEnd });
      }
    } else if (filter === "month") {
      // 🟢 Last 4 months including the current one
      for (let i = 3; i >= 0; i--) {
        const monthStart = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
        periods.push(monthStart);
      }
    } else if (filter === "year") {
      // 🟢 Last 4 years including the current year
      for (let i = 3; i >= 0; i--) {
        const yearStart = new Date(ref.getFullYear() - i, 0, 1);
        periods.push(yearStart);
      }
    }

    return periods;
  };


  const fetchChartData = async () => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) return;

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
              label = from.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
              });
            } else if (chartFilter === "week") {
              from = new Date(period.start);
              to = new Date(period.end);
              label = `${from.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
              })} - ${to.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
              })}`;
            } else if (chartFilter === "month") {
              from = new Date(period.getFullYear(), period.getMonth(), 1);
              to = new Date(period.getFullYear(), period.getMonth() + 1, 0, 23, 59, 59, 999);
              label = period.toLocaleString("default", {
                month: "short",
                year: "numeric",
              });
            } else if (chartFilter === "year") {
              from = new Date(period.getFullYear(), 0, 1);
              to = new Date(period.getFullYear(), 11, 31, 23, 59, 59, 999);
              label = period.getFullYear().toString();
            }

            // Fetch per period
            const res = await axios.get(
              `${API}/api/shops/${encodeURIComponent(shop.shopname)}/report-charts/sales-bills/summary`,
              {
                params: { from: from.toISOString(), to: to.toISOString() },
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            // Fix: Ensure we handle local date correctly
            totals[label] = res.data.totalNetAmount || 0;
          }

          return { shop: shop.shopname, color: shop.color, totals };
        })
      );

      // Collect all labels across shops
      const allLabels = new Set();
      allData.forEach(({ totals }) => Object.keys(totals).forEach((l) => allLabels.add(l)));
      const sortedLabels = [...allLabels];

      // Build Recharts data
      const chartData = sortedLabels.map((label) => {
        const entry = { label };
        allData.forEach(({ shop, totals }) => {
          entry[shop] = totals[label] || 0;
        });
        return entry;
      });

      console.log("🟢 Chart Data Generated:", chartData);
      setChartData(chartData);
    } catch (err) {
      console.error("❌ Error fetching chart data:", err);
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    if (shops.length) fetchChartData();
  }, [shops, chartFilter, chartPeriod]);

  // ---- Handle Previous / Next ----
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

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    // Access hoveredShop via closure or React state
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
        <div style={{ color: "#333" }}>Total Sales: ₹{value.toLocaleString()}</div>
        <div style={{ fontSize: 12, color: "#777" }}>{label}</div>
      </div>
    );
  };




  return (
    <div className="sales-report-container">
      <h1 className="heading">Sales Reports  </h1>

      {/* <div className="shops-cards-container" style={{ display: "flex", flexWrap: "wrap", gap: 16 }}> */}
      <div
        className="shops-cards-container"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
        }}
      >
        {shops.map((shop) => (
          // <div
          //   key={shop._id}
          //   className="shop-card bg-gradient-info"
          //   style={{ flex: "1 1 calc(25% - 16px)", minWidth: 220, borderLeft: `5px solid ${shop.color}`, padding: "16px" }}
          // >
          <div
            key={shop._id}
            className="shop-card bg-gradient-info"
            style={{
              borderLeft: `5px solid ${shop.color}`,
              padding: "16px",
              boxSizing: "border-box",
            }}
          >

            <h3>{shop.shopname}</h3>
            <p style={{ margin: "8px 0", fontWeight: "bold" }}>Total Sales: ₹{shop.totalNetAmount.toLocaleString()}</p>
            <span
              className="view-bills-text"
              style={{ cursor: "pointer" }}
              onClick={() => {
                setSelectedShop(shop);
                navigate(`/master-sales/${shop._id}`);
              }}
            >
              View Details
            </span>
          </div>
        ))}
      </div>

      <div
        className="chart-controls"
        style={{
          margin: "16px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          width: "100%",
          maxWidth: "400px",
          marginInline: "auto",
        }}
      >
        {/* Left: Previous */}
        <button
          onClick={handlePrev}
          style={{
            padding: "6px 12px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            backgroundColor: "#00a76f",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Previous
        </button>

        {/* Center: Dropdown */}
        <select
          value={chartFilter}
          onChange={(e) => setChartFilter(e.target.value)}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            background: "white",
            fontWeight: "500",
          }}
        >
          <option value="day">Day Wise</option>
          <option value="week">Week Wise</option>
          <option value="month">Month Wise</option>
          <option value="year">Year Wise</option>
        </select>

        {/* Right: Next */}
        <button
          onClick={handleNext}
          style={{
            padding: "6px 12px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            backgroundColor: "#c8fad6",
            color: "#007867",
            cursor: "pointer",
          }}
        >
          Next
        </button>
      </div>


      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0, 167, 111, 0.1)" }} />
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

      {loading && <div className="loading-overlay">Loading...</div>}
    </div>
  );
};
