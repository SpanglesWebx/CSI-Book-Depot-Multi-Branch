
// src/pages/BranchReports/ExpenseReports.jsx
import React, { useState, useContext, useEffect } from "react";
import axios from "axios";
import {
  FaChevronLeft,
  FaChevronRight,
  FaSearch,
  FaRedo,
  FaEye,
  FaPrint, FaFilePdf
} from "react-icons/fa";
import { useAuth } from "../../../context/AuthContext";
import { ShopContext } from "../../../context/ShopContext";
import ExpenseViewModal from "../../../components/ExpenseViewModal";
import Pagination from "../../../components/Pagination";
import html2pdf from "html2pdf.js";
import CategoryExpenseModal from "../../../components/CategoryExpenseModal";
import SmallSizeModel from "../../../components/SmallSizeModel";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* -------------------- date helpers  -------------------- */
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
  if (filter === "month") {
    return date.toLocaleString("default", { month: "short", year: "numeric" });
  }
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

const formatDate = (d) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/* -------------------- build API URL (tenant / master) -------------------- */
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


const ExpenseReports = () => {
  const { user } = useAuth();
  const { selectedShop } = useContext(ShopContext);
  // const shopname =
  //   selectedShop?.shopname || user?.shopname || localStorage.getItem("shopname");

  const shopname = selectedShop?.shopname;

  // Controls
  const [mode, setMode] = useState(""); // 'expense-report' | 'category-report'
  const [filter, setFilter] = useState("All");
  const [periodDate, setPeriodDate] = useState(new Date());
  const [fromCustom, setFromCustom] = useState("");
  const [toCustom, setToCustom] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [categoryList, setCategoryList] = useState([]);


  const [confirmType, setConfirmType] = useState(null); // "print" | "pdf"
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);


  // Data
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    totalAmount: 0,
    entries: 0,
  });

  const [showResults, setShowResults] = useState(false);

  // View modal
  const [showView, setShowView] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);


  const [firstDate, setFirstDate] = useState(null);
  const [lastDate, setLastDate] = useState(null);



  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 25;

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");




  const openView = (exp) => {
    setSelectedExpense(exp);
    setShowView(true);
  };

  // token & headers
  const token = localStorage.getItem("token");
  const getHeaders = () => {
    const h = { Authorization: `Bearer ${token}` };
    if (shopname) h["x-shopname"] = shopname;
    return h;
  };

  useEffect(() => {
    setShowResults(false);
  }, [filter, periodDate, fromCustom, toCustom, mode, categoryFilter]);

  /* -------------------- Prev / Next handlers -------------------- */
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

  /* -------------------- FETCH EXPENSE REPORT -------------------- */
  const fetchExpenseReport = async () => {
    if (mode !== "expense-report") {
      setRows([]);
      setSummary({ totalAmount: 0, entries: 0 });
      setShowResults(false);
      return;
    }

    try {
      setLoading(true);

      const { from, to } = buildFromTo(
        filter,
        periodDate,
        fromCustom,
        toCustom
      );

      const params = {};
      if (from && to) {
        params.from = from.toISOString();
        params.to = to.toISOString();
      }

      const url = buildApiUrl("branch-reports/expense", user, shopname);


      const res = await axios.get(url, {
        params: {
          from: from?.toISOString(),
          to: to?.toISOString(),
          page,
          limit: pageSize,
        },
        headers: getHeaders(),
      });

      const dataRows = Array.isArray(res.data?.rows) ? res.data.rows : [];
      const backendSummary = res.data?.summary || {};

      const computedTotal =
        backendSummary.totalAmount ??
        dataRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

      setRows(dataRows);
      setSummary({
        totalAmount: computedTotal,
        entries: dataRows.length,
      });



      setRows(res.data.rows || []);
      setTotalPages(res.data.pagination?.totalPages || 1);

      setFirstDate(res.data?.firstDate || null);
      setLastDate(res.data?.lastDate || null);
      setShowResults(true);
    } catch (err) {
      console.error("❌ fetchExpenseReport error:", err);
      setRows([]);
      setSummary({ totalAmount: 0, entries: 0 });
      setShowResults(true);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- FETCH CATEGORY REPORT -------------------- */
  const fetchExpenseCategoryReport = async () => {
    if (mode !== "category-report") {
      setRows([]);
      setSummary({ totalAmount: 0, entries: 0 });
      setShowResults(false);
      return;
    }

    try {
      setLoading(true);

      const { from, to } = buildFromTo(
        filter,
        periodDate,
        fromCustom,
        toCustom
      );

      const params = {};
      if (from && to) {
        params.from = from.toISOString();
        params.to = to.toISOString();
      }
      if (categoryFilter.trim()) {
        params.category = categoryFilter.trim();
      }

      const url = buildApiUrl(
        "branch-reports/expense/categoryreports",
        user,
        shopname
      );

      const res = await axios.get(url, {
        params: {
          from: from?.toISOString(),
          to: to?.toISOString(),
          category: categoryFilter,
          page,
          limit: pageSize,
        },
        headers: getHeaders(),
      });


      const dataRows = Array.isArray(res.data?.rows) ? res.data.rows : [];
      const backendSummary = res.data?.summary || {};

      setRows(dataRows);
      setSummary({
        totalAmount: backendSummary.totalAmount || 0,
        entries: backendSummary.entries || 0,
      });

      setFirstDate(res.data?.firstDate || null);
      setLastDate(res.data?.lastDate || null);
      setRows(res.data.rows || []);
      setTotalPages(res.data.pagination?.totalPages || 1);

      setShowResults(true);
    } catch (err) {
      console.error("❌ fetchExpenseCategoryReport error:", err);
      setRows([]);
      setSummary({ totalAmount: 0, entries: 0 });
      setShowResults(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const url = buildApiUrl("branch-reports/expense", user, shopname);
        const res = await axios.get(url, { headers: getHeaders() });

        const rows = res.data?.rows || [];
        const categories = [
          ...new Set(rows.map((r) => (r.category || "").trim()).filter(Boolean)),
        ];

        setCategoryList(categories);
      } catch (err) {
        console.error("Category list load failed:", err);
      }
    };

    loadCategories();
  }, [user, shopname]);



  useEffect(() => {
    setPage(1);
  }, [mode, filter, periodDate, fromCustom, toCustom, categoryFilter]);


  useEffect(() => {
    if (!showResults) return;
    if (mode === "expense-report") fetchExpenseReport();
    if (mode === "category-report") fetchExpenseCategoryReport();
  }, [page]);


  const handleSearchClick = () => {
    if (mode === "expense-report") fetchExpenseReport();
    else if (mode === "category-report") fetchExpenseCategoryReport();
  };

  const handleReset = () => {
    setMode("");
    setFilter("All");
    setPeriodDate(new Date());
    setFromCustom("");
    setToCustom("");
    setCategoryFilter("");
    setRows([]);
    setSummary({ totalAmount: 0, entries: 0 });
    setShowResults(false);
  };

  // const periodLabel =
  //   filter === "All" ? "All Period" : formatPeriodLabel(filter, periodDate);


  const getHeadingPeriod = () => {
    // CUSTOM
    if (filter === "custom" && fromCustom && toCustom) {
      return `${formatDate(fromCustom)} to ${formatDate(toCustom)}`;
    }

    // ✅ DAY / WEEK / MONTH / YEAR
    if (filter !== "All") {
      return formatPeriodLabel(filter, periodDate);
    }


    // ALL / DAY / WEEK / MONTH / YEAR
    if (firstDate && lastDate) {
      return `${formatDate(firstDate)} to ${formatDate(lastDate)}`;
    }

    return "All Period";
  };




  const buildExportParams = () => {
    const { from, to } = buildFromTo(
      filter,
      periodDate,
      fromCustom,
      toCustom
    );

    const params = { export: 1 };   // 🔥 KEY FLAG

    if (from && to) {
      params.from = from.toISOString();
      params.to = to.toISOString();
    }

    return params;
  };




  const handlePrint = async () => {
    try {
      let fetchUrl = "";
      let printUrl = "";

      if (mode === "expense-report") {
        fetchUrl = "branch-reports/expense";
        printUrl = "/master/expense/print";
      } else if (mode === "category-report") {
        fetchUrl = "branch-reports/expense/categoryreports";
        printUrl = "/master/expense/category/print";
      } else {
        return;
      }

      // 🔥 FETCH ALL DATA BY DATE (NO PAGINATION)
      const res = await axios.get(
        buildApiUrl(fetchUrl, user, shopname),
        {
          params: buildExportParams(),
          headers: getHeaders(),
        }
      );

      // 🔥 SEND TO BACKEND PRINT
      await axios.post(
        buildApiUrl(printUrl, user, shopname),
        {
          shopname,
          periodLabel: getHeadingPeriod(), // 👈 SELECTED DATE LABEL
          rows: res.data.rows,
          summary: res.data.summary,
        },
        { headers: getHeaders() }
      );
    } catch (err) {
      console.error("❌ Print failed", err);
    }
  };






  const handlePdfDownload = async () => {
    try {
      let fetchUrl = "";
      let pdfUrl = "";
      let fileName = "";

      if (mode === "expense-report") {
        fetchUrl = "branch-reports/expense";
        pdfUrl = "/master/expense/pdf";
        fileName = "Expense_Report.pdf";
      } else if (mode === "category-report") {
        fetchUrl = "branch-reports/expense/categoryreports";
        pdfUrl = "/master/expense/category/pdf";
        fileName = "Expense_Category_Report.pdf";
      } else {
        return;
      }

      // 🔥 FETCH ALL DATA BY DATE
      const res = await axios.get(
        buildApiUrl(fetchUrl, user, shopname),
        {
          params: buildExportParams(),
          headers: getHeaders(),
        }
      );

      // 🔥 REQUEST PDF
      const pdf = await axios.post(
        buildApiUrl(pdfUrl, user, shopname),
        {
          shopname,
          periodLabel: getHeadingPeriod(), // 👈 SELECTED DATE
          rows: res.data.rows,
          summary: res.data.summary,
        },
        {
          responseType: "blob",
          headers: getHeaders(),
        }
      );

      // 🔥 DOWNLOAD
      const blob = new Blob([pdf.data], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("❌ PDF failed", err);
    }
  };




  const handleConfirmAction = async () => {
    try {
      if (saving) return;

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


  /* -------------------- UI -------------------- */
  return (
    <div className="pt-10 sm:pt-10 px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-[28px] text-[#00a76f]">
        Expense Reports
      </h1>



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

            print

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

            pdf

          </button>

        </div>
      )}

      {/* Control Card */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8 transform transition-all ">
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
              <option value="expense-report">Expense Reports</option>
              <option value="category-report">Category Reports</option>
            </select>
          </div>

          {/* Category Filter (only for Category Reports) */}
          {mode === "category-report" && (
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-700">
                Category Filter
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring focus:ring-green-200"
              >
                <option value="">All Categories</option>
                {categoryList.map((cat, i) => (
                  <option key={i} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}


          {/* Date Filter */}
          <div className="flex flex-col">
            <label className="font-semibold mb-1 text-gray-700">
              Date Filter
            </label>
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
                className=" px-4 py-2 rounded-lg flex items-center gap-2 
                
                        
    font-semibold
    text-[#007867]
    bg-[#c8fad6]     
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
        
    transition-all duration-150
    hover:-translate-y-[1px]    
    active:translate-y-0
                "
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

        {/* Custom date inputs */}
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

        {/* Prev/Next for non-custom filters */}
        {filter !== "All" && filter !== "custom" && (
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handlePrev}
              className="p-2 border rounded-lg hover:bg-gray-100 transition"
            >
              <FaChevronLeft />
            </button>
            {/* <div className="px-4 py-2 border rounded-lg bg-gray-50 font-semibold">
              {periodLabel}
            </div> */}
            <div className="px-4 py-2 border rounded-lg bg-gray-50 font-semibold">
              {getHeadingPeriod()}
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

      {/* EXPENSE REPORT TABLE */}
      {!loading && showResults && mode === "expense-report" && (

        <div id="report-print-area">
          <style>
            {`
      /* Hide action column in print */
      @media print {
        .no-print { display: none !important; }
      }
    `}
          </style>

          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            {/* Header row: title + summary */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <h2 className="text-xl font-semibold">
                Expense Reports — {getHeadingPeriod()}
              </h2>
              <div className="flex flex-wrap gap-4 text-sm sm:text-base font-semibold text-green-700">
                <div>
                  Total Expense:{" "}
                  <span className="text-gray-800">
                    ₹{Number(summary.totalAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="table-auto w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    {[
                      "S.No",
                      "Date",
                      "Receipt No",
                      "Category",
                      "Reason",
                      "Amount",
                      "Paid To",
                      "Action",
                    ].map((h, i) => (
                      <th
                        key={i}
                        className={`px-4 py-2 text-left ${["Amount"].includes(h) ? "text-right" : ""
                          }${h === "Action" ? "no-print" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-gray-500">
                        No records found
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => (
                      <tr
                        key={row._id || row.receiptNo || idx}
                        className="border-t hover:bg-green-50"
                      >
                        <td className="px-4 py-2">  {(page - 1) * pageSize + idx + 1}</td>
                        <td className="px-4 py-2">{formatDate(row.date)}</td>
                        <td className="px-4 py-2">{row.receiptNo || "-"}</td>
                        <td className="px-4 py-2">{row.category || "-"}</td>
                        <td className="px-4 py-2">{row.reason || "-"}</td>
                        <td className="px-4 py-2 text-right">
                          {Number(row.amount || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2">
                          {row.spendTo || row.spendto || "-"}
                        </td>
                        <td className="px-4 py-2 no-print">
                          <button
                            onClick={() => openView(row)}
                            title="View"
                            style={{
                              border: "none",
                              backgroundColor: "#00A76F",
                              color: "#fff",
                              padding: "0.45rem 0.65rem",
                              borderRadius: "0.5rem",
                              cursor: "pointer",
                            }}
                          >
                            <FaEye />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center mt-4">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={(p) => {
                    if (!loading) setPage(p);
                  }}
                />
              </div>
            )}


            {/* View Modal (uses your existing ExpenseViewModal) */}
            {showView && selectedExpense && (
              <ExpenseViewModal
                expense={selectedExpense}
                onClose={() => setShowView(false)}
                mode={mode}

                user={user}
                selectedShop={selectedShop}
              />
            )}
          </div>
        </div>
      )}

      {/* CATEGORY REPORT TABLE */}
      {!loading && showResults && mode === "category-report" && (
        <div id="report-print-area">
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <h2 className="text-xl font-semibold">
                Category Reports — {getHeadingPeriod()}
              </h2>
              <div className="flex flex-wrap gap-4 text-sm sm:text-base font-semibold text-green-700">
                <div>
                  No. of Entries:{" "}
                  <span className="text-gray-800">
                    {Number(summary.entries || 0)}
                  </span>
                </div>
                <div>
                  Total Amount:{" "}
                  <span className="text-gray-800">
                    ₹{Number(summary.totalAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table-auto w-full min-w-[700px] border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    {[
                      "S.No",
                      "Category",
                      "No. of Entries",
                      "Total Amount",
                      "Amount",
                    ].map((h, i) => (
                      <th
                        key={i}
                        className={`px-4 py-2 text-left ${["No. of Entries", "Total Amount"].includes(h)
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
                      <td colSpan={4} className="p-6 text-center text-gray-500">
                        No records found
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => (
                      <tr key={row.category || idx} className="border-t hover:bg-green-50">
                        <td className="px-4 py-2">
                          {(page - 1) * pageSize + idx + 1}
                        </td>
                        <td className="px-4 py-2">{row.category || "-"}</td>
                        <td className="px-4 py-2 text-right">
                          {Number(row.entries || 0)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {Number(row.totalAmount || 0).toFixed(2)}
                        </td>


                        <td className="px-4 py-2">
                          <button
                            onClick={() => {
                              setSelectedCategory(row.category);
                              setShowCategoryModal(true);
                            }}
                            className="bg-[#00A76F] text-white p-2 rounded-lg"
                          >
                            <FaEye />
                          </button>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center mt-4">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={(p) => {
                    if (!loading) setPage(p);
                  }}
                />
              </div>
            )}


            <CategoryExpenseModal
              open={showCategoryModal}
              onClose={() => setShowCategoryModal(false)}
              category={selectedCategory}
              periodLabel={getHeadingPeriod()}
              fetchFn={async (page) => {
                const res = await axios.get(
                  buildApiUrl("branch-reports/expense/category/details", user, shopname),
                  {
                    params: {
                      category: selectedCategory,
                      page,
                      limit: 10,
                      from: fromCustom,
                      to: toCustom,
                    },
                    headers: getHeaders(),
                  }
                );
                return res.data;
              }}

              /* 🔥 ADD THESE */
              user={user}
              shopname={shopname}
              from={fromCustom}
              to={toCustom}
              buildApiUrl={buildApiUrl}
              getHeaders={getHeaders}

            />


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
                Report:{" "}
                <span className="font-semibold text-gray-700">
                  {mode === "expense-report" ? "Expense Report" : "Category Report"}
                </span>
              </div>

              <div>
                Period:{" "}
                <span className="font-semibold text-gray-700">
                  {getHeadingPeriod()}
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
};

export default ExpenseReports;
