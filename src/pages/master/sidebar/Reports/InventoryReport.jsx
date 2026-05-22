
// src/pages/master/sidebar/Reports/InventoryReport.jsx
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useAuth } from "../../../../context/AuthContext";
import { useShop } from "../../../../context/ShopContext";
import { useNavigate } from "react-router-dom";
import Pagination from "../../../../components/Pagination";
import SmallSizeModel from "../../../../components/SmallSizeModel";
import { FaChevronLeft, FaChevronRight, FaTimes, FaPrint, FaFilePdf } from "react-icons/fa";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const PAGE_SIZE = 100;
const MODAL_PAGE_SIZE = 200;

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

// Format period label (same logic as TopSellingProducts)
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

const isNextAllowed = (filter, referenceDate) => {
  const today = new Date();
  const ref = new Date(referenceDate);

  if (filter === "day") {
    const refDateOnly = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return refDateOnly < todayDateOnly;
  } else if (filter === "week") {
    const dayOfWeek = ref.getDay();
    const start = new Date(ref);
    start.setDate(ref.getDate() - dayOfWeek);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return endDateOnly < todayDateOnly;
  } else if (filter === "month") {
    if (ref.getFullYear() < today.getFullYear()) return true;
    if (ref.getFullYear() === today.getFullYear() && ref.getMonth() < today.getMonth()) return true;
    return false;
  } else if (filter === "year") {
    return ref.getFullYear() < today.getFullYear();
  }
  return false;
};

export default function InventoryReportS() {
  const { getToken } = useAuth();
  const { setSelectedShop } = useShop();
  const navigate = useNavigate();

  const [shops, setShops] = useState([]);

  const [shopsWithInventory, setShopsWithInventory] = useState({});
  const [pageMap, setPageMap] = useState({});
  const [searchMap, setSearchMap] = useState({});
  const intervalRef = useRef(null);

  // date filter UI state (global)
  const [filter, setFilter] = useState("All"); // default All
  const [periodDate, setPeriodDate] = useState(new Date());

  // modal state
  const [modalShop, setModalShop] = useState(null);
  const [modalSearch, setModalSearch] = useState("");
  const [modalPage, setModalPage] = useState(1);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalProducts, setModalProducts] = useState([]);

  const [modalTotalPages, setModalTotalPages] = useState(1);

  const [modalTotal, setModalTotal] = useState(0);
  const [confirmType, setConfirmType] = useState(null); // "print" | "pdf"
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // fetch shops list
  const fetchShops = async () => {
    try {
      const token = getToken();
      if (!token) return;

      const shopsRes = await axios.get(`${API}/api/shops?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const shopData = shopsRes.data?.shops || [];
      const mapped = shopData.map((s) => ({ ...s, color: colorForShop(s.shopname) }));
      setShops(mapped);
    } catch (err) {
      console.error("Failed to fetch shops:", err);
      setShops([]);
    }
  };

  // build from/to identical to TopSellingProducts
  const buildFromTo = (filter, referenceDate) => {
    const ref = new Date(referenceDate);
    let from = null;
    let to = null;
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
      from = null;
      to = null;
    }
    return { from, to };
  };


  // fetch inventory per shop
  const fetchInventory = async ({
    shopId = "",
    search = "",
    page = 1,
    limit = 100
  } = {}) => {
    try {
      const token = getToken();
      if (!token) return;

      const { from, to } = buildFromTo(filter, periodDate);

      const res = await axios.get(
        `${API}/api/reports/inventory/all-shops`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            ...(from && to && {
              from: from.toISOString(),
              to: to.toISOString()
            }),
            ...(shopId && { shopId }),
            ...(search && { search }),
            page,
            limit
          }
        }
      );

      const data = res.data?.shops || [];

      // 🔥 IMPORTANT: store by shopId
      const mapped = {};
      data.forEach((s) => {
        mapped[s.shopId] = s;
      });

      setShopsWithInventory(mapped);

    } catch (err) {
      console.error("Fetch inventory error:", err);
      setShopsWithInventory({});
    }
  };


  useEffect(() => {
    fetchShops();
  }, []);

  useEffect(() => {
    if (shops.length) {
      shops.forEach((s) => {
        fetchInventory({
          shopId: s._id,
          page: 1,
          limit: 100
        });
      });
    }
  }, [shops, filter, periodDate]);


  const handlePageChange = (shopId, page) => {
    setPageMap((prev) => ({ ...prev, [shopId]: page }));
  };

  const handleSearchChange = (shopId, value) => {
    setSearchMap((prev) => ({ ...prev, [shopId]: value }));
  };

  // prev/next handlers
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


  const fetchModalPage = async (page, search = "") => {
    try {
      const token = getToken();

      const { from, to } = buildFromTo(filter, periodDate);

      const res = await axios.get(
        `${API}/api/reports/inventory/all-shops`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            shopId: modalShop._id,
            search,
            page,
            limit: 200,
            ...(from && to && {
              from: from.toISOString(),
              to: to.toISOString()
            })
          }
        }
      );

      const shopData = res.data?.shops?.[0];

      setModalProducts(shopData?.products || []);
      setModalTotalPages(shopData?.totalPages || 1);
      setModalPage(page);
      setModalTotal(shopData?.total || 0);

    } catch (err) {
      console.error(err);
    }
  };

  // Modal open - full data for the shop (limitless list)
  const openModalForShop = async (shop) => {
    setModalShop(shop);
    setModalPage(1);
    setModalSearch("");
    setModalLoading(true);

    try {
      const token = getToken();
      if (!token) throw new Error("No auth token");

      const { from, to } = buildFromTo(filter, periodDate);

      const res = await axios.get(
        `${API}/api/reports/inventory/all-shops`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            shopId: shop._id,        // ✅ CRITICAL
            ...(from && to && {
              from: from.toISOString(),
              to: to.toISOString()
            }),
            page: 1,                 // ✅ pagination
            limit: 200               // ✅ modal size
          }
        }
      );

      // ✅ DIRECT DATA (no find)
      const shopData = res.data?.shops?.[0];

      const list = (shopData?.products || []).map((p) => ({
        _id: p.code,
        code: p.code,
        name: p.name,
        qty: p.totalQty || 0,
        rate: p.rate || 0,
        totalValue: p.totalValue || 0,
      }));

      setModalProducts(list);

      // ✅ IMPORTANT (for pagination UI)
      setModalTotalPages(shopData?.totalPages || 1);
      setModalTotal(shopData?.total || 0);

    } catch (err) {
      console.error("Failed to fetch modal products:", err);
      setModalProducts([]);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setModalShop(null);
    setModalProducts([]);
    setModalSearch("");
    setModalPage(1);
  };




  const buildInventoryParams = () => {
    const { from, to } = buildFromTo(filter, periodDate);
    const params = {};
    if (from && to) {
      params.from = from.toISOString();
      params.to = to.toISOString();
    }
    return params;
  };


  const handleInventoryPrint = async () => {
    try {
      const token = getToken();
      if (!token || !modalShop) return;

      await axios.get(
        `${API}/api/shops/${encodeURIComponent(
          modalShop.shopname
        )}/report/products/inventory/print`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: buildInventoryParams(),
        }
      );
    } catch (err) {
      console.error("❌ Inventory Print failed", err);
      alert("Inventory print failed");
    }
  };



  const handleInventoryPdf = async () => {
    try {
      const token = getToken();
      if (!token || !modalShop) return;

      const res = await axios.get(
        `${API}/api/shops/${encodeURIComponent(
          modalShop.shopname
        )}/report/products/inventory/pdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: buildInventoryParams(),
          responseType: "blob",
        }
      );

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${modalShop.shopname}_Inventory_Report.pdf`;
      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("❌ Inventory PDF failed", err);
      alert("Inventory PDF failed");
    }
  };


  const handleConfirmAction = async () => {
    try {
      if (saving) return;

      setSaving(true);

      if (confirmType === "print") {
        await handleInventoryPrint();
      } else {
        await handleInventoryPdf();
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
        Stock Value
      </h1>

      {/* top-right filter controls */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12, gap: 8, alignItems: "center" }}>
        {/* filter dropdown small */}
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPeriodDate(new Date());
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 16,
        }}
      >
        {shops.map((shop) => {

          const shopData = shopsWithInventory[shop._id] || {};
          const products = shopData.products || [];

          return (
            <div
              key={shop._id || `shop-${shop.shopname}`}
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#15803d",
                    margin: 0,
                    cursor: "default",
                    transition: "color 0.2s",
                  }}
                >
                  {shop.shopname}
                </h2>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Search product..."
                    value={searchMap[shop._id] || ""}
                    onChange={(e) => {
                      const value = e.target.value;

                      handleSearchChange(shop._id, value);

                      fetchInventory({
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

              {products.length > 0 ? (
                <>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "separate",
                      borderSpacing: 0,
                      tableLayout: "fixed",
                    }}
                  >
                    <thead style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                      <tr style={{ background: "#f3f4f6" }}>
                        {["S.No", "Product Code", "Product Name", "Qty", "Rate", "Total"].map((h, i) => {
                          const widths = ["10%", "20%", "40%", "10%", "10%", "10%"];

                          return (
                            <th
                              key={h}
                              style={{
                                width: widths[i],
                                padding: "12px 10px",
                                fontWeight: 700,
                                textAlign: h === "Qty" || h === "Rate" || h === "Total" ? "right" : "left",
                                borderBottom: "1px solid #e5e7eb",
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
                        maxHeight: "300px",  // 👈 control height
                        overflowY: "auto",
                        width: "100%",
                      }}
                    >
                      {products.map((p, i) => {
                        const qty = Number(p.totalQty || 0);
                        const totalValue = Number(p.totalValue || 0);
                        const rate = qty ? totalValue / qty : 0;

                        return (
                          <tr
                            key={`${p.code}-${shop.shopname}-${i}`}
                            style={{
                              display: "table",
                              width: "100%",
                              borderTop: "1px solid #e5e7eb",
                              transition: "background 0.2s",
                            }}
                            className="hover:bg-green-50"
                          >
                            <td style={{ width: "10%", padding: "12px 10px" }}>
                              {((shopData.page || 1) - 1) * PAGE_SIZE + i + 1}
                            </td>
                            <td style={{ width: "20%", padding: "12px 10px" }}>
                              {p.code || "-"}
                            </td>
                            <td
                              style={{
                                padding: "12px 10px",
                                wordBreak: "break-word",
                                whiteSpace: "normal",
                                width: "40%",
                              }}
                            >
                              {p.name || "-"}
                            </td>
                            <td
                              style={{
                                padding: "12px 10px",
                                textAlign: "right",
                                width: "10%",
                              }}
                            >
                              {qty}
                            </td>
                            <td
                              style={{
                                padding: "12px 10px",
                                textAlign: "right",
                                width: "10%",
                              }}
                            >
                              {rate.toFixed(2)}
                            </td>
                            <td
                              style={{
                                padding: "12px 10px",
                                textAlign: "right",
                                width: "10%",
                              }}
                            >
                              {totalValue.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {shopData.total > PAGE_SIZE && (
                    <div style={{ marginTop: 8 }}>
                      <Pagination
                        page={page}
                        totalPages={shopData.totalPages || 1}
                        onPageChange={(p) =>
                          fetchInventory({
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
                <div style={{ fontSize: 14, color: "#888" }}>
                  No products found
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal: show full shop table */}
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
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              background: "#fff",
              borderRadius: 12,
              padding: 18,
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{modalShop.shopname} - Stock Value</h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Search product..."
                  value={modalSearch}
                  onChange={(e) => {
                    const value = e.target.value;
                    setModalSearch(value);
                    fetchModalPage(1, value); // ✅ backend search
                  }}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    outline: "none",
                    width: 220,
                  }}
                />

                <div className="flex items-center gap-3">
                  {/* PRINT BUTTON */}
                  <button
                    // onClick={handleInventoryPrint}


                    onClick={() => {
                      setConfirmType("print");
                      setShowConfirmModal(true);
                    }}

                    className="
      inline-flex items-center gap-2 justify-center
      px-4 py-2
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
                    <FaPrint />
                    print
                  </button>

                  {/* PDF BUTTON */}
                  <button
                    // onClick={handleInventoryPdf}


                    onClick={() => {
                      setConfirmType("pdf");
                      setShowConfirmModal(true);
                    }}


                    className="
      inline-flex items-center gap-2 justify-center
      px-4 py-2
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
              // <>
              //   <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              //     <thead>
              //       <tr style={{ background: "#f3f4f6" }}>
              //         {[
              //           "S.No",
              //           "Product Code",
              //           "Product Name",
              //           "Qty",
              //           "Rate",
              //           "Total",
              //         ].map((h) => (
              //           <th
              //             key={h}
              //             style={{
              //               textAlign: h === "Qty" || h === "Rate" || h === "Total" ? "right" : "left",
              //               color: "#111",
              //               fontWeight: 700,
              //               padding: "12px 10px",
              //               borderBottom: "1px solid #e5e7eb",
              //               whiteSpace: "nowrap",
              //             }}
              //           >
              //             {h}
              //           </th>
              //         ))}
              //       </tr>
              //     </thead>
              //     <tbody>
              //       {modalPaged.length > 0 ? (
              //         modalPaged.map((p, i) => (
              //           <tr key={`${modalShop._id}-${p.code || i}`} style={{ borderTop: "1px solid #e5e7eb" }}>
              //             <td style={{ padding: "12px 10px" }}>{(modalPage - 1) * MODAL_PAGE_SIZE + i + 1}</td>
              //             <td style={{ padding: "12px 10px" }}>{p.code}</td>
              //             <td style={{ padding: "12px 10px" }}>{p.name}</td>
              //             <td style={{ padding: "12px 10px", textAlign: "right" }}>{p.qty}</td>
              //             <td style={{ padding: "12px 10px", textAlign: "right" }}>{p.rate.toFixed(2)}</td>
              //             <td style={{ padding: "12px 10px", textAlign: "right" }}>{p.totalValue.toFixed(2)}</td>
              //           </tr>
              //         ))
              //       ) : (
              //         <tr>
              //           <td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#777" }}>
              //             No products found
              //           </td>
              //         </tr>
              //       )}
              //     </tbody>
              //   </table>




              //   <div
              //     style={{
              //       marginTop: 12,
              //       display: "grid",
              //       gridTemplateColumns: "1fr auto 1fr",
              //       alignItems: "center",
              //     }}
              //   >
              //     {/* LEFT: INFO */}
              //     <div style={{ color: "#666", fontSize: 13 }}>
              //       Showing {(modalPage - 1) * MODAL_PAGE_SIZE + 1} -{" "}
              //       {Math.min(modalPage * MODAL_PAGE_SIZE, filteredModalProducts.length)} of{" "}
              //       {filteredModalProducts.length}
              //     </div>

              //     {/* CENTER: PAGINATION */}
              //     <div style={{ display: "flex", justifyContent: "center" }}>
              //       <Pagination
              //         page={modalPage}
              //         totalPages={modalTotalPages}
              //         onPageChange={(p) => setModalPage(p)}
              //       />
              //     </div>


              //     <div />
              //   </div>
              // </>




              <>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: 0,
                    tableLayout: "fixed", // ✅ IMPORTANT
                  }}
                >
                  {/* ✅ FIXED HEADER */}
                  <thead style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                    <tr style={{ background: "#f3f4f6" }}>
                      {[
                        "S.No",
                        "Product Code",
                        "Product Name",
                        "Qty",
                        "Rate",
                        "Total",
                      ].map((h, i) => {
                        const widths = ["10%", "20%", "40%", "10%", "10%", "10%"];

                        return (
                          <th
                            key={h}
                            style={{
                              width: widths[i],
                              textAlign:
                                h === "Qty" || h === "Rate" || h === "Total"
                                  ? "right"
                                  : "left",
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
                      display: "block",
                      maxHeight: "calc(90vh - 250px)", // 🔥 dynamic modal height
                      overflowY: "auto",
                      width: "100%",
                    }}
                  >
                    {modalProducts.length > 0 ? (
                      modalProducts.map((p, i) => (
                        <tr
                          key={`${modalShop._id}-${p.code || i}`}
                          style={{
                            display: "table",
                            width: "100%",
                            tableLayout: "fixed",
                            borderTop: "1px solid #e5e7eb",
                          }}
                        >
                          <td style={{ width: "10%", padding: "12px 10px" }}>
                            {((modalPage - 1) * MODAL_PAGE_SIZE) + i + 1}
                          </td>

                          <td style={{ width: "20%", padding: "12px 10px" }}>
                            {p.code}
                          </td>

                          <td style={{ width: "40%", padding: "12px 10px" }}>
                            {p.name}
                          </td>

                          <td
                            style={{
                              width: "10%",
                              padding: "12px 10px",
                              textAlign: "right",
                            }}
                          >
                            {p.qty}
                          </td>

                          <td
                            style={{
                              width: "10%",
                              padding: "12px 10px",
                              textAlign: "right",
                            }}
                          >
                            {p.rate.toFixed(2)}
                          </td>

                          <td
                            style={{
                              width: "10%",
                              padding: "12px 10px",
                              textAlign: "right",
                            }}
                          >
                            {p.totalValue.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr
                        style={{
                          display: "table",
                          width: "100%",
                          tableLayout: "fixed",
                        }}
                      >
                        <td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#777" }}>
                          No products found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* ✅ KEEP YOUR PAGINATION AS IT IS */}
                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    alignItems: "center",
                  }}
                >
                  <div style={{ color: "#666", fontSize: 13 }}>
                    Showing{" "}
                    {modalTotal === 0
                      ? 0
                      : (modalPage - 1) * MODAL_PAGE_SIZE + 1}{" "}
                    -{" "}
                    {Math.min(modalPage * MODAL_PAGE_SIZE, modalTotal)}{" "}
                    of {modalTotal}
                  </div>

                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <Pagination
                      page={modalPage}
                      totalPages={modalTotalPages}
                      onPageChange={(p) => fetchModalPage(p, modalSearch)}
                    />
                  </div>

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
