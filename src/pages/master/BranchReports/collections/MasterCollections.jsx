// src/pages/master/BranchReports/collections/MasterCollections.jsx
import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import Pagination from "../../../../components/Pagination";
import SmallSizeModel from "../../../../components/SmallSizeModel";
import { FaChevronLeft, FaChevronRight, FaSearch, FaRedo, FaPrint, FaFilePdf } from "react-icons/fa";
import { useAuth } from "../../../../context/AuthContext";
import { ShopContext } from "../../../../context/ShopContext";
import html2pdf from "html2pdf.js";



/* -------------------- date helpers -------------------- */
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

/* -------------------- Helper: build API URL (master/tenant) -------------------- */
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";


const buildApiUrl = (path, user, shopname) => {
  const ep = path.replace(/^\/+/, "");

  // ALWAYS include tenant shop route when shopname exists
  if (shopname) {
    return `${API_BASE}/api/tenant/shops/${encodeURIComponent(shopname)}/${ep}`;
  }

  // fallback
  return `${API_BASE}/api/${ep}`;
};




/* -------------------- Collections Component -------------------- */
export default function Collections() {
  const { user } = useAuth();
  const { selectedShop } = useContext(ShopContext);
  // const shopname = selectedShop?.shopname || user?.shopname || localStorage.getItem("shopname");
  const shopname = selectedShop?.shopname;

  // Controls
  const [reportType, setReportType] = useState(""); // counter | user | statement
  const [counter, setCounter] = useState("");
  const [selectedUser, setSelectedUser] = useState(""); // username or id
  const [collectionMethod, setCollectionMethod] = useState("all"); // all | cash | upi | card
  const [filter, setFilter] = useState("All");
  const [periodDate, setPeriodDate] = useState(new Date());
  const [fromCustom, setFromCustom] = useState("");
  const [toCustom, setToCustom] = useState("");

  // pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);

  // data
  const [loading, setLoading] = useState(false);
  const [counterRows, setCounterRows] = useState([]); // for counter report
  const [userRows, setUserRows] = useState([]); // for user report
  const [statementCounterRows, setStatementCounterRows] = useState([]); // statement -> counter-wise
  const [statementUserRows, setStatementUserRows] = useState([]); // statement -> user-wise
  const [statementSummary, setStatementSummary] = useState({ cash: 0, upi: 0, total: 0 });

  // users dropdown (populated from backend)
  const [allUsers, setAllUsers] = useState([]);

  // UI
  const [showResults, setShowResults] = useState(false);
  // users dropdown (populated from backend)

  const [firstDate, setFirstDate] = useState(null);
  const [lastDate, setLastDate] = useState(null);


  const [confirmType, setConfirmType] = useState(null); // "print" | "pdf"
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);





  // token & headers
  const token = localStorage.getItem("token");
  const getHeaders = () => {
    const h = { Authorization: `Bearer ${token}` };
    if (shopname) h["x-shopname"] = shopname;
    return h;
  };



  useEffect(() => {
    // reset page whenever key filters change
    setPage(1);
  }, [reportType, filter, periodDate, fromCustom, toCustom, counter, selectedUser, collectionMethod]);

  useEffect(() => {
    // fetch list of users for User filter dropdown (tenant-side)
    // endpoint assumed: /api/tenant/shops/:shopname/users or /api/users (adjust if different)
    const fetchUsers = async () => {
      try {
        const url = buildApiUrl("users", user, shopname); // adapt if your API path differs
        const res = await axios.get(url, { headers: getHeaders() });
        // expect res.data.users = [{ _id, name, username }]
        const list = res.data?.users || res.data?.results || [];
        setAllUsers(list);
      } catch (err) {
        // ignore; optional dropdown
        setAllUsers([]);
      }
    };
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, shopname]);






  /* -------------------- Prev / Next controls (same as SalesReports) -------------------- */
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

  /* -------------------- Build common params -------------------- */
  const buildParams = (p = 1) => {
    const params = { page: p, limit };
    if (counter?.trim()) params.counter = counter.trim();
    if (selectedUser) params.user = selectedUser;
    if (collectionMethod && collectionMethod !== "all") params.method = collectionMethod;
    if (filter !== "All") {
      const { from, to } = buildFromTo(filter, periodDate, fromCustom, toCustom);
      if (from) params.from = from.toISOString();
      if (to) params.to = to.toISOString();
    }
    return params;
  };

  /* -------------------- Fetch Counter Report -------------------- */
  const fetchCounterReport = async (p = 1) => {
    try {
      setLoading(true);
      const url = buildApiUrl("branch-reports/collections/counter", user, shopname);
      const res = await axios.get(url, { params: buildParams(p), headers: getHeaders() });
      // expect res.data.rows = [{ counter, totalBills, totalQty, paymentCash, paymentUpi, total }]
      setCounterRows(res.data?.rows || []);
      setTotalPages(res.data?.totalPages || 1);
      setPage(p);

      setFirstDate(res.data.firstDate);
      setLastDate(res.data.lastDate);
      setShowResults(true);
    } catch (err) {
      console.error("fetchCounterReport error:", err);
      setCounterRows([]);
      setTotalPages(1);
      setShowResults(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // do not run until shopname is set
    if (!shopname) return;

    fetchAllUsers();
  }, [shopname]);



  // ✔️ Correct user fetch (single source)
  const fetchAllUsers = async () => {
    try {
      if (!shopname) return; // 🛑 important safeguard

      const url = buildApiUrl(
        "branch-reports/collections/users/list",
        user,
        shopname
      );

      console.log("Users URL:", url);
      const res = await axios.get(url, { headers: getHeaders() });

      setAllUsers(res.data.users || []);

    } catch (err) {
      console.error("User list fetch error:", err);
      setAllUsers([]);
    }
  };


  // ✔️ Load users when shopname is available
  useEffect(() => {
    if (shopname) fetchAllUsers();
  }, [shopname]);

  /* -------------------- Fetch User Report -------------------- */
  const fetchUserReport = async (p = 1) => {
    try {
      setLoading(true);
      const url = buildApiUrl("branch-reports/collections/user", user, shopname);
      const res = await axios.get(url, { params: buildParams(p), headers: getHeaders() });
      // expect res.data.rows = [{ user, counter, bills, totalQty, paymentCash, paymentUpi, total }]
      setUserRows(res.data?.rows || []);
      setTotalPages(res.data?.totalPages || 1);
      setPage(p);
      setShowResults(true);
      setFirstDate(res.data.firstDate);
      setLastDate(res.data.lastDate);
    } catch (err) {
      console.error("fetchUserReport error:", err);
      setUserRows([]);
      setTotalPages(1);
      setShowResults(true);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- Fetch Statement Report -------------------- */
  const fetchStatementReport = async (p = 1) => {
    try {
      setLoading(true);
      const url = buildApiUrl("branch-reports/collections/statement", user, shopname);
      const res = await axios.get(url, { params: buildParams(p), headers: getHeaders() });
      // expect res.data.counterRows, res.data.userRows, res.data.summary
      setStatementCounterRows(res.data?.counterRows || []);
      setStatementUserRows(res.data?.userRows || []);
      setStatementSummary(res.data?.summary || { cash: 0, upi: 0, total: 0 });
      setTotalPages(res.data?.totalPages || 1);
      setPage(p);
      setShowResults(true);

      setFirstDate(res.data.firstDate);
      setLastDate(res.data.lastDate);
    } catch (err) {
      console.error("fetchStatementReport error:", err);
      setStatementCounterRows([]);
      setStatementUserRows([]);
      setStatementSummary({ cash: 0, upi: 0, total: 0 });
      setTotalPages(1);
      setShowResults(true);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- Search / Reset -------------------- */
  const handleSearchClick = () => {
    setPage(1);
    if (reportType === "counter") fetchCounterReport(1);
    else if (reportType === "user") fetchUserReport(1);
    else fetchStatementReport(1);
  };




  const handleReset = () => {
    setCounter("");
    setSelectedUser("");
    setCollectionMethod("all");
    setFilter("All");
    setPeriodDate(new Date());
    setFromCustom("");
    setToCustom("");
    setCounterRows([]);
    setUserRows([]);
    setStatementCounterRows([]);
    setStatementUserRows([]);
    setStatementSummary({ cash: 0, upi: 0, total: 0 });
    setShowResults(false);
    setPage(1);
  };


  const formatDate = (d) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };




  const periodLabel =
    filter === "All"
      ? firstDate && lastDate
        ? `${formatDate(firstDate)} - ${formatDate(lastDate)}`
        : "All Dates"
      : filter === "custom"
        ? fromCustom && toCustom
          ? `${formatDate(fromCustom)} - ${formatDate(toCustom)}`
          : "Custom Range"
        : formatPeriodLabel(filter, periodDate);







  const loader = (
    <div className="text-center text-green-600 font-semibold py-6">Loading…</div>
  );


  const getPrintHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "x-shopname": selectedShop?.shopname, // required for master
    "Content-Type": "application/json",
  });


  const fetchExportData = async () => {
    const params = buildParams(1);
    params.export = 1;

    const isMaster = user?.role === "master";

    let path = "";
    if (reportType === "counter")
      path = isMaster
        ? "master/collections/counter"
        : "branch-reports/collections/counter";
    else if (reportType === "user")
      path = isMaster
        ? "master/collections/user"
        : "branch-reports/collections/user";
    else
      path = isMaster
        ? "master/collections/statement"
        : "branch-reports/collections/statement";

    const url = buildApiUrl(path, user, shopname);

    const res = await axios.get(url, {
      params,
      headers: getHeaders(),
    });

    return res.data;
  };


  const buildExportParams = () => {
    const { from, to } = buildFromTo(filter, periodDate, fromCustom, toCustom);
    const params = { export: 1 };

    if (counter) params.counter = counter;
    if (selectedUser) params.user = selectedUser;
    if (collectionMethod !== "all") params.method = collectionMethod;

    if (from && to) {
      params.from = from.toISOString();
      params.to = to.toISOString();
    }

    return params;
  };


  const handlePrint = async () => {
    try {
      const data = await fetchExportData();

      const payload = {
        shopname,
        periodLabel,

        data: {
          counterRows: data.counterRows || [],
          rows: data.rows || [],
          userRows: data.userRows || [],
          summary: data.summary || null,
        },

      };

      let fetchUrl = "";
      let path = "";
      if (reportType === "counter") {
        fetchUrl = "branch-reports/collections/counter";
        path = "master/collections/counter/print";
      }

      else if (reportType === "user") {
        fetchUrl = "branch-reports/collections/user";
        path = "master/collections/user/print";
      }

      else {
        fetchUrl = "branch-reports/collections/statement";
        path = "master/collections/statement/print";
      }


      // ✅ ALWAYS tenant shop route
      const url = buildApiUrl(path, user, shopname);

      await axios.post(url, payload, {
        headers: getPrintHeaders(),

        params: buildExportParams()
      });
    } catch (err) {
      console.error("❌ Print error:", err);
      alert("Print failed");
    }
  };


  const handlePdfDownload = async () => {
    try {
      const data = await fetchExportData();




      const payload = {
        shopname,
        periodLabel,

        data: {
          counterRows: data.counterRows || [],
          rows: data.rows || [],
          userRows: data.userRows || [],
          summary: data.summary || null,
        },
      };




      let fetchUrl = "";
      let path = "";
      let fileName = "";
      if (reportType === "counter") {
        fetchUrl = "branch-reports/collections/counter";
        path = "master/collections/counter/pdf";
        fileName = "Counter_Collections.pdf";
      }

      else if (reportType === "user") {
        fetchUrl = "branch-reports/collections/user";
        path = "master/collections/user/pdf";
        fileName = "User_Collections.pdf";
      }

      else {
        fetchUrl = "branch-reports/collections/statement";
        path = "master/collections/statement/pdf";
        fileName = "Collection_Statement.pdf";
      }

      // ✅ FIX: correct arguments
      const url = buildApiUrl(path, user, shopname);

      const res = await axios.post(url, payload, {
        headers: getPrintHeaders(),
        params: buildExportParams(),
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Collections_${reportType}.pdf`;
      link.click();
    } catch (err) {
      console.error("❌ PDF error:", err);
      alert("PDF download failed");
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
    <div className="p-6 sm:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6   text-[28px]  text-[#00a76f] ">Collections Reports</h1>

      {showResults && reportType !== "" && (
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

      {/* ========== FILTER TOP CARD (Improved Layout) ========== */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6 transform transition-all ">

        {/* Report Type Dropdown */}
        <label className="font-semibold mb-1 text-gray-700 pb-2">Report Type</label>
        <div className="mb-4">

          <select
            value={reportType}
            onChange={(e) => {
              setReportType(e.target.value);
              setShowResults(false);
            }}
            // className="border rounded-lg px-3 py-2 w-[2000px] focus:ring focus:ring-green-200"
            className="border rounded-lg px-3 py-2 w-[250px] focus:ring focus:ring-green-200"

          >
            <option value="">-- Select Report Type --</option>
            <option value="counter">Counter Reports</option>
            <option value="user">User Reports</option>
            <option value="statement">Collection Statement</option>
          </select>
        </div>

        {/* ⭐ Dynamic Heading Below Report Type */}
        {reportType && (
          // <h2 className="text-lg font-semibold mb-4 animate-[fadeIn_.2s_ease]">
          <h2 className="text-lg font-semibold mb-4 w-[250px] animate-[fadeIn_.2s_ease] p-4 bg-green-50 rounded text-green-700">

            {reportType === "counter" && "Counter Reports"}
            {reportType === "user" && "User Reports"}
            {reportType === "statement" && "Collection Statement"}
          </h2>
        )}

        {/* ===== Dynamic Inputs based on reportType ===== */}
        <div className="grid sm:grid-cols-4 gap-4">

          {/* -------- COUNTER REPORT FIELDS -------- */}
          {reportType === "counter" && (
            <>
              <div className="flex flex-col">
                <label className="font-semibold mb-1 text-gray-700">Counter</label>
                <input
                  value={counter}
                  onChange={(e) => setCounter(e.target.value)}
                  placeholder="Counter No"
                  className="border rounded-lg px-3 py-2"
                />
              </div>

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
                  className="border rounded-lg px-3 py-2"
                >
                  <option value="All">All</option>
                  <option value="day">Day</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </>
          )}

          {/* -------- USER REPORT FIELDS -------- */}
          {reportType === "user" && (
            <>
              <div className="flex flex-col">
                <label className="font-semibold mb-1 text-gray-700">User</label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="border rounded-lg px-3 py-2"
                >
                  <option value="">All Users</option>
                  {allUsers.map((u) => (
                    <option key={u.username} value={u.username}>
                      {u.name || u.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="font-semibold mb-1 text-gray-700">Counter (optional)</label>
                <input
                  value={counter}
                  onChange={(e) => setCounter(e.target.value)}
                  placeholder="Counter No"
                  className="border rounded-lg px-3 py-2"
                />
              </div>

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
                  className="border rounded-lg px-3 py-2"
                >
                  <option value="All">All</option>
                  <option value="day">Day</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </>
          )}

          {/* -------- STATEMENT FIELDS -------- */}
          {reportType === "statement" && (
            <>
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
                  className="border rounded-lg px-3 py-2"
                >
                  <option value="All">All</option>
                  <option value="day">Day</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </>
          )}

          {/* -------- Search + Reset Buttons -------- */}
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

        {/* ===== Custom Date Range ===== */}
        {filter === "custom" && (
          <div className="grid sm:grid-cols-2 gap-4 mt-4 animate-[fadeIn_.2s_ease]">
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-700">From</label>
              <input
                type="date"
                value={fromCustom}
                onChange={(e) => setFromCustom(e.target.value)}
                className="border rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold mb-1 text-gray-700">To</label>
              <input
                type="date"
                value={toCustom}
                onChange={(e) => setToCustom(e.target.value)}
                className="border rounded-lg px-3 py-2"
              />
            </div>
          </div>
        )}

        {/* ===== Period Navigation (Day/Week/Month/Year) ===== */}
        {filter !== "All" && filter !== "custom" && (
          <div className="flex items-center gap-3 mt-4 animate-[fadeIn_.2s_ease]">
            <button onClick={handlePrev} className="p-2 border rounded-lg hover:bg-gray-100 transition">
              <FaChevronLeft />
            </button>

            <div className="px-4 py-2 border rounded-lg bg-gray-50 font-semibold">
              {formatPeriodLabel(filter, periodDate)}
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
      {/* ========== END FILTER CARD ========== */}


      {/* Results area */}
      <div id="report-print-area">
        {loading && loader}

        {!loading && showResults && reportType === "counter" && (
          <>


            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold">
                Counter Report {counter ? `— Counter ${counter}` : ""} — {periodLabel}

              </h2>



              {/* ⭐ TOTAL: TOP RIGHT */}
              <div className="text-right bg-green-50 px-4 py-2 rounded-lg font-semibold text-green-700 shadow">
                Total: ₹{Number(counterRows.reduce((s, r) => s + (r.total || 0), 0)).toFixed(2)}
              </div>
            </div>


            <div className="overflow-x-auto bg-white rounded-lg shadow p-4">
              <table className="table-auto w-full  border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">S.No</th>
                    <th className="px-4 py-2 text-left">Counter</th>
                    <th className="px-4 py-2 text-right">Total Bills</th>
                    <th className="px-4 py-2 text-right">Total Qty</th>
                    <th className="px-4 py-2 text-right">Cash</th>
                    <th className="px-4 py-2 text-right">UPI</th>
                    <th className="px-4 py-2 text-right">Total Collection</th>
                  </tr>
                </thead>
                <tbody>
                  {counterRows.length === 0 ? (
                    <tr><td colSpan={7} className="p-6 text-center text-gray-500">No records found</td></tr>
                  ) : (
                    counterRows
                      // .slice((page - 1) * limit, (page - 1) * limit + limit)
                      .map((r, i) => (
                        <tr key={r.counter || i} className="border-t hover:bg-green-50 transition-colors">
                          <td className="px-4 py-2">{(page - 1) * limit + i + 1}</td>
                          <td className="px-4 py-2">Counter - {r.counter}</td>


                          <td className="px-4 py-2 text-right">{Number(r.totalBills || r.bills || 0)}</td>
                          <td className="px-4 py-2 text-right">{Number(r.totalQty || 0)}</td>
                          <td className="px-4 py-2 text-right">₹{Number(r.paymentCash || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">₹{Number(r.paymentUpi || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">₹{Number(r.total || 0).toFixed(2)}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>

              <div className="mt-3 flex justify-between items-center">
                <div />
                <Pagination page={page} totalPages={totalPages} onPageChange={(p) => { setPage(p); fetchCounterReport(p); }} />
              </div>
            </div>
          </>
        )}

        {!loading && showResults && reportType === "user" && (
          <>


            <div className="flex justify-between items-center mb-3">

              <h2 className="text-xl font-semibold">
                User Report {selectedUser ? `— ${selectedUser}` : ""} — {periodLabel}
              </h2>


              <div className="text-right bg-green-50 px-4 py-2 rounded-lg font-semibold text-green-700 shadow">
                Total: ₹{Number(userRows.reduce((s, r) => s + (r.total || 0), 0)).toFixed(2)}
              </div>
            </div>


            <div className="overflow-x-auto bg-white rounded-lg shadow p-4">
              <table className="table-auto w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">S.No</th>
                    <th className="px-4 py-2 text-left">User</th>
                    <th className="px-4 py-2 text-left">Counter</th>
                    <th className="px-4 py-2 text-right">No. Bills</th>
                    <th className="px-4 py-2 text-right">Total Qty</th>
                    <th className="px-4 py-2 text-right">Cash</th>
                    <th className="px-4 py-2 text-right">UPI</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {userRows.length === 0 ? (
                    <tr><td colSpan={8} className="p-6 text-center text-gray-500">No records found</td></tr>
                  ) : (
                    userRows
                      // .slice((page - 1) * limit, (page - 1) * limit + limit)
                      .map((r, i) => (
                        <tr key={r.user || i} className="border-t hover:bg-green-50 transition-colors">
                          <td className="px-4 py-2">{(page - 1) * limit + i + 1}</td>
                          <td className="px-4 py-2">{r.user || r.username || "-"}</td>
                          <td className="px-4 py-2">{r.counter ?? "-"}</td>


                          <td className="px-4 py-2 text-right">{Number(r.bills || r.totalBills || 0)}</td>
                          <td className="px-4 py-2 text-right">{Number(r.totalQty || 0)}</td>
                          <td className="px-4 py-2 text-right">₹{Number(r.paymentCash || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">₹{Number(r.paymentUpi || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">₹{Number(r.total || 0).toFixed(2)}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>

              <div className="mt-3 flex justify-between items-center">
                <div />
                <Pagination page={page} totalPages={totalPages} onPageChange={(p) => { setPage(p); fetchUserReport(p); }} />
              </div>
            </div>
          </>
        )}

        {!loading && showResults && reportType === "statement" && (
          <>
            <div className="flex justify-between items-center mb-3">
              {/* <h2 className="text-xl font-semibold">Collection Statement {filter !== "All" && `— ${formatPeriodLabel(filter, periodDate)}`}</h2> */}



              <h2 className="text-xl font-semibold">
                Collection Statement — {periodLabel}
              </h2>


            </div>

            {/* Counter card */}
            <div className="mb-4 bg-white rounded-lg shadow p-4 animate-[fadeIn_.2s_ease]">


              <div className="flex justify-between items-center mb-3">
                <div className="font-semibold">Counter-wise</div>

                {/* ⭐ TOTAL TOP RIGHT */}
                <div className="text-right bg-green-50 px-3 py-1 rounded-lg font-semibold text-green-700 shadow">
                  ₹{Number(statementCounterRows.reduce((s, r) => s + (r.total || 0), 0)).toFixed(2)}
                </div>
              </div>


              <div className="overflow-x-auto">
                <table className="table-auto w-full border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">S.No</th>
                      <th className="px-4 py-2 text-left">Counter</th>
                      <th className="px-4 py-2 text-right">Total Bills</th>
                      <th className="px-4 py-2 text-right">Total Qty</th>
                      <th className="px-4 py-2 text-right">Cash</th>
                      <th className="px-4 py-2 text-right">UPI</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementCounterRows.length === 0 ? (
                      <tr><td colSpan={7} className="p-6 text-center text-gray-500">No records found</td></tr>
                    ) : (
                      statementCounterRows
                        // .slice((page - 1) * limit, (page - 1) * limit + limit)
                        .map((r, i) => (
                          <tr key={r.counter || i} className="border-t hover:bg-green-50 transition-colors">
                            <td className="px-4 py-2">{(page - 1) * limit + i + 1}</td>
                            {/* <td className="px-4 py-2">Counter - {r.counter}</td> */}
                            <td className="px-4 py-2">Counter - {r._id}</td>

                            <td className="px-4 py-2 text-right">{Number(r.totalBills || 0)}</td>
                            <td className="px-4 py-2 text-right">{Number(r.totalQty || 0)}</td>
                            <td className="px-4 py-2 text-right">₹{Number(r.paymentCash || 0).toFixed(2)}</td>
                            <td className="px-4 py-2 text-right">₹{Number(r.paymentUpi || 0).toFixed(2)}</td>
                            <td className="px-4 py-2 text-right">₹{Number(r.total || 0).toFixed(2)}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* User card */}
            <div className="mb-4 bg-white rounded-lg shadow p-4 animate-[fadeIn_.25s_ease]">


              <div className="flex justify-between items-center mb-3">
                <div className="font-semibold">User-wise</div>

                {/* ⭐ TOTAL TOP RIGHT */}
                <div className="text-right bg-green-50 px-3 py-1 rounded-lg font-semibold text-green-700 shadow">
                  ₹{Number(statementUserRows.reduce((s, r) => s + (r.total || 0), 0)).toFixed(2)}
                </div>
              </div>


              <div className="overflow-x-auto">
                <table className="table-auto w-full  border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">S.No</th>
                      <th className="px-4 py-2 text-left">User</th>
                      <th className="px-4 py-2 text-right">No. Bills</th>
                      <th className="px-4 py-2 text-right">Total Qty</th>
                      <th className="px-4 py-2 text-right">Cash</th>
                      <th className="px-4 py-2 text-right">UPI</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementUserRows.length === 0 ? (
                      <tr><td colSpan={7} className="p-6 text-center text-gray-500">No records found</td></tr>
                    ) : (
                      statementUserRows
                        // .slice((page - 1) * limit, (page - 1) * limit + limit)
                        .map((r, i) => (
                          <tr key={r.user || i} className="border-t hover:bg-green-50 transition-colors">
                            <td className="px-4 py-2">{(page - 1) * limit + i + 1}</td>
                            {/* <td className="px-4 py-2">{r.user || r.username || "-"}</td> */}
                            <td className="px-4 py-2">{r._id}</td>
                            <td className="px-4 py-2 text-right">{Number(r.totalBills || 0)}</td>
                            <td className="px-4 py-2 text-right">{Number(r.totalQty || 0)}</td>
                            <td className="px-4 py-2 text-right">₹{Number(r.paymentCash || 0).toFixed(2)}</td>
                            <td className="px-4 py-2 text-right">₹{Number(r.paymentUpi || 0).toFixed(2)}</td>
                            <td className="px-4 py-2 text-right">₹{Number(r.total || 0).toFixed(2)}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary card */}
            <div className="mb-4 bg-white rounded-lg shadow p-4 animate-[fadeIn_.3s_ease]">
              {/* <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">Collection Through</div>
                <div className="text-sm text-gray-600">{filter !== "All" ? formatPeriodLabel(filter, periodDate) : "All dates"}</div>
              </div> */}

              <div className="flex justify-between items-center mb-3">
                <div className="font-semibold">Collection Through</div>

                {/* ⭐ TOP RIGHT TOTAL */}
                {/* <div className="text-right bg-green-50 px-3 py-1 rounded-lg font-semibold text-green-700 shadow">
    ₹{Number(statementSummary.total || 0).toFixed(2)}
  </div> */}
              </div>


              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded">
                  <div className="text-sm text-green-600">Cash</div>
                  <div className="font-semibold text-lg">₹{Number(statementSummary.cash || 0).toFixed(2)}</div>
                </div>
                <div className="p-4 bg-green-50 rounded">
                  <div className="text-sm text-gray-600">UPI</div>
                  <div className="font-semibold text-lg">₹{Number(statementSummary.upi || 0).toFixed(2)}</div>
                </div>
                <div className="p-4 bg-green-50 rounded">
                  <div className="text-sm text-green-600">

                    Total</div>
                  <div className="font-semibold text-lg">₹{Number(statementSummary.total || 0).toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Pagination page={page} totalPages={totalPages} onPageChange={(p) => { setPage(p); fetchStatementReport(p); }} />
            </div>
          </>
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

            {/* DETAILS */}
            <div className="mt-3 text-sm text-gray-500">
              <div>
                Report:{" "}
                <span className="font-semibold text-gray-700">
                  {reportType === "counter"
                    ? "Counter Report"
                    : reportType === "user"
                      ? "User Report"
                      : "Collection Statement"}
                </span>
              </div>

              <div>
                Period:{" "}
                <span className="font-semibold text-gray-700">
                  {periodLabel}
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
