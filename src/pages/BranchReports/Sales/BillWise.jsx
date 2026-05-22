//src/pages/BranchReports/Sales/BillWise.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import Pagination from "../../../components/Pagination";
import { FaChevronLeft, FaChevronRight, FaSearch, FaPrint, FaFilePdf } from "react-icons/fa";
import { FaEye } from "react-icons/fa";
import ViewOnlySaleModal from "../../../components/ViewOnlySaleModal";
import SmallSizeModel from "../../../components/SmallSizeModel";
import { useAuth } from "../../../context/AuthContext";
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

    return (
      start.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) +
      " - " +
      end.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    );
  }

  if (filter === "month") {
    return date.toLocaleString("default", { month: "short", year: "numeric" });
  }

  if (filter === "year") return date.getFullYear();

  return "All";
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

    const endOnly = new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate()
    );

    return endOnly < todayOnly;
  }

  if (filter === "month") {
    return (
      ref.getFullYear() < today.getFullYear() ||
      (ref.getFullYear() === today.getFullYear() &&
        ref.getMonth() < today.getMonth())
    );
  }

  if (filter === "year") {
    return ref.getFullYear() < today.getFullYear();
  }

  return false;
};

const buildFromTo = (filter, refDate, fromCustom, toCustom) => {
  const ref = new Date(refDate);

  if (filter === "custom") {
    return {
      from: new Date(fromCustom),
      to: new Date(new Date(toCustom).setHours(23, 59, 59)),
    };
  }

  let from = null;
  let to = null;

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



export default function SalesReports() {
  const { user } = useAuth();

  const token = localStorage.getItem("token");
  const shopname = user?.shopname || localStorage.getItem("shopname");

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${token}`,
    shopname: shopname,
  });

  const [search, setSearch] = useState("");
  const [counter, setCounter] = useState("");

  const [filter, setFilter] = useState("All");
  const [periodDate, setPeriodDate] = useState(new Date());

  const [fromCustom, setFromCustom] = useState("");
  const [toCustom, setToCustom] = useState("");

  const [loading, setLoading] = useState(false);
  const [bills, setBills] = useState([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [totalPages, setTotalPages] = useState(1);

  const [showViewModal, setShowViewModal] = useState(false);
  const [viewBill, setViewBill] = useState(null);



  const [showResults, setShowResults] = useState(false);

  const [firstBillDate, setFirstBillDate] = useState(null);
  const [lastBillDate, setLastBillDate] = useState(null);


  const [confirmType, setConfirmType] = useState(null); // "print" | "pdf"
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);



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

  const fetchBills = async (p = 1) => {
    try {
      setLoading(true);

      const params = { page: p, limit };

      if (search.trim()) params.search = search.trim();
      if (counter.trim()) params.counter = counter.trim();

      if (filter !== "All") {
        const { from, to } = buildFromTo(filter, periodDate, fromCustom, toCustom);

        params.from = from.toISOString();
        params.to = to.toISOString();
      }

      const res = await axios.get(`${API}/api/branch-reports/salesbills`, {
        params,
        headers: getAuthHeaders(),
      });

      setBills(res.data?.bills || []);
      setTotalPages(res.data?.totalPages || 1);


      // -------------------------
      // FIND FIRST & LAST BILL DATE
      // -------------------------
      let minDate = null;
      let maxDate = null;

      (res.data?.bills || []).forEach((b) => {
        const d = new Date(b.date);
        if (!minDate || d < minDate) minDate = d;
        if (!maxDate || d > maxDate) maxDate = d;
      });

      setFirstBillDate(minDate);
      setLastBillDate(maxDate);
      setShowResults(true);


    } catch (err) {
      console.error("Fetch bills error:", err);
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!showResults) return;
    fetchBills(page);
  }, [page, limit]);

  const handleSearchClick = () => {
    setShowResults(false);
    fetchBills(1);
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  /* 💰 Calculate Net Total of Table */
  const tableNetTotal = bills.reduce((sum, b) => sum + Number(b.netAmount || 0), 0);


  const getPeriodLabel = () => {
    // ⭐ CUSTOM DATE FILTER
    if (filter === "custom") {
      if (fromCustom && toCustom) {
        const from = new Date(fromCustom);
        const to = new Date(toCustom);

        return (
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
          })
        );
      }
      return "Custom Period";
    }

    // ⭐ ALL PERIOD (use first & last bill dates)
    if (filter === "All") {
      if (firstBillDate && lastBillDate) {
        return (
          firstBillDate.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }) +
          " - " +
          lastBillDate.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        );
      }
      return "All Period";
    }

    // ⭐ STANDARD PERIOD LABELS
    return formatPeriodLabel(filter, periodDate);
  };


  const buildExportParams = () => {
    const params = { export: 1 };

    // Search & counter
    if (search?.trim()) params.search = search.trim();
    if (counter?.trim()) params.counter = counter.trim();

    // Date filter
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
    const res = await axios.get(`${API}/api/branch-reports/salesbills`, {
      params: buildExportParams(),
      headers: getAuthHeaders(),
    });

    await axios.post(
      `${API}/api/sales/billwise/print`,
      {
        shopname,
        periodLabel: getPeriodLabel(),
        bills: res.data.bills,
        summary: res.data.summary,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-shopname": shopname,   // ⭐ REQUIRED
        },
      }
    );
  };

  const handlePdfDownload = async () => {
    try {
      console.log("🧾 PDF CLICKED", { shopname, token });

      // 1️⃣ Fetch ALL bills (no pagination)
      const res = await axios.get(`${API}/api/branch-reports/salesbills`, {
        params: buildExportParams(),
        headers: getAuthHeaders(),
      });

      console.log("📦 SALES DATA", res.data);

      // 2️⃣ Request PDF from backend
      const pdfRes = await axios.post(
        `${API}/api/sales/billwise/pdf`,
        {
          shopname,
          periodLabel: getPeriodLabel(),
          bills: res.data.bills,
          summary: res.data.summary,
        },
        {
          responseType: "blob",          // 🔥 MUST
          headers: getAuthHeaders(),
        }
      );

      console.log("📄 PDF RESPONSE OK", pdfRes);

      // 3️⃣ FORCE DOWNLOAD
      const blob = new Blob([pdfRes.data], {
        type: "application/pdf",
      });

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `BillWiseSales_${Date.now()}.pdf`;

      document.body.appendChild(a);   // 🔥 REQUIRED
      a.click();
      document.body.removeChild(a);

      window.URL.revokeObjectURL(url); // cleanup

    } catch (err) {
      console.error("❌ PDF DOWNLOAD FAILED", err);
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


  return (
    <div className="p-6 sm:p-8">

      <h1 className="text-2xl sm:text-3xl font-bold mb-6   text-[28px]  text-[#00a76f]">Sales Reports</h1>


      {bills.length > 0 && (
        <div className="flex justify-end gap-3 mb-3">

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


      {/* ---------------------- FILTER CARD ---------------------- */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8 transform transition-all ">

        <div className="grid sm:grid-cols-3 gap-6">

          {/* Search input */}
          <div className="flex flex-col">
            <label className="font-semibold mb-1 text-gray-700">
              Search (Bill No / Name / Mobile)
            </label>
            <input
              type="text"
              placeholder="Bill No, Customer Name, Mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border h-10 rounded-lg px-3 py-2 focus:ring focus:ring-green-200"
            />
          </div>

          {/* Counter */}
          <div className="flex flex-col">
            <label className="font-semibold mb-1 text-gray-700">
              Counter No
            </label>
            <input
              type="text"
              placeholder="Counter No"
              value={counter}
              onChange={(e) => setCounter(e.target.value)}
              className="border h-10 rounded-lg px-3 py-2 focus:ring focus:ring-green-200"
            />
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
        </div>

        {/* Custom Date Picker */}
        {filter === "custom" && (
          <div className="grid sm:grid-cols-2 gap-6 mt-6">

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

        {/* Prev/Next Navigation */}
        {filter !== "All" && filter !== "custom" && (
          <div className="flex items-center gap-4 mt-6">

            <button
              onClick={handlePrev}
              className="p-2 border rounded-lg hover:bg-gray-100 transition"
            >
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

        {/* Search button */}
        <div className="flex justify-end mt-6">
          <button
            onClick={handleSearchClick}
            className=" px-6 py-2 
            
           flex items-center gap-2 
            
            
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
            <FaSearch /> Search
          </button>
        </div>
      </div>

      {/* ---------------------- TABLE LIST ---------------------- */}


      {showResults && (
        <div id="billwise-print-area">
          <div className="salesbill-table-wrapper overflow-x-auto bg-white rounded-lg shadow p-4">

            <div className="text-lg font-semibold mb-2 text-green-700">
              Sales Reports — {getPeriodLabel()}
            </div>

            {/* ⭐ TOTAL NET AMOUNT — RIGHT CORNER */}
            <div className="flex justify-end mb-2">
              <div className="text-right font-semibold text-green-700 text-lg">
                Total: ₹{tableNetTotal.toFixed(2)}
              </div>
            </div>

            {loading ? (
              <p className="text-gray-400 text-center py-4">Loading…</p>
            ) : bills.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No records found</p>
            ) : (
              <>
                <table className="table-auto w-full border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">S.No</th>
                      <th className="px-4 py-2 text-left">Counter</th>
                      <th className="px-4 py-2 text-left">Bill No</th>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Customer</th>
                      <th className="px-4 py-2 text-left">Mobile</th>
                      <th className="px-4 py-2 text-right">Net Amount</th>
                      <th className="px-4 py-2 text-center no-print">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {bills.map((bill, i) => (
                      <tr key={bill._id} className="hover:bg-green-50 transition-colors">
                        <td className="px-4 py-2">{(page - 1) * limit + i + 1}</td>

                        <td className="px-4 py-2">Counter - {bill.counter}</td>
                        <td className="px-4 py-2">{bill.billNo}</td>
                        <td className="px-4 py-2">{formatDate(bill.date)}</td>
                        <td className="px-4 py-2">{bill.customerName || "-"}</td>
                        <td className="px-4 py-2">{bill.mobile || "-"}</td>

                        <td className="px-4 py-2 text-right">
                          {Number(bill.netAmount || 0).toFixed(2)}
                        </td>

                        <td className="px-4 py-2 text-center no-print">
                          <button
                            onClick={() => {
                              setViewBill(bill);
                              setShowViewModal(true);
                            }}
                            className="p-2 rounded bg-green-600 text-white hover:bg-green-700 transition"
                          >
                            <FaEye />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>


                {/* PAGINATION + LIMIT DROPDOWN */}
                <div className="mt-3  items-center no-print">




                  {/* CENTER: PAGINATION */}
                  <div className="flex justify-center">
                    <Pagination
                      page={page}
                      totalPages={totalPages}
                      onPageChange={(p) => {
                        if (p === page) return;
                        setPage(p);
                      }}
                    />
                  </div>


                  <div />
                </div>

              </>
            )}
          </div>
        </div>
      )}

      {/* ---------------------- VIEW BILL MODAL ---------------------- */}
      {showViewModal && viewBill && (
        <ViewOnlySaleModal
          showModal={showViewModal}
          onClose={() => setShowViewModal(false)}
          meta={{
            counter: viewBill.counter,
            billNo: viewBill.billNo,
            date: viewBill.date,
            customerName: viewBill.customerName,
            mobile: viewBill.mobile,
          }}
          rows={viewBill.items}
          movements={viewBill.movements}
          totals={{
            total: viewBill.total,
            netAmount: viewBill.netAmount,
            discount: viewBill.discount,
            discountPercent: viewBill.discountPercent,
            cgst: viewBill.cgst,
            sgst: viewBill.sgst,
            cashGiven: viewBill.cashGiven,
            balance: viewBill.balance,
          }}
          paymentMethod={viewBill.paymentMethod}
          payment={viewBill.payment}


          titlePrefix="View Bill"
        />
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
                Period:{" "}
                <span className="font-semibold text-gray-700">
                  {getPeriodLabel()}
                </span>
              </div>

              <div>
                Total Bills:{" "}
                <span className="font-semibold text-gray-700">
                  {bills.length}
                </span>
              </div>
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
    </div>
  );
}




