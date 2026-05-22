
// src/pages/BranchReports/StockReports.jsx
import React, { useState, useContext, useEffect } from "react";
import axios from "axios";
import { FaChevronLeft, FaChevronRight, FaSearch, FaRedo, FaPrint, FaFilePdf, FaEye } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { ShopContext } from "../../context/ShopContext";

import Pagination from "../../components/Pagination";
import CategoryProductsModal from "../../components/CategoryProductsModal";
import SmallSizeModel from "../../components/SmallSizeModel";

import html2pdf from "html2pdf.js";
import jsPDF from "jspdf";
import "jspdf-autotable";


const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* -------------------- date helpers -------------------- */
const formatPeriodLabel = (filter, ref) => {
  const date = new Date(ref);
  if (filter === "day") {
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  if (filter === "week") {
    const dow = date.getDay();
    const start = new Date(date);
    start.setDate(date.getDate() - dow);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    })} - ${end.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    })}`;
  }
  if (filter === "month")
    return date.toLocaleString("default", { month: "short", year: "numeric" });
  if (filter === "year") return date.getFullYear().toString();
  return "All Period";
};

const isNextAllowed = (filter, refDate) => {
  const today = new Date();
  const ref = new Date(refDate);
  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  if (filter === "day") {
    const r = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    return r < todayOnly;
  }
  if (filter === "week") {
    const dow = ref.getDay();
    const start = new Date(ref);
    start.setDate(ref.getDate() - dow);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    return endOnly < todayOnly;
  }
  if (filter === "month") {
    return (
      ref.getFullYear() < today.getFullYear() ||
      (ref.getFullYear() === today.getFullYear() &&
        ref.getMonth() < today.getMonth())
    );
  }
  if (filter === "year") return ref.getFullYear() < today.getFullYear();
  return false;
};

const buildFromTo = (filter, refDate, fromCustom, toCustom) => {
  const ref = new Date(refDate);
  if (filter === "custom") {
    return {
      from: fromCustom ? new Date(fromCustom) : null,
      to: toCustom
        ? new Date(new Date(toCustom).setHours(23, 59, 59, 999))
        : null,
    };
  }

  let from = null,
    to = null;

  if (filter === "day") {
    from = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0);
    to = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59);
  } else if (filter === "week") {
    const dow = ref.getDay();
    const start = new Date(ref);
    start.setDate(ref.getDate() - dow);
    from = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
      0,
      0,
      0
    );
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    to = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
  } else if (filter === "month") {
    from = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0);
    to = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59);
  } else if (filter === "year") {
    from = new Date(ref.getFullYear(), 0, 1, 0, 0, 0);
    to = new Date(ref.getFullYear(), 11, 31, 23, 59, 59);
  }

  return { from, to };
};

/* -------------------- Build API URL -------------------- */
const buildApiUrl = (path, user, selectedShopName) => {
  const ep = path.replace(/^\/+/, "");
  if (!user) return `${API}/api/${ep}`;
  if (user.role === "tenant") return `${API}/api/${ep}`;

  if (
    (user.role === "manager" || user.role === "megaadmin") &&
    selectedShopName
  ) {
    return `${API}/api/tenant/shops/${encodeURIComponent(
      selectedShopName
    )}/${ep}`;
  }

  return `${API}/api/${ep}`;
};


const StockReports = () => {
  const { user } = useAuth();
  const { selectedShop } = useContext(ShopContext);
  const shopname =
    selectedShop?.shopname || user?.shopname || localStorage.getItem("shopname");

  // Controls
  const [mode, setMode] = useState(""); // 'stock' OR 'category'
  const [counter, setCounter] = useState("");
  const [filter, setFilter] = useState("All");
  const [periodDate, setPeriodDate] = useState(new Date());
  const [fromCustom, setFromCustom] = useState("");
  const [toCustom, setToCustom] = useState("");

  // Data
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ totalStock: 0, soldQty: 0 });

  const [showResults, setShowResults] = useState(false);

  const [firstHistoryDate, setFirstHistoryDate] = useState(null);
  const [lastHistoryDate, setLastHistoryDate] = useState(null);


  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 100;


  // 🔍 Category modal state
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Modal product data (ALL products for print/pdf)
  const [categoryProducts, setCategoryProducts] = useState([]);

  // UI (paginated)
  const [categoryProductsAll, setCategoryProductsAll] = useState([]); // Print / PDF (FULL)
  const [categoryPagination, setCategoryPagination] = useState(null);

  const [confirmType, setConfirmType] = useState(null); // "print" | "pdf"
  const [showConfirmModal, setShowConfirmModal] = useState(false);


  const [saving, setSaving] = useState(false);



  // Token
  const token = localStorage.getItem("token");
  const getHeaders = () => {
    const h = { Authorization: `Bearer ${token}` };
    if (shopname) h["x-shopname"] = shopname;
    return h;
  };

  useEffect(() => {
    setShowResults(false);
  }, [filter, periodDate, fromCustom, toCustom, counter, mode]);

  /* -------------------------- Prev/Next -------------------------- */
  const handlePrev = () => {
    const d = new Date(periodDate);
    if (filter === "day") d.setDate(d.getDate() - 1);
    else if (filter === "week") d.setDate(d.getDate() - 7);
    else if (filter === "month") d.setMonth(d.getMonth() - 1);
    else if (filter === "year") d.setFullYear(d.getFullYear() - 1);
    setPeriodDate(d);
  };

  const handleNext = () => {
    if (!isNextAllowed(filter, periodDate)) return;
    const d = new Date(periodDate);
    if (filter === "day") d.setDate(d.getDate() + 1);
    else if (filter === "week") d.setDate(d.getDate() + 7);
    else if (filter === "month") d.setMonth(d.getMonth() + 1);
    else if (filter === "year") d.setFullYear(d.getFullYear() + 1);
    setPeriodDate(d);
  };

  /* ============================================================
     FETCH — PRODUCT WISE
     ============================================================ */
  const fetchStockReport = async () => {
    if (mode !== "stock") return;

    try {
      setLoading(true);

      const { from, to } = buildFromTo(
        filter,
        periodDate,
        fromCustom,
        toCustom
      );

      // const params = {};

      const params = {
        page,
        limit: pageSize,
      };


      if (from && to) {
        params.from = from.toISOString();
        params.to = to.toISOString();
      }
      if (counter.trim()) params.counter = counter.trim();

      const url = buildApiUrl("branch-reports/stock", user, shopname);
      const res = await axios.get(url, { params, headers: getHeaders() });

      const dataRows = Array.isArray(res.data?.rows) ? res.data.rows : [];
      const backendSummary = res.data?.summary || {};

      setRows(dataRows);
      setSummary({
        totalStock:
          backendSummary.totalStock ??
          dataRows.reduce(
            (sum, r) => sum + Number(r.closingStock ?? r.totalStock ?? 0),
            0
          ),
        soldQty:
          backendSummary.soldQty ??
          dataRows.reduce((sum, r) => sum + Number(r.sold ?? 0), 0),
      });

      setTotalPages(res.data.pagination?.totalPages || 1);



      setShowResults(true);



      // --------------------------------------
      // GET FIRST & LAST HISTORY DATES
      // --------------------------------------
      // let minDate = null;
      // let maxDate = null;

      // dataRows.forEach((prod) => {
      //   if (Array.isArray(prod.history)) {
      //     prod.history.forEach((h) => {
      //       if (!h.date) return;
      //       const d = new Date(h.date);
      //       if (!minDate || d < minDate) minDate = d;
      //       if (!maxDate || d > maxDate) maxDate = d;
      //     });
      //   }
      // });

      // setFirstHistoryDate(minDate);
      // setLastHistoryDate(maxDate);



      setFirstHistoryDate(
        res.data.firstHistoryDate
          ? new Date(res.data.firstHistoryDate)
          : null
      );

      setLastHistoryDate(
        res.data.lastHistoryDate
          ? new Date(res.data.lastHistoryDate)
          : null
      );


    } catch (err) {
      console.error("❌ fetchStockReport error:", err);
      setRows([]);
      setSummary({ totalStock: 0, soldQty: 0 });
      setShowResults(true);
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     FETCH — CATEGORY WISE
     ============================================================ */


  const fetchCategoryWise = async () => {
    if (mode !== "category") return;

    try {
      setLoading(true);

      const { from, to } = buildFromTo(
        filter,
        periodDate,
        fromCustom,
        toCustom
      );

      const params = {
        page,
        limit: pageSize,
      };

      if (from && to) {
        params.from = from.toISOString();
        params.to = to.toISOString();
      }

      const url = buildApiUrl(
        "branch-reports/stock/categorywise",
        user,
        shopname
      );

      const res = await axios.get(url, {
        params,
        headers: getHeaders(),
      });

      setRows(res.data.rows || []);
      setTotalPages(res.data.pagination?.totalPages || 1);

      setFirstHistoryDate(
        res.data.firstHistoryDate ? new Date(res.data.firstHistoryDate) : null
      );
      setLastHistoryDate(
        res.data.lastHistoryDate ? new Date(res.data.lastHistoryDate) : null
      );

      setShowResults(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (!showResults) return;

    if (mode === "stock") fetchStockReport();
    if (mode === "category") fetchCategoryWise();
  }, [page]);


  useEffect(() => {
    setPage(1);
  }, [mode, filter, periodDate, fromCustom, toCustom, counter]);



  const fetchCategoryProductsAll = async (category, page = 1) => {
    try {
      const { from, to } = buildFromTo(
        filter,
        periodDate,
        fromCustom,
        toCustom
      );

      const res = await axios.get(
        buildApiUrl("branch-reports/stock/category/products", user, shopname),
        {
          params: {
            category,
            page,          // 👈 UI pagination
            all: true,      // same as ROWS_PER_PAGE
            from: from ? from.toISOString() : null,
            to: to ? to.toISOString() : null,
          },
          headers: getHeaders(),
        }
      );

      const data = res.data.rows || [];

      setCategoryProducts(data);
      setCategoryProductsAll(data); // ✅ FIX
      // ✅ pagination info
      setCategoryPagination(res.data.pagination || null);
    } catch (err) {
      console.error("❌ fetchCategoryProductsAll", err);
      setCategoryProducts([]);
      setCategoryProductsAll([]);
      setCategoryPagination(null);
    }
  };





  /* ============================================================
     SEARCH
     ============================================================ */
  const handleSearchClick = () => {
    if (mode === "stock") fetchStockReport();
    else if (mode === "category") fetchCategoryWise();
  };

  /* ============================================================
     RESET
     ============================================================ */
  const handleReset = () => {
    setMode("");
    setCounter("");
    setFilter("All");
    setPeriodDate(new Date());
    setFromCustom("");
    setToCustom("");
    setRows([]);
    setSummary({ totalStock: 0, soldQty: 0 });
    setShowResults(false);
  };




  let periodLabel = "";

  // ⭐ CUSTOM DATE FILTER
  if (filter === "custom") {
    if (fromCustom && toCustom) {
      const from = new Date(fromCustom);
      const to = new Date(toCustom);

      periodLabel =
        from.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }) +
        " - " +
        to.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
    } else {
      periodLabel = "Custom Period";
    }
  }

  // ⭐ ALL PERIOD FILTER
  else if (filter === "All") {
    if (firstHistoryDate && lastHistoryDate) {
      periodLabel =
        firstHistoryDate.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }) +
        " - " +
        lastHistoryDate.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
    } else {
      periodLabel = "All Period";
    }
  }

  // ⭐ DAY / WEEK / MONTH / YEAR
  else {
    periodLabel = formatPeriodLabel(filter, periodDate);
  }



  const buildExportParams = () => {
    const params = { all: true }; // 🔥 tells backend: NO pagination

    if (filter !== "All") {
      const { from, to } = buildFromTo(filter, periodDate, fromCustom, toCustom);

      if (from && to) {
        params.from = from.toISOString();
        params.to = to.toISOString();
      }
    }

    return params;
  };


  const fetchAllRowsForPrint = async () => {
    const url =
      mode === "stock"
        ? buildApiUrl("branch-reports/stock", user, shopname)
        : buildApiUrl("branch-reports/stock/categorywise", user, shopname);

    const res = await axios.get(url, {
      params: buildExportParams(),   // ⭐ SINGLE SOURCE
      headers: getHeaders(),
    });

    return Array.isArray(res.data?.rows) ? res.data.rows : [];
  };





  const handlePrint = async () => {
    try {
      const allRows = await fetchAllRowsForPrint();

      if (!allRows.length) {
        alert("No data to print");
        return;
      }

      await axios.post(
        `${API}/api/stock/print`,
        {
          shopname,
          mode,
          periodLabel,
          rows: allRows, // FULL DATA
        },
        { headers: getHeaders() }
      );
    } catch (err) {
      console.error("❌ Print failed", err);
      alert("Print failed");
    }
  };



  const handlePdfDownload = async () => {
    try {
      const allRows = await fetchAllRowsForPrint();

      if (!allRows.length) {
        alert("No data for PDF");
        return;
      }

      const res = await axios.post(
        `${API}/api/stock/pdf`,
        {
          shopname,
          mode,
          periodLabel,
          rows: allRows,
        },
        {
          headers: getHeaders(),
          responseType: "blob",
        }
      );

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "Stock_Report.pdf";
      a.click();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("❌ PDF failed", err);
      alert("PDF failed");
    }
  };

  const handleConfirmAction = async () => {
    try {
      setSaving(true);

      if (confirmType === "print") {
        await handlePrint();
      } else {
        await handlePdfDownload();
      }

      setShowConfirmModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };



  return (
    <div className="pt-10 sm:pt-10 px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6   text-[28px]  text-[#00a76f]">Stock Reports</h1>


      {showResults && (
        <div className="flex justify-end gap-3 mb-3">

          {/* PRINT BUTTON */}
          <button
            // onClick={handlePrint}
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
            Print
          </button>

          {/* PDF DOWNLOAD BUTTON */}
          <button
            // onClick={handlePdfDownload}

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
            PDF
          </button>

        </div>
      )}



      {/* Control Card */}
      <div className="bg-white rounded-xl  p-6 mb-8 transform transition-all ">
        <div className="grid sm:grid-cols-4 gap-4">
          {/* Report Type */}
          <div className="flex flex-col">
            <label className="font-semibold mb-1 text-gray-700">
              Report Type
            </label>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setShowResults(false);
              }}
              className="border rounded-lg px-3 py-2 focus:ring focus:ring-green-200"
            >
              <option value="">Select Report</option>
              <option value="stock">Product Wise</option>
              <option value="category">Category Wise</option>
            </select>
          </div>



          {/* Date Filter */}
          <div className="flex flex-col">
            <label className="font-semibold mb-1 text-gray-700">Date Filter</label>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPeriodDate(new Date());
                setFromCustom("");
                setToCustom("");
              }}
              className="border rounded-lg px-3 py-2 focus:ring focus:ring-green-200"
            >
              <option value="All">All</option>
              <option value="day">Day</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Search / Reset */}
          <div className="flex flex-col justify-end">
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleSearchClick}
                className=" px-4 py-2
                
               flex items-center gap-2
                
                        rounded-lg 
    font-semibold
    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0  "
              >
                <FaSearch /> Search
              </button>
              <button
                onClick={handleReset}
                className="bg-gray-100 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200 transition"
              >
                <FaRedo /> Reset
              </button>
            </div>
          </div>
        </div>

        {/* Custom Date */}
        {filter === "custom" && (
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-700">From</label>
              <input
                type="date"
                value={fromCustom}
                onChange={(e) => setFromCustom(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring focus:ring-green-200"
              />
            </div>

            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-700">To</label>
              <input
                type="date"
                value={toCustom}
                onChange={(e) => setToCustom(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring focus:ring-green-200"
              />
            </div>
          </div>
        )}

        {/* Prev/Next */}
        {filter !== "All" && filter !== "custom" && (
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handlePrev}
              className="p-2 border rounded-lg hover:bg-gray-100 transition"
            >
              <FaChevronLeft />
            </button>

            <div className="px-4 py-2 border rounded-lg bg-gray-50 font-semibold">
              {periodLabel}
            </div>

            <button
              onClick={handleNext}
              disabled={!isNextAllowed(filter, periodDate)}
              className={`p-2 border rounded-lg transition ${isNextAllowed(filter, periodDate)
                ? "hover:bg-gray-100"
                : "opacity-50 cursor-not-allowed"
                }`}
            >
              <FaChevronRight />
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {loading && (
        <div className="text-center text-green-600 font-semibold">
          Loading…
        </div>
      )}

      {!loading && showResults && (
        <>
          {/* PRODUCT WISE --------------------------- */}
          {mode === "stock" && (
            <div id="report-print-area">
              <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                  <h2 className="text-xl font-semibold">
                    Product Wise — {periodLabel}
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="table-auto w-full border-collapse">
                    <thead className="bg-gray-100">
                      <tr>
                        {[
                          "S.No",
                          "Product Code",
                          "Product Name",
                          "Category",
                          "Opening Stock",
                          "Purchase",
                          // "Total Stock",
                          "Sold",
                          "Return",
                          "Closing Stock",
                        ].map((h, i) => (
                          <th
                            key={i}
                            className={`px-4 py-2 text-left ${[
                              "Opening Stock",
                              "Purchase",
                              // "Total Stock",
                              "Sold",
                              "Return",
                              "Closing Stock",
                            ].includes(h)
                              ? "text-right"
                              : ""
                              }`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={10}
                            className="p-6 text-center text-gray-500"
                          >
                            No records found
                          </td>
                        </tr>
                      ) : (
                        rows.map((it, idx) => (
                          <tr
                            key={it.code || idx}
                            className="border-t hover:bg-green-50"
                          >
                            {/* <td className="px-4 py-2">{idx + 1}</td> */}
                            <td className="px-4 py-2">
                              {(page - 1) * pageSize + idx + 1}
                            </td>

                            <td className="px-4 py-2">{it.code}</td>
                            <td className="px-4 py-2">{it.name}</td>
                            <td className="px-4 py-2">{it.category}</td>
                            <td className="px-4 py-2 text-right">
                              {Number(it.openingStock ?? 0)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {Number(it.purchaseQty ?? 0)}
                            </td>
                            {/* <td className="px-4 py-2 text-right">
                            {Number(it.totalStock ?? 0)}
                          </td> */}
                            <td className="px-4 py-2 text-right">
                              {Number(it.sold ?? 0)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {Number(it.returnQty ?? 0)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {Number(it.closingStock ?? 0)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>




                  </table>

                  {/* {totalPages > 1 && (
                    <div className="flex justify-center mt-4">
                      <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPageChange={(p) => !loading && setPage(p)}
                      />

                    </div>
                  )} */}

                  {totalPages > 1 && (
                    <div className="flex justify-center mt-4">
                      <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPageChange={(p) => {
                          if (loading) return;
                          setPage(p);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CATEGORY WISE --------------------------- */}
          {mode === "category" && (
            <div id="report-print-area">
              <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                  <h2 className="text-xl font-semibold">
                    Category Wise — {periodLabel}
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="table-auto w-full  border-collapse">
                    <thead className="bg-gray-100">
                      <tr>


                        {["S.No", "Category", "Item Count", "Total Qty", "Stock Value", "Action"].map(
                          (h, i) => (
                            <th
                              key={i}
                              className={`px-4 py-2 text-left ${["Item Count", "Total Qty", "Stock Value"].includes(h)
                                ? "text-right"
                                : ""
                                } ${h === "Action" ? "no-print text-center" : ""}`}
                            >
                              {h}
                            </th>
                          )
                        )}

                      </tr>
                    </thead>

                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-6 text-center text-gray-500"
                          >
                            No records found
                          </td>
                        </tr>
                      ) : (
                        rows.map((row, idx) => (
                          <tr
                            key={idx}
                            className="border-t hover:bg-green-50"
                          >

                            <td className="px-4 py-2">
                              {(page - 1) * pageSize + idx + 1}
                            </td>

                            <td className="px-4 py-2">{row.category}</td>


                            <td className="px-4 py-2 text-right">
                              {`${Number(row.itemCount)} item${Number(row.itemCount) !== 1 ? "s" : ""}`}
                            </td>

                            <td className="px-4 py-2 text-right">
                              {`${Number(row.totalQty)} pc${Number(row.totalQty) !== 1 ? "s" : ""}`}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {Number(row.value)}
                            </td>


                            <td className="px-4 py-2 text-center   no-print">
                              <button

                                onClick={() => {
                                  setSelectedCategory(row.category);
                                  setShowCategoryModal(true);
                                  fetchCategoryProductsAll(row.category, 1);
                                }}


                                className="p-2 rounded bg-green-600 text-white hover:bg-green-700 transition"
                              >
                                <FaEye />
                              </button>
                            </td>


                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {totalPages > 1 && (
                    <div className="flex justify-center mt-4">



                      {/* 
                      <Pagination
                        page={categoryPagination?.page || 1}
                        totalPages={categoryPagination?.totalPages || 1}
                        onPageChange={(p) => fetchCategoryProductsAll(selectedCategory, p)}
                      /> */}

                      <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPageChange={(p) => {
                          if (loading) return;
                          setPage(p);
                        }}
                      />



                    </div>
                  )}



                  <CategoryProductsModal
                    open={showCategoryModal}
                    onClose={() => setShowCategoryModal(false)}
                    category={selectedCategory}
                    periodLabel={periodLabel}
                    rows={categoryProducts}
                    allRows={categoryProductsAll}
                    shopname={shopname}
                  />

                </div>
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

                {/* Message */}
                <p className="text-base font-medium text-gray-800">
                  Are you sure you want to
                </p>

                <p className="text-lg font-semibold text-dasher mt-1">
                  {confirmType === "print" ? "Print" : "Download PDF"}?
                </p>

                {/* DATE RANGE */}
                <div className="mt-3 text-sm text-gray-500">
                  Period:{" "}
                  <span className="font-semibold text-gray-700">
                    {periodLabel}
                  </span>
                </div>

                {/* Confirm Button */}
                <button
                  onClick={handleConfirmAction}
                  disabled={saving}
                  className={`inline-flex items-center justify-center m-3 gap-2
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
                    ? (confirmType === "print" ? "Printing..." : "Generating PDF...")
                    : "Confirm"}
                </button>

              </div>
            </SmallSizeModel>
          )}

        </>
      )}
    </div>
  );
};

export default StockReports;


