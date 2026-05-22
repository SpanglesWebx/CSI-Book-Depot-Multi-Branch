


// src/pages/BranchReports/PurchaseReports.jsx
import React, { useState, useContext, useEffect } from "react";
import axios from "axios";
import { FaChevronLeft, FaChevronRight, FaSearch, FaRedo, FaEye, FaPrint, FaFilePdf } from "react-icons/fa";
import { useAuth } from "../../../context/AuthContext";
import { ShopContext } from "../../../context/ShopContext";
import PurchaseView from "../../../components/PurchaseView";
import SupplierBillsViewModal from "../../../components/SupplierBillsViewModal";
import Pagination from "../../../components/Pagination";
import SmallSizeModel from "../../../components/SmallSizeModel";
import html2pdf from "html2pdf.js";



const API = import.meta.env.VITE_API_URL || "http://localhost:5000";


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


const PurchaseReports = () => {
  const { user } = useAuth();
  const { selectedShop } = useContext(ShopContext);
  // const shopname =
  //   selectedShop?.shopname || user?.shopname || localStorage.getItem("shopname");

  const shopname = selectedShop?.shopname;

  // Controls
  const [mode, setMode] = useState(""); // 'purchase-register'
  const [filter, setFilter] = useState("All");
  const [periodDate, setPeriodDate] = useState(new Date());
  const [fromCustom, setFromCustom] = useState("");
  const [toCustom, setToCustom] = useState("");



  const [confirmType, setConfirmType] = useState(null); // "print" | "pdf"
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Data
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    totalQty: 0,
    amount: 0,
    tax: 0,
    grandTotal: 0,
    firstDate: null,
    lastDate: null,
  });

  const [showResults, setShowResults] = useState(false);



  const [showView, setShowView] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);



  const [showSupplierView, setShowSupplierView] = useState(false);
  const [supplierPurchases, setSupplierPurchases] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 25;


  const openView = (p) => {
    setSelectedPurchase(p);
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
  }, [filter, periodDate, fromCustom, toCustom, mode]);

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

  /* -------------------- FETCH PURCHASE REGISTER WISE -------------------- */
  const fetchPurchaseRegisterWise = async () => {
    if (mode !== "purchase-register") {
      setRows([]);
      setSummary({ totalQty: 0, amount: 0, tax: 0, grandTotal: 0 });
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

      const url = buildApiUrl(
        "branch-reports/purchase/registerwise",
        user,
        shopname
      );




      const res = await axios.get(url, {
        params: {
          page,
          limit: pageSize,
          from: from?.toISOString(),
          to: to?.toISOString(),
        },
        headers: getHeaders(),
      });


      const dataRows = Array.isArray(res.data?.rows) ? res.data.rows : [];
      const backendSummary = res.data?.summary || {};

      const computedTotalQty =
        backendSummary.totalQty ??
        dataRows.reduce((sum, r) => sum + Number(r.totalQty || 0), 0);

      const computedAmount =
        backendSummary.amount ??
        dataRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

      const computedTax =
        backendSummary.tax ??
        dataRows.reduce((sum, r) => sum + Number(r.tax || 0), 0);

      const computedGrand =
        backendSummary.grandTotal ??
        backendSummary.totalAmount ??
        dataRows.reduce(
          (sum, r) => sum + Number(r.groundTotal || r.totalAmount || 0),
          0
        );

      setRows(dataRows);
      setSummary({
        totalQty: computedTotalQty,
        amount: computedAmount,
        tax: computedTax,
        grandTotal: computedGrand,
        firstDate: res.data?.summary?.firstDate || null,
        lastDate: res.data?.summary?.lastDate || null,
      });
      setRows(res.data.rows || []);
      setTotalPages(res.data.pagination?.totalPages || 1);

      setShowResults(true);
    } catch (err) {
      console.error("❌ fetchPurchaseRegisterWise error:", err);
      setRows([]);
      setSummary({ totalQty: 0, amount: 0, tax: 0, grandTotal: 0 });
      setShowResults(true);
    } finally {
      setLoading(false);
    }
  };


  const fetchPurchaseNameRegister = async () => {
    if (mode !== "name-register") {
      setRows([]);
      setSummary({ totalQty: 0, amount: 0, tax: 0, grandTotal: 0 });
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
      const url = buildApiUrl(
        "branch-reports/purchase/nameregister",
        user,
        shopname
      );
      const res = await axios.get(url, {
        params: {
          page,
          limit: pageSize,
          from: from?.toISOString(),
          to: to?.toISOString(),
        },
        headers: getHeaders(),
      });


      const dataRows = Array.isArray(res.data?.rows) ? res.data.rows : [];
      const backendSummary = res.data?.summary || {};

      setRows(dataRows);
      setSummary(backendSummary);

      setTotalPages(res.data.pagination?.totalPages || 1);

      setShowResults(true);
    } catch (err) {
      console.error("❌ fetchPurchaseNameRegister error:", err);
      setRows([]);
      setSummary({ totalQty: 0, amount: 0, tax: 0, grandTotal: 0 });
      setShowResults(true);
    } finally {
      setLoading(false);
    }
  };



  /* -------------------- FETCH GST REPORT -------------------- */
  const fetchPurchaseGstReport = async () => {
    if (mode !== "gst-report") {
      setRows([]);
      setSummary({
        totalQty: 0,
        totalValue: 0,
        totalGstAmount: 0,
        totalCgst: 0,
        totalSgst: 0,
      });
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

      const url = buildApiUrl(
        "branch-reports/purchase/gstreport",
        user,
        shopname
      );

      const res = await axios.get(url, {
        params: {
          page,
          limit: pageSize,
          from: from?.toISOString(),
          to: to?.toISOString(),
        },
        headers: getHeaders(),
      });


      const dataRows = Array.isArray(res.data?.rows) ? res.data.rows : [];
      const backendSummary = res.data?.summary || {};

      setRows(dataRows);
      setSummary({
        totalQty: backendSummary.totalQty || 0,
        totalValue: backendSummary.totalValue || 0,
        totalGstAmount: backendSummary.totalGstAmount || 0,
        totalCgst: backendSummary.totalCgst || 0,
        totalSgst: backendSummary.totalSgst || 0,
        firstDate: res.data?.summary?.firstDate || null,
        lastDate: res.data?.summary?.lastDate || null,
      });


      setTotalPages(res.data.pagination?.totalPages || 1);
      setShowResults(true);
    } catch (err) {
      console.error("❌ fetchPurchaseGstReport error:", err);
      setRows([]);
      setSummary({
        totalQty: 0,
        totalValue: 0,
        totalGstAmount: 0,
        totalCgst: 0,
        totalSgst: 0,
      });
      setShowResults(true);
    } finally {
      setLoading(false);
    }
  };

  const openSupplierView = async (supplierRow) => {
    setSelectedSupplier(supplierRow);

    const { from, to } = buildFromTo(
      filter,
      periodDate,
      fromCustom,
      toCustom
    );

    const res = await axios.get(
      buildApiUrl(
        `branch-reports/purchase/supplier/${supplierRow.supplierName}`,
        user,
        shopname
      ),
      {
        headers: getHeaders(),
        params: {
          from: from?.toISOString(),
          to: to?.toISOString(),
        },
      }
    );

    setSupplierPurchases(res.data.rows || []);
    setShowSupplierView(true);
  };



  useEffect(() => {
    if (!showResults) return;

    if (mode === "purchase-register") fetchPurchaseRegisterWise();
    else if (mode === "name-register") fetchPurchaseNameRegister();
    else if (mode === "gst-report") fetchPurchaseGstReport();
  }, [page]);

  useEffect(() => {
    setPage(1);
  }, [mode, filter, periodDate, fromCustom, toCustom]);

  const handleSearchClick = () => {
    setPage(1); // reset pagination
    if (mode === "purchase-register") fetchPurchaseRegisterWise();
    else if (mode === "name-register") fetchPurchaseNameRegister();
    else if (mode === "gst-report") fetchPurchaseGstReport();
  };


  const handleReset = () => {
    setMode("");
    setFilter("All");
    setPeriodDate(new Date());
    setFromCustom("");
    setToCustom("");
    setRows([]);
    setSummary({ totalQty: 0, amount: 0, tax: 0, grandTotal: 0 });
    setShowResults(false);
  };




  let periodLabel = "";

  // ⭐ CUSTOM FILTER
  if (filter === "custom") {
    if (fromCustom && toCustom) {
      periodLabel = `${formatDate(fromCustom)} to ${formatDate(toCustom)}`;
    } else {
      periodLabel = "Custom Period";
    }
  }

  // ⭐ ALL FILTER
  else if (filter === "All") {
    if (summary.firstDate && summary.lastDate) {
      periodLabel = `${formatDate(summary.firstDate)} to ${formatDate(summary.lastDate)}`;
    } else {
      periodLabel = "All Period";
    }
  }

  // ⭐ DAY / WEEK / MONTH / YEAR
  else {
    periodLabel = formatPeriodLabel(filter, periodDate);
  }




  const buildExportParams = () => {
    const params = { export: 1 };

    if (filter !== "All") {
      const { from, to } = buildFromTo(filter, periodDate, fromCustom, toCustom);

      if (from && to) {
        params.from = from.toISOString();
        params.to = to.toISOString();
      }
    }

    return params;
  };


  const handlePrint = async () => {
    let fetchUrl = "";
    let printUrl = "";

    if (mode === "purchase-register") {
      fetchUrl = "branch-reports/purchase/registerwise";
      printUrl = "/master/purchase/register/print";
    }
    else if (mode === "name-register") {
      fetchUrl = "branch-reports/purchase/nameregister";
      printUrl = "/master/purchase/supplier/print";
    }
    else if (mode === "gst-report") {
      fetchUrl = "branch-reports/purchase/gstreport";
      printUrl = "/master/purchase/gst/print";
    }
    else {
      return;
    }

    // 1️⃣ FETCH ALL DATA (NO PAGINATION)
    const res = await axios.get(
      buildApiUrl(fetchUrl, user, shopname),
      {
        params: buildExportParams(),
        headers: getHeaders(),
      }
    );

    // 2️⃣ SEND TO PRINT SERVICE
    await axios.post(
      buildApiUrl(printUrl, user, shopname),
      {
        shopname,
        periodLabel,
        rows: res.data.rows,
        summary: res.data.summary,
      },
      { headers: getHeaders() }
    );
  };





  const handlePdfDownload = async () => {
    let fetchUrl = "";
    let pdfUrl = "";
    let fileName = "Purchase_Report.pdf";

    if (mode === "purchase-register") {
      fetchUrl = "branch-reports/purchase/registerwise";
      pdfUrl = "/master/purchase/register/pdf";
      fileName = "Purchase_Register.pdf";
    }
    else if (mode === "name-register") {
      fetchUrl = "branch-reports/purchase/nameregister";
      pdfUrl = "/master/purchase/supplier/pdf";
      fileName = "Supplier_Report.pdf";
    }
    else if (mode === "gst-report") {
      fetchUrl = "branch-reports/purchase/gstreport";
      pdfUrl = "/master/purchase/gst/pdf";
      fileName = "GST_Report.pdf";
    }
    else {
      return;
    }

    // 1️⃣ FETCH ALL DATA
    const res = await axios.get(
      buildApiUrl(fetchUrl, user, shopname),
      {
        params: buildExportParams(),
        headers: getHeaders(),
      }
    );

    // 2️⃣ REQUEST PDF
    const pdf = await axios.post(
      buildApiUrl(pdfUrl, user, shopname),
      {
        shopname,
        periodLabel,
        rows: res.data.rows,
        summary: res.data.summary,
      },
      {
        responseType: "blob",
        headers: getHeaders(),
      }
    );

    // 3️⃣ DOWNLOAD
    const blob = new Blob([pdf.data], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
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




  return (
    <>
    <div className="pt-10 sm:pt-10 px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6   text-[28px]  text-[#00a76f] ">Purchase Reports</h1>


      {/* PRINT & PDF BUTTONS */}
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

          {/* PDF BUTTON */}
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
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8 transform transition-all">
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
              <option value="purchase-register">Purchase Register</option>
              <option value="name-register">Supplier Report</option>
              <option value="gst-report">GST Reports</option>

            </select>
          </div>

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

          {/* Empty column to balance layout on desktop */}
          <div className="hidden sm:block" />

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

      {!loading && showResults && mode === "purchase-register" && (
        <div id="purchase-print-area">
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
                Purchase Register — {periodLabel}
              </h2>
              <div className="flex flex-wrap gap-4 text-sm sm:text-base font-semibold text-green-700">
                <div>
                  Total Product Qty:{" "}
                  <span className="text-gray-800">
                    {Number(summary.totalQty || 0)}
                  </span>
                </div>
                <div>
                  Grand Total:{" "}
                  <span className="text-gray-800">
                    ₹{Number(summary.grandTotal || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="table-auto w-full min-w-[1000px] border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    {[
                      "S.No",
                      "Order No",
                      "Invoice No",
                      "Supplier Name",
                      "No. of Items",
                      "Total Product Qty",
                      "Amount",
                      "Tax",
                      "Ground Total",
                      "Action",
                    ].map((h, i) => (
                      <th
                        key={i}
                        className={`px-4 py-2 text-left ${[
                          "No. of Items",
                          "Total Product Qty",
                          "Amount",
                          "Tax",
                          "Ground Total",
                        ].includes(h)
                          ? "text-right"
                          : ""
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
                      <td colSpan={10} className="p-6 text-center text-gray-500">
                        No records found
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => {
                      const dateVal = row.date || row.stockedDate || row.invoiceDate;
                      const taxValue = Number(row.tax || 0);
                      const groundTotal = Number(row.groundTotal || row.totalAmount || 0);

                      // ⭐ Amount = GroundTotal - Tax
                      const amount = groundTotal - taxValue;

                      return (
                        <tr
                          key={row._id || row.orderNo || idx}
                          className="border-t hover:bg-green-50"
                        >
                          <td className="px-4 py-2">{(page - 1) * pageSize + idx + 1}</td>
                          <td className="px-4 py-2">{row.orderNo || "-"}</td>
                          <td className="px-4 py-2">{row.invoiceNo || "-"}</td>
                          <td className="px-4 py-2">{row.supplierName || "-"}</td>

                          <td className="px-4 py-2 text-right">
                            {Number(row.noOfItems || 0)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {Number(row.totalQty || 0)}
                          </td>

                          <td className="px-4 py-2 text-right">
                            {amount.toFixed(2)}
                          </td>

                          <td className="px-4 py-2 text-right">
                            {taxValue.toFixed(2)}
                          </td>

                          <td className="px-4 py-2 text-right">
                            {groundTotal.toFixed(2)}
                          </td>

                          {/* ⭐ Action Column */}
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
                      );
                    })
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
                    if (loading || p === page) return;
                    setPage(p);
                  }}
                />
              </div>
            )}

            {/* View Modal */}


            {showView && selectedPurchase && (
              <Modal onClose={() => setShowView(false)}>
                <PurchaseView
                  purchase={selectedPurchase}
                  mode={mode}               // ⭐ pass mode
                  periodLabel={periodLabel}
                  user={user}
                  selectedShop={selectedShop}
                  close={() => setShowView(false)}
                />
              </Modal>
            )}
          </div>
        </div>
      )}



      {/* NAME REGISTER TABLE */}
      {!loading && showResults && mode === "name-register" && (
        <div id="purchase-print-area">
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h2 className="text-xl font-semibold mb-3">
              Supplier Report — {periodLabel}
            </h2>

            <div className="overflow-x-auto">
              <table className="table-auto w-full min-w-[900px] border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    {[
                      "S.No",
                      "Supplier Name",
                      "Bills",
                      "No. of Products",
                      "Total Qty",
                      "Amount",
                      "Tax",
                      "Grand Total",
                      "Action"
                    ].map((h, i) => (
                      <th
                        key={i}
                        className={`px-4 py-2 text-left ${["Bills",
                          "No. of Products",

                          "Total Qty", "Amount", "Tax", "Grand Total", "Action"].includes(h)
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
                      <td colSpan={7} className="p-6 text-center text-gray-500">
                        No records found
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => {
                      const amount = Number(row.grandTotal || 0) - Number(row.tax || 0);

                      return (
                        <tr key={row.supplierId || idx} className="border-t hover:bg-green-50">
                          <td className="px-4 py-2">{(page - 1) * pageSize + idx + 1}</td>
                          <td className="px-4 py-2">{row.supplierName}</td>

                          <td className="px-4 py-2 text-right">{row.bills}</td>

                          <td className="px-4 py-2 text-right">{row.noOfProducts}</td>
                          <td className="px-4 py-2 text-right">{row.totalQty}</td>
                          <td className="px-4 py-2 text-right">{amount.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">{Number(row.tax).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">{Number(row.grandTotal).toFixed(2)}</td>

                          <td className="px-4 py-2 no-print">
                            <button
                              onClick={() => openSupplierView(row)}
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
                      );
                    })
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
                    if (loading || p === page) return;
                    setPage(p);
                  }}
                />
              </div>
            )}


            {showSupplierView && selectedSupplier && (
              <Modal onClose={() => setShowSupplierView(false)}>
                <SupplierBillsViewModal
                  supplier={selectedSupplier}
                  purchases={supplierPurchases}
                  periodLabel={periodLabel}
                  close={() => setShowSupplierView(false)}
                />
              </Modal>
            )}
          </div>
        </div>
      )}



      {!loading && showResults && mode === "gst-report" && (
        <div id="purchase-print-area">
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <h2 className="text-xl font-semibold">
                GST Reports — {periodLabel}
              </h2>
              <div className="flex flex-wrap gap-4 text-sm sm:text-base font-semibold text-green-700">
                <div>
                  Total Qty:{" "}
                  <span className="text-gray-800">
                    {Number(summary.totalQty || 0)}
                  </span>
                </div>
                <div>
                  Total GST Amount:{" "}
                  <span className="text-gray-800">
                    ₹{Number(summary.totalGstAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="table-auto w-full min-w-[900px] border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    {[
                      "S.No",
                      "GST %",
                      "Total Qty",
                      "Total Qty Value",
                      "GST Amount",
                      "CGST",
                      "SGST",
                    ].map((h, i) => (
                      <th
                        key={i}
                        className={`px-4 py-2 text-left ${[
                          "Total Qty",
                          "Total Qty Value",
                          "GST Amount",
                          "CGST",
                          "SGST",
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
                      <td colSpan={7} className="p-6 text-center text-gray-500">
                        No records found
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => {
                      const gstPercent = Number(
                        row.gstPercent ?? row.gst ?? 0
                      );
                      const totalQty = Number(row.totalQty || 0);
                      const totalValue = Number(row.totalValue || 0);
                      const gstAmount = Number(row.totalGstAmount || 0);
                      const cgst = Number(row.cgst || 0);
                      const sgst = Number(row.sgst || 0);

                      return (
                        <tr
                          key={gstPercent || idx}
                          className="border-t hover:bg-green-50"
                        >
                          <td className="px-4 py-2">{(page - 1) * pageSize + idx + 1}</td>
                          <td className="px-4 py-2">
                            {gstPercent ? `${gstPercent}%` : "-"}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {totalQty.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {totalValue.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {gstAmount.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {cgst.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {sgst.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
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
                    if (loading || p === page) return;
                    setPage(p);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}


    </div>

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

      {/* PERIOD */}
      <div className="mt-3 text-sm text-gray-500">
        Period:{" "}
        <span className="font-semibold text-gray-700">
          {periodLabel}
        </span>
      </div>

      {/* MODE (extra clarity 🔥) */}
      <div className="text-sm text-gray-500 mt-1">
        Report:{" "}
        <span className="font-semibold text-gray-700">
          {mode}
        </span>
      </div>

      {/* CONFIRM BUTTON */}
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

    </>
  );
};

export default PurchaseReports;







function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* <div
        className="relative bg-white rounded-lg shadow-lg p-6 z-10 w-[95vw] max-w-[95vw]"
        style={{
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      > */}


      <div
        className="relative bg-white rounded-lg shadow-lg p-6 z-10 w-[60vw] max-w-[60vw]"
      // style={{ maxHeight: "90vh", overflowY: "auto" }}
      >

        {children}
      </div>
    </div>
  );
}

