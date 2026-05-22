
//src/pages/BranchReports/SalesReports.jsx
import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import Pagination from "../../../components/Pagination";
import { FaChevronLeft, FaChevronRight, FaSearch } from "react-icons/fa";
import { FaEye } from "react-icons/fa";
import ViewOnlySaleModal from "../../../components/ViewOnlySaleModal";
import { useAuth } from "../../../context/AuthContext";
import { ShopContext } from "../../../context/ShopContext";
import { getApiUrl } from "../../../utils/api";

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
  const { selectedShop } = useContext(ShopContext);

  const token = localStorage.getItem("token");
  const shopname = user?.shopname || localStorage.getItem("shopname");

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${token}`,
    shopname,
  });


  const getApiPath = (endpoint) => {
    const ep = endpoint.replace(/^\//, "");

    // Tenant
    if (user?.role === "tenant") {
      return getApiUrl(`tenant/${ep}`);
    }

    // Manager / Megaadmin (shop must be selected)
    if ((user?.role === "manager" || user?.role === "megaadmin") && selectedShop) {
      const shopname = encodeURIComponent(selectedShop.shopname);
      return getApiUrl(`tenant/shops/${shopname}/${ep}`);
    }

    // Fallback
    return getApiUrl(`tenant/${ep}`);
  };


  const [search, setSearch] = useState("");
  const [counter, setCounter] = useState("");

  const [filter, setFilter] = useState("All");
  const [periodDate, setPeriodDate] = useState(new Date());

  const [fromCustom, setFromCustom] = useState("");
  const [toCustom, setToCustom] = useState("");

  const [loading, setLoading] = useState(false);
  const [bills, setBills] = useState([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [showViewModal, setShowViewModal] = useState(false);
  const [viewBill, setViewBill] = useState(null);

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

      // ⭐ Correct master-style URL
      const url = getApiPath("branch-reports/salesbills");

      const headers = {
        ...getAuthHeaders(),
        ...(selectedShop?.shopname ? { "x-shopname": selectedShop.shopname } : {}),
      };

      const res = await axios.get(url, { params, headers });

      setBills(res.data?.bills || []);
      setTotalPages(res.data?.totalPages || 1);
      setPage(p);
    } catch (err) {
      console.error("Fetch bills error:", err);
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchClick = () => fetchBills(1);

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const tableNetTotal = bills.reduce((s, b) => s + Number(b.netAmount || 0), 0);

  return (
    <div className="p-6 sm:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Sales Reports</h1>

      {/* FILTER CARD */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8 transform transition-all hover:shadow-2xl">
        <div className="grid sm:grid-cols-3 gap-6">
          {/* Search */}
          <div className="flex flex-col">
            <label className="font-semibold mb-1 text-gray-700">
              Search (Bill No / Name / Mobile)
            </label>
            <input
              type="text"
              placeholder="Bill No, Customer Name, Mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border rounded-lg px-3 py-2 focus:ring focus:ring-green-200"
            />
          </div>

          {/* Counter */}
          <div className="flex flex-col">
            <label className="font-semibold mb-1 text-gray-700">Counter No</label>
            <input
              type="text"
              placeholder="Counter No"
              value={counter}
              onChange={(e) => setCounter(e.target.value)}
              className="border rounded-lg px-3 py-2 focus:ring focus:ring-green-200"
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

        {/* Prev Next */}
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
            className="bg-green-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition"
          >
            <FaSearch /> Search
          </button>
        </div>
      </div>

      {/* TABLE LIST */}
      <div className="salesbill-table-wrapper overflow-x-auto bg-white rounded-lg shadow p-4">
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
            <table className="table-auto w-full min-w-[900px] border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">S.No</th>
                  <th className="px-4 py-2 text-left">Counter</th>
                  <th className="px-4 py-2 text-left">Bill No</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-left">Mobile</th>
                  <th className="px-4 py-2 text-right">Net Amount</th>
                  <th className="px-4 py-2 text-center">Action</th>
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

                    <td className="px-4 py-2 text-center">
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

            <div className="mt-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Rows:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    fetchBills(1);
                  }}
                  className="border rounded px-2 py-1"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>

              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={fetchBills}
              />
            </div>
          </>
        )}
      </div>

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
          titlePrefix="View Bill"
        />
      )}
    </div>
  );
}
