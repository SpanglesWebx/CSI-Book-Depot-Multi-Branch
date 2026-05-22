

// src/pages/master/sidebar/Reports/TopSellingProducts.jsx

import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useAuth } from "../../../../context/AuthContext";
import Pagination from "../../../../components/Pagination";
import SmallSizeModel from "../../../../components/SmallSizeModel";
import { FaChevronLeft, FaChevronRight, FaTimes, FaFilePdf, FaPrint } from "react-icons/fa";


const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const PAGE_SIZE = 100;
const MODAL_PAGE_SIZE = 200;

/* ---------- deterministic color per shop (your original) ---------- */
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

/* ---------- helper: create period list & nav behavior (mirrors SalesReports) ---------- */
const getPeriodDates = (filter, referenceDate) => {
  const periods = [];
  const ref = new Date(referenceDate);

  if (filter === "day") {
    for (let i = 0; i <= 0; i++) {
      // single day at referenceDate
      const d = new Date(ref);
      periods.push(d);
    }
  } else if (filter === "week") {
    const dayOfWeek = ref.getDay();
    const thisWeekStart = new Date(ref);
    thisWeekStart.setDate(ref.getDate() - dayOfWeek); // Sunday start
    periods.push({ start: new Date(thisWeekStart), end: new Date(thisWeekStart.setDate(thisWeekStart.getDate() + 6)) });
  } else if (filter === "month") {
    const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
    periods.push(monthStart);
  } else if (filter === "year") {
    const yearStart = new Date(ref.getFullYear(), 0, 1);
    periods.push(yearStart);
  }

  return periods;
};

const formatPeriodLabel = (filter, referenceDate) => {
  const ref = new Date(referenceDate);
  if (filter === "day") {
    return ref.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } else if (filter === "week") {
    const dayOfWeek = ref.getDay();
    const start = new Date(ref);
    start.setDate(ref.getDate() - dayOfWeek);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} - ${end.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
  } else if (filter === "month") {
    return ref.toLocaleString("default", { month: "short", year: "numeric" });
  } else if (filter === "year") {
    return ref.getFullYear().toString();
  }
  return "";
};

/* ---------- prevent future navigation ---------- */
const isNextAllowed = (filter, referenceDate) => {
  const today = new Date();
  const ref = new Date(referenceDate);

  if (filter === "day") {
    // next day allowed only if ref < today (date only)
    const refDateOnly = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return refDateOnly < todayDateOnly;
  } else if (filter === "week") {
    const dayOfWeek = ref.getDay();
    const start = new Date(ref);
    start.setDate(ref.getDate() - dayOfWeek);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    // next allowed if end < today
    const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return endDateOnly < todayDateOnly;
  } else if (filter === "month") {
    // next allowed if month < current month/year
    if (ref.getFullYear() < today.getFullYear()) return true;
    if (ref.getFullYear() === today.getFullYear() && ref.getMonth() < today.getMonth()) return true;
    return false;
  } else if (filter === "year") {
    return ref.getFullYear() < today.getFullYear();
  }
  return false;
};


export default function TopSellingProducts() {
  const { getToken } = useAuth();
  const [shops, setShops] = useState([]);

  const [shopsWithProducts, setShopsWithProducts] = useState({});
  const [modalTotalPages, setModalTotalPages] = useState(1);
  const [modalTotal, setModalTotal] = useState(0);
  const [pageMap, setPageMap] = useState({});
  const [searchMap, setSearchMap] = useState({});
  const [intervalRef, setIntervalRef] = useState(null);

  // date filter UI state (global)
  const [filter, setFilter] = useState("All"); // default All (Pascal case as requested)
  const [periodDate, setPeriodDate] = useState(new Date()); // reference date for the period

  // modal state for viewing one shop full data
  const [modalShop, setModalShop] = useState(null);
  const [modalSearch, setModalSearch] = useState("");
  const [modalPage, setModalPage] = useState(1);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalProducts, setModalProducts] = useState([]);


  const [confirmType, setConfirmType] = useState(null); // "print" | "pdf"
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // fetch shops list
  const fetchShops = async () => {
    try {
      const token = getToken();
      if (!token) throw new Error("No auth token found");

      const shopsRes = await axios.get(`${API}/api/shops?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const shopData = shopsRes.data?.shops || [];

      // map with colors
      const mapped = shopData.map((s) => ({
        ...s,
        color: colorForShop(s.shopname),
      }));
      setShops(mapped);
    } catch (err) {
      console.error("Failed to fetch shops:", err);
      setShops([]);
    }
  };

  // create start/end for current filter/periodDate
  const buildFromTo = (filter, referenceDate) => {
    const ref = new Date(referenceDate);
    let from, to;
    if (filter === "day") {
      from = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
      to = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
    } else if (filter === "week") {
      const dayOfWeek = ref.getDay();
      const start = new Date(ref);
      start.setDate(ref.getDate() - dayOfWeek);
      from = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      to = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
    } else if (filter === "month") {
      from = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
      to = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (filter === "year") {
      from = new Date(ref.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = new Date(ref.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else {
      // 'All' or unknown -> return nulls (frontend will omit params)
      from = null;
      to = null;
    }
    return { from, to };
  };

  // fetch top products per shop for the current date range
  const fetchTopSelling = async ({
    shopId,
    search = "",
    page = 1,
    limit = 100
  }) => {
    try {
      const token = getToken();
      if (!token) return;

      const { from, to } = buildFromTo(filter, periodDate);

      const res = await axios.get(
        `${API}/api/reports/top-selling/all-shops`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            ...(from && to && {
              from: from.toISOString(),
              to: to.toISOString()
            }),
            ...(search && { search }),
            shopId,
            page,
            limit
          }
        }
      );

      const shopData = res.data?.shops?.[0];

      setShopsWithProducts((prev) => ({
        ...prev,
        [shopId]: {
          products: shopData?.products || [],
          page: shopData?.page,
          totalPages: shopData?.totalPages,
          total: shopData?.total
        }
      }));

    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  useEffect(() => {
    if (!shops.length) return;

    shops.forEach((shop) => {
      fetchTopSelling({
        shopId: shop._id,
        page: 1,
        limit: 100
      });
    });

  }, [shops, filter, periodDate]);

  // pagination per shop
  const handlePageChange = (shopId, page) => {
    setPageMap((prev) => ({ ...prev, [shopId]: page }));
  };

  const handleSearchChange = (shopId, value) => {
    setSearchMap((prev) => ({ ...prev, [shopId]: value }));
  };

  // prev/next navigation handlers for global periodDate
  const handlePrev = () => {
    const d = new Date(periodDate);
    if (filter === "day") d.setDate(d.getDate() - 1);
    else if (filter === "week") d.setDate(d.getDate() - 7);
    else if (filter === "month") d.setMonth(d.getMonth() - 1);
    else if (filter === "year") d.setFullYear(d.getFullYear() - 1);
    setPeriodDate(d);
  };

  const handleNext = () => {
    const d = new Date(periodDate);
    if (!isNextAllowed(filter, periodDate)) return;
    if (filter === "day") d.setDate(d.getDate() + 1);
    else if (filter === "week") d.setDate(d.getDate() + 7);
    else if (filter === "month") d.setMonth(d.getMonth() + 1);
    else if (filter === "year") d.setFullYear(d.getFullYear() + 1);
    setPeriodDate(d);
  };

  // Modal: open and fetch all products for that shop & selected range (full list)
  const openModalForShop = async (shop) => {
    setModalShop(shop);
    setModalSearch("");
    setModalLoading(true);

   await fetchModalData(1, "", shop._id);

    setModalLoading(false);
  };

  const closeModal = () => {
    setModalShop(null);
    setModalProducts([]);
    setModalSearch("");
    setModalPage(1);
  };

 



  const fetchModalData = async (page = 1, search = "", shopId) => {
    const token = getToken();

    const { from, to } = buildFromTo(filter, periodDate);

    const res = await axios.get(
      `${API}/api/reports/top-selling/all-shops`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          shopId: shopId || modalShop?._id,
          ...(from && to && {
            from: from.toISOString(),
            to: to.toISOString()
          }),
          ...(search && { search }),
          page,
          limit: 200
        }
      }
    );

    const shopData = res.data?.shops?.[0];

    setModalProducts(shopData?.products || []);
    setModalPage(shopData?.page || 1);
    setModalTotalPages(shopData?.totalPages || 1);
    setModalTotal(shopData?.total || 0);
  };

  const buildModalParams = () => {
    const { from, to } = buildFromTo(filter, periodDate);
    const params = {};
    if (from && to) {
      params.from = from.toISOString();
      params.to = to.toISOString();
    }
    return params;
  };



  const handleModalPrint = async () => {
    try {
      const token = getToken();

      await axios.get(
        `${API}/api/shops/${encodeURIComponent(modalShop.shopname)}/report/products/top-selling/print`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: buildModalParams(),
        }
      );
    } catch (err) {
      console.error("❌ Top Selling Print failed", err);
      alert("Print failed");
    }
  };



  const handleModalPdf = async () => {
    try {
      const token = getToken();

      const res = await axios.get(
        `${API}/api/shops/${encodeURIComponent(modalShop.shopname)}/report/products/top-selling/pdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: buildModalParams(),
          responseType: "blob",
        }
      );

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${modalShop.shopname}_Top_Selling_Products.pdf`;
      a.click();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("❌ Top Selling PDF failed", err);
      alert("PDF failed");
    }
  };



  const handleConfirmAction = async () => {
    try {
      if (saving) return;

      setSaving(true);

      if (confirmType === "print") {
        await handleModalPrint();
      } else {
        await handleModalPdf();
      }

      setShowConfirmModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };



  return (
    <div className="pt-10 sm:pt-10">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6   text-[28px]  text-[#00a76f]">
        Top Selling Products
      </h1>

      {/* top-right filter controls */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12, gap: 8, alignItems: "center" }}>
        {/* filter dropdown small */}
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPeriodDate(new Date()); // reset to today/current period when changing filter
          }}
          style={{
            padding: "6px 8px",
            borderRadius: 6,
            border: "1px solid #ccc",
            fontWeight: 600,
            fontSize: 13,
            width: 120,
            background: "white"
          }}
          title="Select period"
        >
          <option value="All">All</option>
          <option value="day">Day</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
          <option value="year">Yearly</option>
        </select>

        {/* period label with icon-only prev/next - HIDE when filter === 'All' */}
        {filter !== "All" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={handlePrev}
              style={{
                border: "1px solid #ccc",
                borderRadius: 6,
                padding: "6px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "white",
                cursor: "pointer"
              }}
              title="Previous"
            >
              <FaChevronLeft />
            </button>

            {/* date label small box */}
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                fontSize: 13,
                minWidth: 150,
                textAlign: "center",
                background: "#fff"
              }}
            >
              {formatPeriodLabel(filter, periodDate)}
            </div>

            <button
              onClick={handleNext}
              disabled={!isNextAllowed(filter, periodDate)}
              style={{
                border: "1px solid #ccc",
                borderRadius: 6,
                padding: "6px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: isNextAllowed(filter, periodDate) ? "white" : "#f3f4f6",
                cursor: isNextAllowed(filter, periodDate) ? "pointer" : "not-allowed",
              }}
              title="Next"
            >
              <FaChevronRight />
            </button>
          </div>
        )}
      </div>

      {/* shops grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(450px, 1fr))",
          gap: 16,
        }}
      >
        {shops.map((shop) => {


          const shopData = shopsWithProducts[shop._id] || {};
          const products = shopData.products || [];

          return (
            <div
              key={shop._id}
              className="fade-in"
              style={{
                background: "#ffffff",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
              }}
            >
              {/* header: shop name & mini search + view */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#15803d",
                      margin: 0,
                      cursor: "default",
                    }}
                  >
                    {shop.shopname}
                  </h2>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchMap[shop._id] || ""}
                    // onChange={(e) => handleSearchChange(shop._id, e.target.value)}
                    onChange={(e) => {
                      const value = e.target.value;

                      setSearchMap((prev) => ({
                        ...prev,
                        [shop._id]: value
                      }));

                      fetchTopSelling({
                        shopId: shop._id,
                        search: value,
                        page: 1,
                        limit: 100
                      });
                    }}
                    style={{
                      fontSize: 13,
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #ccc",
                      width: 140,
                      outline: "none",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#15803d")}
                    onBlur={(e) => (e.target.style.borderColor = "#ccc")}
                  />

                  <button
                    onClick={() => openModalForShop(shop)}
                    style={{
                      fontSize: 13,
                      background: "transparent",
                      border: "none",
                      color: "#0f172a",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                    title={`View all for ${shop.shopname}`}
                  >
                    View
                  </button>
                </div>
              </div>

              {/* table */}
              {products.length > 0 ? (
                <>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "separate",
                      borderSpacing: 0,
                      tableLayout: "fixed", // 🔥 CHANGE (auto → fixed)
                    }}
                  >
                    {/* ✅ HEADER FIXED */}
                    <thead style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                      <tr style={{ background: "#f3f4f6" }}>
                        {["S.No", "Code", "Product", "Qty Sold", "Value"].map((h, idx) => {
                          const widths = ["10%", "20%", "40%", "15%", "15%"]; // 🔥 ADD

                          return (
                            <th
                              key={h}
                              style={{
                                width: widths[idx], // 🔥 ADD
                                textAlign:
                                  h === "Qty Sold" || h === "Value" ? "right" : "left",
                                color: "#111",
                                fontWeight: 700,
                                padding: "12px 10px",
                                borderBottom: "1px solid #e5e7eb",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {h}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>

                    {/* ✅ SCROLL BODY */}
                    <tbody
                      style={{
                        display: "block",        // 🔥 IMPORTANT
                        maxHeight: "400px",      // 🔥 SCROLL HEIGHT
                        overflowY: "auto",       // 🔥 ENABLE SCROLL
                        width: "100%",
                      }}
                    >
                      {products.map((p, i) => (
                        <tr
                          key={`${shop._id}-${p.code || i}`}
                          style={{
                            display: "table",     // 🔥 IMPORTANT
                            width: "100%",
                            tableLayout: "fixed",
                            borderTop: "1px solid #e5e7eb",
                          }}
                          className="hover:bg-green-50"
                        >
                          <td style={{ width: "10%", padding: "12px 10px" }}>
                            {((shopData.page || 1) - 1) * 100 + i + 1}
                          </td>

                          <td style={{ width: "20%", padding: "12px 10px" }}>
                            {p.code}
                          </td>

                          <td
                            style={{
                              width: "40%",
                              padding: "12px 10px",
                              wordBreak: "break-word",
                            }}
                          >
                            {p.name}
                          </td>

                          <td
                            style={{
                              width: "15%",
                              padding: "12px 10px",
                              textAlign: "right",
                            }}
                          >
                            {p.totalQty}
                          </td>

                          <td
                            style={{
                              width: "15%",
                              padding: "12px 10px",
                              textAlign: "right",
                            }}
                          >
                            ₹{Number(p.totalValue || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {(shopData.totalPages || 1) > 1 && (
                    <div style={{ marginTop: 8 }}>
                      <Pagination
                        page={shopData.page || 1}
                        totalPages={shopData.totalPages || 1}
                        onPageChange={(p) =>
                          fetchTopSelling({
                            shopId: shop._id,
                            search: searchMap[shop._id] || "",
                            page: p,
                            limit: 100
                          })
                        }
                      />
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 14, color: "#888" }}>No products sold</div>
              )}
            </div>
          );
        })}
      </div>


      {modalShop && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={closeModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(1100px, 98%)",
              maxHeight: "90vh",
              overflow: "hidden",
              background: "#fff",
              borderRadius: 12,
              padding: 18,
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{modalShop.shopname} — Top Selling Products</h3>



              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Search product..."
                  value={modalSearch}
                  onChange={(e) => {
                    const value = e.target.value;
                    setModalSearch(value);
                    setModalPage(1);

                    fetchModalData(1, value);
                  }}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    outline: "none",
                    width: 220,
                  }}
                />


                <div className="flex items-center gap-2">


                  {/* PRINT */}
                  <button
                    // onClick={handleModalPrint}


                    onClick={() => {
                      setConfirmType("print");
                      setShowConfirmModal(true);
                    }}

                    className="
      inline-flex items-center gap-2 justify-center
      px-4 py-2 rounded-lg font-semibold
      text-[#007867] bg-[#c8fad6]
      shadow-[0_8px_24px_rgba(0,0,0,0.08)]
      transition-all duration-150
      hover:-translate-y-[1px]
      active:translate-y-0
    "
                  >
                    <FaPrint />
                    print
                  </button>

                  {/* PDF */}
                  <button
                    // onClick={handleModalPdf}


                    onClick={() => {
                      setConfirmType("pdf");
                      setShowConfirmModal(true);
                    }}
                    className="
      inline-flex items-center gap-2 justify-center
      px-4 py-2 rounded-lg font-semibold
      text-[#007867] bg-[#c8fad6]
      shadow-[0_8px_24px_rgba(0,0,0,0.08)]
      transition-all duration-150
      hover:-translate-y-[1px]
      active:translate-y-0
    "
                  >
                    <FaFilePdf />
                    pdf
                  </button>
                </div>
                <button
                  onClick={closeModal}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "#0f172a",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 6,
                    borderRadius: 6
                  }}
                  title="Close"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {modalLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#00A76F", fontWeight: 600 }}>Loading…</div>
            ) : (
              <>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
                  <thead style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                    <tr style={{ background: "#f3f4f6" }}>
                      {["S.No", "Code", "Product", "Qty Sold", "Value"].map((h, idx) => {
                        const widths = ["10%", "20%", "40%", "15%", "15%"]; // 🔥 IMPORTANT

                        return (
                          <th
                            key={h}
                            style={{
                              width: widths[idx], // 🔥 ADD THIS
                              textAlign:
                                h === "Qty Sold" || h === "Value" ? "right" : "left",
                              color: "#111",
                              fontWeight: 700,
                              padding: "12px 10px",
                              borderBottom: "1px solid #e5e7eb",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody
                    style={{
                      display: "block",
                      maxHeight: "calc(90vh - 250px)", // 🔥 IMPORTANT
                      // maxHeight: "400px" ,  // or 250px / 300px
                      overflowY: "auto",
                      width: "100%",
                    }}
                  >
                    {modalProducts.length > 0 ? (
                      modalProducts.map((p, i) => (
                        <tr key={`${modalShop._id}-${p.code || i}`}
                          style={{
                            display: "table",
                            width: "100%",
                            tableLayout: "fixed",
                            borderTop: "1px solid #e5e7eb",
                          }}>
                          <td style={{ width: "10%", padding: "12px 10px" }}>{((modalPage - 1) * 200) + i + 1}</td>
                          <td style={{ width: "20%", padding: "12px 10px" }}>{p.code}</td>
                          <td style={{ width: "40%", padding: "12px 10px" }}>{p.name}</td>
                          <td style={{ width: "15%", padding: "12px 10px", textAlign: "right" }}>{p.totalQty}</td>
                          <td style={{ width: "15%", padding: "12px 10px", textAlign: "right" }}>₹{Number(p.totalValue || 0).toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#777" }}>
                          No products found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>



                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    alignItems: "center",
                  }}
                >
                  {/* LEFT: INFO */}
                  <div style={{ color: "#666", fontSize: 13 }}>
                    Showing {(modalPage - 1) * 200 + 1} -{" "}
                    {Math.min(modalPage * 200, modalTotal)} of {modalTotal}
                  </div>

                  {/* CENTER: PAGINATION */}
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <Pagination
                      page={modalPage}
                      totalPages={modalTotalPages}
                      onPageChange={(p) => {
                        setModalPage(p);
                        fetchModalData(p, modalSearch);
                      }}
                    />
                  </div>

                  {/* RIGHT: EMPTY (BALANCE COLUMN) */}
                  <div />
                </div>

              </>
            )}
          </div>
        </div>
      )}



      {showConfirmModal && (
        <SmallSizeModel
          title={confirmType === "print" ? "Confirm Print" : "Confirm PDF Download"}
          width="max-w-md"
          onClose={() => setShowConfirmModal(false)}
        >
          <div className="min-h-[180px] flex flex-col items-center justify-center text-center px-4">

            {/* MESSAGE */}
            <p className="text-base font-medium text-gray-800">
              Are you sure you want to
            </p>

            <p className="text-lg font-semibold text-dasher mt-1">
              {confirmType === "print" ? "Print" : "Download PDF"}?
            </p>

            {/* DETAILS */}
            <div className="mt-3 text-sm text-gray-500">
              <div>
                Shop:{" "}
                <span className="font-semibold text-gray-700">
                  {modalShop?.shopname}
                </span>
              </div>

              <div>
                Period:{" "}
                <span className="font-semibold text-gray-700">
                  {filter === "All"
                    ? "All"
                    : formatPeriodLabel(filter, periodDate)}
                </span>
              </div>

              <div>
                Total Products:{" "}
                <span className="font-semibold text-gray-700">
                 {modalTotal}
                </span>
              </div>
            </div>

            {/* CONFIRM BUTTON 🔥 */}
            <button
              onClick={handleConfirmAction}
              disabled={saving}
              className={`
          inline-flex items-center justify-center m-3 gap-2
          px-4 py-2 w-44
          rounded-lg font-semibold
          text-[#007867]
          bg-[#c8fad6]
          shadow-[0_8px_24px_rgba(0,0,0,0.08)]
          transition-all duration-150
          hover:-translate-y-[1px]
          active:translate-y-0
          ${saving ? "opacity-70 cursor-not-allowed" : ""}
        `}
            >
              {saving && (
                <span className="w-4 h-4 border-2 border-[#00A76F] border-t-transparent rounded-full animate-spin"></span>
              )}

              {saving
                ? confirmType === "print"
                  ? "Printing..."
                  : "Generating PDF..."
                : "Confirm"}
            </button>

          </div>
        </SmallSizeModel>
      )}
    </div>
  );
}


