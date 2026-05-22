// src/pages/BranchReports/Sales/ItemWise.jsx
import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import Pagination from "../../../components/Pagination";
import { FaChevronLeft, FaChevronRight, FaSearch, FaRedo, FaPrint, FaFilePdf } from "react-icons/fa";
import { useAuth } from "../../../context/AuthContext";
import { ShopContext } from "../../../context/ShopContext";
import SmallSizeModel from "../../../components/SmallSizeModel";

import html2pdf from "html2pdf.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const PER_PAGE = 100; // per requirement: 5 cards / rows per page

/* -------------------- date helpers (same logic as SalesReports / TopSellingProducts) -------------------- */
const formatPeriodLabel = (filter, ref) => {
  const date = new Date(ref);
  if (filter === "day") {
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  if (filter === "week") {
    const dow = date.getDay();
    const start = new Date(date);
    start.setDate(date.getDate() - dow);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} - ${end.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
  }
  if (filter === "month") {
    return date.toLocaleString("default", { month: "short", year: "numeric" });
  }
  if (filter === "year") return date.getFullYear().toString();
  return "All";
};

const isNextAllowed = (filter, refDate) => {
  const today = new Date();
  const ref = new Date(refDate);
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

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
    return (ref.getFullYear() < today.getFullYear()) || (ref.getFullYear() === today.getFullYear() && ref.getMonth() < today.getMonth());
  }
  if (filter === "year") return ref.getFullYear() < today.getFullYear();
  return false;
};

const buildFromTo = (filter, refDate, fromCustom, toCustom) => {
  const ref = new Date(refDate);
  if (filter === "custom") {
    return {
      from: fromCustom ? new Date(fromCustom) : null,
      to: toCustom ? new Date(new Date(toCustom).setHours(23, 59, 59)) : null,
    };
  }
  let from = null, to = null;
  if (filter === "day") {
    from = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0);
    to = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59);
  } else if (filter === "week") {
    const dow = ref.getDay();
    const start = new Date(ref);
    start.setDate(ref.getDate() - dow);
    from = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
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

/* -------------------- helper: format date display -------------------- */
const formatDate = (d) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

/* -------------------- build API URL according to role/shop (master-style) -------------------- */
const buildApiUrl = (path, user, selectedShopName) => {
  const ep = path.replace(/^\/+/, "");
  if (!user) return `${API}/api/${ep}`;
  if (user.role === "tenant") return `${API}/api/${ep}`;
  // manager/megaadmin -> fetch tenant shop via master routing
  if ((user.role === "manager" || user.role === "megaadmin") && selectedShopName) {
    return `${API}/api/tenant/shops/${encodeURIComponent(selectedShopName)}/${ep}`;
  }
  return `${API}/api/${ep}`;
};

/* ============================================================
   MAIN COMPONENT: ItemWise
   ============================================================ */
export default function ItemWise() {
  const { user } = useAuth();
  const { selectedShop } = useContext(ShopContext);
  const shopname = selectedShop?.shopname || user?.shopname || localStorage.getItem("shopname");

  // Controls
  const [mode, setMode] = useState(""); // 'bill' | 'sales'
  const [counter, setCounter] = useState("");
  const [filter, setFilter] = useState("All");
  const [periodDate, setPeriodDate] = useState(new Date());
  const [fromCustom, setFromCustom] = useState("");
  const [toCustom, setToCustom] = useState("");

  // Pagination for cards / rows
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = PER_PAGE;

  // Data states
  const [loading, setLoading] = useState(false);
  const [billList, setBillList] = useState([]); // for mode === 'bill'
  const [salesItems, setSalesItems] = useState([]); // for mode === 'sales'
  const [salesSummary, setSalesSummary] = useState({ totalItemsSold: 0, totalSales: 0, totalGst: 0, totalNetSale: 0 });

  // UI
  const [showResults, setShowResults] = useState(false);

  const [dateItems, setDateItems] = useState([]);
  const [dateSummary, setDateSummary] = useState({});


  const [firstDataDate, setFirstDataDate] = useState(null);
  const [lastDataDate, setLastDataDate] = useState(null);



  const [confirmType, setConfirmType] = useState(null); // "print" | "pdf"
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);



  // basic headers
  const token = localStorage.getItem("token");
  const getHeaders = () => {
    const h = { Authorization: `Bearer ${token}` };
    if (shopname) h["x-shopname"] = shopname;
    return h;
  };

  useEffect(() => {
    // reset page when filter/mode changes
    setPage(1);
  }, [mode, filter, periodDate, fromCustom, toCustom, counter]);

  /* -------------------- Prev / Next handlers (same behavior as SalesReports) -------------------- */
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

  /* -------------------- FETCH BILL MODE -------------------- */

  const fetchBillMode = async () => {
    try {
      setLoading(true);

      const { from, to } = buildFromTo(filter, periodDate, fromCustom, toCustom);

      const params = {};
      if (from && to) {
        params.from = from.toISOString();
        params.to = to.toISOString();
      }
      if (counter?.trim()) params.counter = counter.trim();

      const url = buildApiUrl("branch-reports/itemwise/bills", user, shopname);
      const res = await axios.get(url, { params, headers: getHeaders() });

      const bills = Array.isArray(res.data?.bills) ? res.data.bills : [];
      setBillList(bills);

      let minDate = null;
      let maxDate = null;

      bills.forEach((b) => {
        const d = new Date(b.date);
        if (!minDate || d < minDate) minDate = d;
        if (!maxDate || d > maxDate) maxDate = d;
      });

      setFirstDataDate(minDate);
      setLastDataDate(maxDate);


      // remove pagination
      setTotalPages(1);
      setPage(1);

      setShowResults(true);
    } catch (err) {
      console.error("fetchBillMode error:", err);
      setBillList([]);
      setTotalPages(1);
      setPage(1);
      setShowResults(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!showResults) return;

    if (mode === "sales") {
      fetchSalesMode();
    } else if (mode === "datewise") {
      fetchDateWise();
    }

  }, [page, mode, showResults]);


  /* -------------------- FETCH SALES MODE -------------------- */

  const fetchSalesMode = async () => {
    try {
      setLoading(true);

      const { from, to } = buildFromTo(filter, periodDate, fromCustom, toCustom);
      // const params = {};

      const params = {
        page,
        limit
      };

      if (from && to) {
        params.from = from.toISOString();
        params.to = to.toISOString();
      }
      if (counter?.trim()) params.counter = counter.trim();

      const url = buildApiUrl("branch-reports/itemwise/sales", user, shopname);
      const res = await axios.get(url, { params, headers: getHeaders() });

      // FULL LIST
      setSalesItems(Array.isArray(res.data?.items) ? res.data.items : []);

      // ⭐ PERIOD RANGE (FROM API)
      setFirstDataDate(res.data?.firstDate || null);
      setLastDataDate(res.data?.lastDate || null);

      setTotalPages(res.data?.pagination?.totalPages || 1);

      // SUMMARY
      setSalesSummary(
        res.data?.summary || {
          totalItemsSold: 0,
          totalSales: 0,
          totalGst: 0,
          totalNetSale: 0,
        }
      );

      // setTotalPages(1);
      // setPage(1);
      setShowResults(true);

    } catch (err) {
      console.error("fetchSalesMode error:", err);

      setSalesItems([]);
      setSalesSummary({
        totalItemsSold: 0,
        totalSales: 0,
        totalGst: 0,
        totalNetSale: 0,
      });

      setFirstDataDate(null);
      setLastDataDate(null);
      setShowResults(true);

    } finally {
      setLoading(false);
    }
  };



  const handleSearchClick = () => {
    if (mode === "bill") fetchBillMode(1);
    else if (mode === "sales") fetchSalesMode(1);
    else fetchDateWise();
  };

  const handleReset = () => {
    setCounter("");
    setFilter("All");
    setPeriodDate(new Date());
    setFromCustom("");
    setToCustom("");
    setBillList([]);
    setSalesItems([]);
    setSalesSummary({ totalItemsSold: 0, totalSales: 0, totalGst: 0, totalNetSale: 0 });
    setShowResults(false);
    setPage(1);
  };


  const fetchDateWise = async () => {
    try {
      setLoading(true);

      const { from, to } = buildFromTo(filter, periodDate, fromCustom, toCustom);

      const params = {
        page,
        limit
      };
      if (from && to) {
        params.from = from.toISOString();
        params.to = to.toISOString();
      }

      const url = buildApiUrl("branch-reports/datewise", user, shopname);
      const res = await axios.get(url, { params, headers: getHeaders() });

      // ⛔ DO NOT USE salesItems OR salesSummary
      // ✔ Store in separate datewise states
      setDateItems(res.data?.rows || []);

      let minDate = null;
      let maxDate = null;

      (res.data?.rows || []).forEach((r) => {
        const d = new Date(r.date);
        if (!minDate || d < minDate) minDate = d;
        if (!maxDate || d > maxDate) maxDate = d;
      });

      setFirstDataDate(minDate);
      setLastDataDate(maxDate);


      setDateSummary(res.data?.summary || {});
      setTotalPages(res.data?.pagination?.totalPages || 1);

      setShowResults(true);
    } catch (err) {
      console.error("fetchDateWise error:", err);
    } finally {
      setLoading(false);
    }
  };







  function BillCard({ bill }) {
    const [tablePage, setTablePage] = React.useState(1);
    const rowLimit = 5;

    const totalRows = bill.items?.length || 0;
    const totalTablePages = Math.ceil(totalRows / rowLimit);

    const start = (tablePage - 1) * rowLimit;
    const end = start + rowLimit;
    const pagedRows = (bill.items || []).slice(start, end);

    const totals = (bill.items || []).reduce(
      (acc, it) => {
        const qty = Number(it.qty || 0);
        const taxAmt = Number(it.gstAmount || 0);
        const amt = Number(it.value || 0);
        acc.qty += qty;
        acc.tax += taxAmt;
        acc.amount += amt;
        return acc;
      },
      { qty: 0, tax: 0, amount: 0 }
    );

    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-4 transform transition hover:-translate-y-1 hover:shadow-xl">
        {/* header */}

        <div className="flex flex-wrap items-center justify-between w-full mb-3 text-sm">

          <div className="flex flex-wrap items-center gap-2">

            <span className="text-green-700 font-semibold">
              Counter - {bill.counter ?? "-"}
            </span>

            <span className="text-gray-400">|</span>

            <span className="text-gray-700">
              Bill No: <strong>{bill.billNo}</strong>
            </span>

            <span className="text-gray-400">|</span>

            <span className="text-gray-700">
              Date: {formatDate(bill.date)}
            </span>

            <span className="text-gray-400">|</span>

            <span className="font-semibold text-gray-800">
              {bill.customerName || "-"}
            </span>

            <span className="text-gray-400">|</span>

            <span className="text-gray-700">
              {bill.mobile || "-"}
            </span>

          </div>

        </div>


        {/* items table */}
        <div className="overflow-x-auto">
          <table className="table-auto w-full border-collapse min-w-[700px]">
            <thead className="bg-gray-100">
              <tr>
                {["S.No", "Item", "Qty", "Rate", "Tax %", "Tax Amt", "Amount"].map(
                  (h, i) => (
                    <th
                      key={i}
                      className={`px-3 py-2 text-left ${["Qty", "Rate", "Tax %", "Tax Amt", "Amount"].includes(h)
                        ? "text-right"
                        : ""
                        }`}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((it, j) => (
                <tr key={j} className="border-t">
                  <td className="px-3 py-2">{start + j + 1}</td>
                  <td className="px-3 py-2">{it.name}</td>
                  <td className="px-3 py-2 text-right">{Number(it.qty || 0)}</td>
                  <td className="px-3 py-2 text-right">
                    {Number(it.rate || 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">{Number(it.gst || 0)}</td>
                  <td className="px-3 py-2 text-right">
                    {Number(it.gstAmount || 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    ₹{Number(it.value || 0).toFixed(2)}
                  </td>
                </tr>
              ))}

              {pagedRows.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-3 py-2 text-center text-gray-500">
                    No items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* inside-card table pagination */}
        {totalTablePages > 1 && (
          <div className="mt-2 flex justify-center gap-2">
            <button
              onClick={() => setTablePage((p) => Math.max(1, p - 1))}
              disabled={tablePage === 1}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Prev
            </button>

            <span className="px-3 py-1 font-semibold">
              {tablePage} / {totalTablePages}
            </span>

            <button
              onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
              disabled={tablePage === totalTablePages}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

        {/* totals */}
        <div className="flex justify-end gap-6 mt-3 text-sm font-semibold text-gray-700">
          <div>Qty: {totals.qty}</div>
          <div>Tax: ₹{totals.tax.toFixed(2)}</div>
          <div>Amount: ₹{totals.amount.toFixed(2)}</div>
        </div>
      </div>
    );
  }


  const getPeriodLabel = () => {
    // ⭐ CUSTOM
    if (filter === "custom") {
      if (fromCustom && toCustom) {
        return `${formatDate(fromCustom)} - ${formatDate(toCustom)}`;
      }
      return "Custom Period";
    }

    // ⭐ ALL → FIRST DATA DATE TO LAST DATA DATE
    if (filter === "All") {
      if (firstDataDate && lastDataDate) {
        return `${formatDate(firstDataDate)} - ${formatDate(lastDataDate)}`;
      }
      return "All Period";
    }

    // ⭐ DAY / WEEK / MONTH / YEAR
    return formatPeriodLabel(filter, periodDate);
  };


  const buildExportParams = () => {
    const params = { export: 1 };

    if (mode) params.mode = mode;
    if (counter) params.counter = counter;

    if (filter !== "All") {
      const { from, to } = buildFromTo(filter, periodDate, fromCustom, toCustom);
      params.from = from.toISOString();
      params.to = to.toISOString();
    }

    return params;
  };



  const handlePrint = async () => {
    console.log("🖨️ ITEMWISE PRINT CLICKED", mode);

    const res = await axios.get(
      buildApiUrl("branch-reports/itemwise/export", user, shopname),
      {
        params: buildExportParams(),   // ✅ SINGLE SOURCE OF TRUTH
        headers: getHeaders(),
      }
    );

    await axios.post(
      `${API}/api/itemwise/print`,
      {
        shopname,
        mode,
        periodLabel: getPeriodLabel(), // ✅ PERIOD PRINTED
        data: res.data,                // ✅ PERIOD DATA ONLY
      },
      { headers: getHeaders() }
    );
  };




  const handlePdfDownload = async () => {
    console.log("📄 ITEMWISE PDF CLICKED", mode);

    // 1️⃣ FETCH ALL DATA FOR SELECTED PERIOD (NO PAGINATION)
    const res = await axios.get(
      buildApiUrl("branch-reports/itemwise/export", user, shopname),
      {
        params: buildExportParams(),   // ✅ SAME PARAMS AS PRINT
        headers: getHeaders(),
      }
    );

    console.log("📦 EXPORT DATA", res.data);

    // 2️⃣ GENERATE PDF
    const pdfRes = await axios.post(
      `${API}/api/itemwise/pdf`,
      {
        shopname,
        mode,
        periodLabel: getPeriodLabel(), // ✅ PERIOD SHOWN IN PDF
        data: res.data,
      },
      {
        responseType: "blob",
        headers: getHeaders(),
      }
    );

    // 3️⃣ FORCE DOWNLOAD
    const blob = new Blob([pdfRes.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `ItemWise_${mode}_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
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
    <div className="p-6 sm:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6   text-[28px]  text-[#00a76f]">Item Wise</h1>

      {showResults && mode !== "" && (
        <div className="flex justify-end gap-3 mb-3" id="itemwise-print-buttons">

          {/* PRINT */}
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

          {/* PDF */}
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


      {/* control card */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8 transform transition-all ">


        <div className="grid sm:grid-cols-4 gap-4">

          {/* Report Type */}
          <div className="flex flex-col">
            <label className="font-semibold mb-1 text-gray-700">Report Type</label>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setShowResults(false);
              }}
              className="border rounded-lg px-3 py-2 focus:ring focus:ring-green-200"
            >
              <option value="">Select Report</option>
              <option value="bill">Bill</option>
              <option value="sales">Sales</option>
              <option value="datewise">Date Wise</option>
            </select>
          </div>

          {/* Counter - HIDE WHEN DATEWISE */}
          {mode !== "datewise" && (
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-700">Counter No</label>
              <input
                type="text"
                placeholder="Counter No"
                value={counter}
                onChange={(e) => setCounter(e.target.value)}
                className="border h-10 rounded-lg px-3 py-2 focus:ring focus:ring-green-200"
              />
            </div>
          )}

          {/* Date Filter ALWAYS visible in datewise */}
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
              <button onClick={handleSearchClick} className=" px-4 py-2 
      
       flex items-center gap-2 
      
            rounded-lg 
    font-semibold
    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0 
      
      ">
                <FaSearch /> Search
              </button>
              <button onClick={handleReset} className="bg-gray-100 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200 transition">
                <FaRedo /> Reset
              </button>
            </div>
          </div>
        </div>


        {/* custom date inputs */}
        {filter === "custom" && (
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-700">From</label>
              <input type="date" value={fromCustom} onChange={(e) => setFromCustom(e.target.value)} className="border rounded-lg px-3 py-2 focus:ring focus:ring-green-200" />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-700">To</label>
              <input type="date" value={toCustom} onChange={(e) => setToCustom(e.target.value)} className="border rounded-lg px-3 py-2 focus:ring focus:ring-green-200" />
            </div>
          </div>
        )}

        {/* Prev/Next for non-custom filters */}
        {filter !== "All" && filter !== "custom" && (
          <div className="flex items-center gap-3 mt-4">
            <button onClick={handlePrev} className="p-2 border rounded-lg hover:bg-gray-100 transition"><FaChevronLeft /></button>
            <div className="px-4 py-2 border rounded-lg bg-gray-50 font-semibold">{formatPeriodLabel(filter, periodDate)}</div>
            <button onClick={handleNext} disabled={!isNextAllowed(filter, periodDate)} className={`p-2 border rounded-lg transition ${isNextAllowed(filter, periodDate) ? "hover:bg-gray-100" : "opacity-50 cursor-not-allowed"}`}><FaChevronRight /></button>
          </div>
        )}
      </div>



      {/* results */}
      {loading && <div className="text-center text-green-600 font-semibold">Loading…</div>}

      {!loading && showResults && (


        <div id="itemwise-print-area">
          <>


            {/* BILL MODE */}
            {mode === "bill" && (

              <>


                <h2 className="text-xl font-semibold mb-3">
                  ItemWise Bill Report
                  {counter ? ` — Counter ${counter}` : ""}
                  {" — "}
                  {getPeriodLabel()}
                </h2>


                <div className="bg-white rounded-lg shadow-md p-4">

                  {billList.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">No bills found</div>
                  ) : (

                    <div className="space-y-10">

                      {billList.map((bill, idx) => (
                        <div key={bill._id} className="border-b pb-6">

                          {/* ⭐ Single Row Header */}
                          <div className="flex flex-wrap gap-2 items-center text-sm mb-3">

                            <span className="text-green-700 font-semibold">
                              Counter - {bill.counter}
                            </span>

                            <span className="text-gray-400">|</span>

                            <span>
                              Bill No: <strong>{bill.billNo}</strong>
                            </span>

                            <span className="text-gray-400">|</span>

                            <span>Date: {formatDate(bill.date)}</span>

                            <span className="text-gray-400">|</span>

                            <span className="font-semibold">{bill.customerName || "-"}</span>

                            <span className="text-gray-400">|</span>

                            <span>{bill.mobile || "-"}</span>

                          </div>

                          {/* ⭐ PRODUCT-WISE ITEMS TABLE */}
                          <div className="overflow-x-auto">
                            <table className="table-auto w-full border-collapse min-w-[700px]">
                              <thead className="bg-gray-100">
                                <tr>
                                  {["S.No", "Item", "Qty", "Rate", "Tax %", "Tax Amt", "Amount"].map((h, i) => (
                                    <th key={i}
                                      className={`px-3 py-2 text-left ${["Qty", "Rate", "Tax %", "Tax Amt", "Amount"].includes(h)
                                        ? "text-right" : ""
                                        }`}>
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>

                              <tbody>
                                {bill.items.map((it, j) => (
                                  <tr key={j} className="border-t">
                                    <td className="px-3 py-2">{j + 1}</td>
                                    <td className="px-3 py-2">{it.name}</td>
                                    <td className="px-3 py-2 text-right">{it.qty}</td>
                                    <td className="px-3 py-2 text-right">{it.rate.toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right">{it.gst}</td>
                                    <td className="px-3 py-2 text-right">{it.gstAmount.toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right">₹{it.value.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                        </div>
                      ))}

                    </div>

                  )}

                </div>
              </>
            )}


            {/* SALES MODE */}
            {mode === "sales" && (
              <>


                <h2 className="text-xl font-semibold mb-3">
                  ItemWise Sales Report
                  {counter ? ` — Counter ${counter}` : ""}
                  {" — "}
                  {getPeriodLabel()}
                </h2>

                <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                  {/* Summary */}
                  <div className="mt-3 flex justify-end gap-6 text-right font-semibold text-green-700">
                    <div>Total Items Sold: {salesSummary.totalItemsSold}</div>
                    <div>Total Sales: ₹{salesSummary.totalSales.toFixed(2)}</div>
                    <div>Total GST: ₹{salesSummary.totalGst.toFixed(2)}</div>
                    <div>Net Sale: ₹{salesSummary.totalNetSale.toFixed(2)}</div>
                  </div>


                  <div className="overflow-x-auto">
                    <table className="table-auto w-full min-w-[900px] border-collapse">
                      <thead className="bg-gray-100">
                        <tr>
                          {["S.No", "Item Name", "Opening", "Sold Qty", "Closing", "Total Sales", "Tax", "Net Sale"]
                            .map((h, i) => (
                              <th key={i}
                                className={`px-4 py-2 text-left ${["Opening", "Sold Qty", "Closing", "Total Sales", "Tax", "Net Sale"].includes(h)
                                  ? "text-right" : ""
                                  }`}>
                                {h}
                              </th>
                            ))}
                        </tr>
                      </thead>

                      <tbody>
                        {salesItems.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-6 text-center text-gray-500">
                              No records found
                            </td>
                          </tr>
                        ) : (
                          salesItems

                            .map((it, idx) => (
                              <tr key={idx} className="border-t hover:bg-green-50">
                                <td className="px-4 py-2">{(page - 1) * limit + idx + 1}</td>

                                <td className="px-4 py-2">{it.name}</td>
                                <td className="px-4 py-2 text-right">{it.openingStock}</td>
                                <td className="px-4 py-2 text-right">{it.qty}</td>
                                <td className="px-4 py-2 text-right">{it.closingStock}</td>
                                <td className="px-4 py-2 text-right">₹{it.totalSales.toFixed(2)}</td>
                                <td className="px-4 py-2 text-right">₹{it.totalGst.toFixed(2)}</td>
                                <td className="px-4 py-2 text-right">₹{it.netSale.toFixed(2)}</td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>


                </div>


                {totalPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination
                      page={page}
                      totalPages={totalPages}
                      onPageChange={(p) => {
                        if (p === page || loading) return;
                        setPage(p);
                      }}
                    />
                  </div>
                )}

              </>
            )}

            {/* DATEWISE MODE */}
            {mode === "datewise" && (
              <>


                <h2 className="text-xl font-semibold mb-3">
                  Date Wise — {getPeriodLabel()}
                </h2>


                <div className="bg-white rounded-lg shadow-md p-4 mb-4">

                  {/* Summary */}
                  <div className="flex justify-end gap-6 text-green-700 font-semibold mb-3">
                    <div>Total Bills: {dateSummary.totalBills || 0}</div>
                    <div>Total Qty: {dateSummary.totalQty || 0}</div>
                    <div>Total Sales: ₹{(dateSummary.totalSales || 0).toFixed(2)}</div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="table-auto w-full min-w-[700px] border-collapse">
                      <thead className="bg-gray-100">
                        <tr>

                          <th className="px-4 py-2 text-left">S.No</th>
                          <th className="px-4 py-2 text-left">Date</th>
                          <th className="px-4 py-2 text-right">No. of Bills</th>
                          <th className="px-4 py-2 text-right">Total Qty</th>
                          <th className="px-4 py-2 text-right">Total Sales</th>
                        </tr>
                      </thead>

                      <tbody>
                        {dateItems.length === 0 ? (
                          <tr><td colSpan="4" className="p-6 text-center text-gray-500">No records found</td></tr>
                        ) : (
                          dateItems.map((it, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="px-4 py-2">{(page - 1) * limit + idx + 1}</td>
                              <td className="px-4 py-2">{formatDate(it.date)}</td>
                              <td className="px-4 py-2 text-right">{it.billCount}</td>
                              <td className="px-4 py-2 text-right">{it.qty}</td>
                              <td className="px-4 py-2 text-right">₹{it.totalSales.toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination
                      page={page}
                      totalPages={totalPages}
                      onPageChange={(p) => {
                        if (p === page || loading) return;
                        setPage(p);
                      }}
                    />
                  </div>
                )}
              </>
            )}

          </>
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
                Type:{" "}
                <span className="font-semibold text-gray-700">
                  {mode}
                </span>
              </div>

              <div>
                Period:{" "}
                <span className="font-semibold text-gray-700">
                  {getPeriodLabel()}
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


