// src/pages/master/sidebar/MasterExpense.jsx
import React, { useEffect, useMemo, useState } from "react";
import { FaPlus, FaTimes, FaEye } from "react-icons/fa";
import Pagination from "../../../components/Pagination";
import ExpenseViewModal from "../../../components/ExpenseViewModal";

import apiClient from "../../../utils/apiClient";
import { getApiUrl } from "../../../utils/api";
import { getAuthHeaders } from "../../../utils/apiHeaders";

import { useAuth } from "../../../context/AuthContext";
import { useShop } from "../../../context/ShopContext";

// --------------------------------------------
// Helpers
// --------------------------------------------
const formatDateDMY = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const todayInputValue = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};


export default function Expense() {
  const { user } = useAuth();
  const { selectedShop } = useShop();

  // MASTER: API base URL
  const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

  // ⭐ MASTER getApiPath()
  const getApiPath = (endpoint) => {
    const ep = endpoint.replace(/^\//, "");

    // Tenant user → regular tenant URL
    if (user?.role === "tenant") {
      return getApiUrl(`tenant/${ep}`);
    }

    // Manager / Megaadmin → shop must be selected
    if ((user?.role === "manager" || user?.role === "megaadmin") && selectedShop) {
      const shopname = encodeURIComponent(selectedShop.shopname);
      return getApiUrl(`tenant/shops/${shopname}/${ep}`);
    }

    return getApiUrl(`tenant/${ep}`);
  };

  // --------------------------------------------
  // State
  // --------------------------------------------
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [searchCategory, setSearchCategory] = useState("");

  const [categories, setCategories] = useState([]);

  const [expenses, setExpenses] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // View modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);


  const limit = 25;

  // --------------------------------------------
  // Modal form
  // --------------------------------------------
  const [form, setForm] = useState({
    date: todayInputValue(),
    receiptNo: "",
    reason: "",
    amount: "",
    refType: "bill",
    refNumber: "",
    addedByName: user?.name || user?.username || "",
  });

  // --------------------------------------------
  // Fetch Expenses (MASTER)
  // --------------------------------------------
  const fetchExpenses = async (overridePage) => {
    // ⛔ Manager/Megaadmin must select shop
    if ((user.role === "manager" || user.role === "megaadmin") && !selectedShop) {
      setExpenses([]);
      setTotalPages(1);
      return;
    }

    try {
      setLoading(true);

      const currentPage = overridePage || page;

      const params = {
        page: currentPage,
        limit,
        search: search || undefined,
        dateRange,
        type: typeFilter,
        category: searchCategory || undefined,
      };

      if (dateRange === "custom" && customFrom && customTo) {
        params.from = customFrom;
        params.to = customTo;
      }

      const endpoint = getApiPath("expenses");

      const res = await apiClient.get(endpoint, {
        params,
        headers: {
          ...getAuthHeaders(user),
          ...(selectedShop?.shopname ? { "x-shopname": selectedShop.shopname } : {}),
        },
      });




      const list = res.data.expenses || [];
      setExpenses(list);

      setTotalPages(res.data.totalPages || 1);
      setTotal(res.data.total || 0);

      // Build category list
      const catSet = new Set();
      list.forEach((exp) => {
        if (exp.category) catSet.add(exp.category);
      });

      // ⭐ IMPORTANT — update dropdown
      setCategories(Array.from(catSet));


    } catch (err) {
      console.error("fetchExpenses ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedShop && (user.role === "manager" || user.role === "megaadmin")) return;

    fetchExpenses(page);
  }, [page]);

  // Re-fetch data on filter changes
  useEffect(() => {
    if (!selectedShop && (user.role === "manager" || user.role === "megaadmin")) return;
    fetchExpenses(1);
  }, [search, dateRange, typeFilter, customFrom, customTo, selectedShop, searchCategory]);

  // --------------------------------------------
  // Modal Helpers
  // --------------------------------------------
  const resetForm = () => {
    setForm({
      date: todayInputValue(),
      receiptNo: "",
      reason: "",
      amount: "",
      refType: "bill",
      refNumber: "",
      addedByName: user?.name || user?.username || "",
    });
  };

  const openModal = async () => {
    resetForm();
    setShowModal(true);

    try {
      const endpoint = getApiPath("expenses/next-receipt");

      const res = await apiClient.get(endpoint, {
        headers: {
          ...getAuthHeaders(user),
          ...(selectedShop?.shopname ? { "x-shopname": selectedShop.shopname } : {}),
        },
      });

      setForm((prev) => ({
        ...prev,
        receiptNo: res.data?.nextReceiptNo || "",
        addedByName: res.data?.addedByName || user?.name || user?.username || "",
      }));
    } catch (err) {
      console.error("fetchNextReceipt ERROR:", err);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;

    try {
      setSaving(true);

      const endpoint = getApiPath("expenses");

      const payload = {
        date: form.date,
        receiptNo: form.receiptNo,
        reason: form.reason,
        amount: Number(form.amount),
        refType: form.refType,
        refNumber: form.refNumber,
        addedByName: form.addedByName,
      };

      const res = await apiClient.post(endpoint, payload, {
        headers: {
          ...getAuthHeaders(user),
          ...(selectedShop?.shopname ? { "x-shopname": selectedShop.shopname } : {}),
        },
      });

      setExpenses((prev) => [res.data.expense, ...prev]);
      closeModal();
    } catch (err) {
      console.error("saveExpense ERROR:", err);
    } finally {
      setSaving(false);
    }
  };



  // ─────────────────────────────────────────────
  // View helpers
  // ─────────────────────────────────────────────
  const openView = (exp) => {
    setSelectedExpense(exp);
    setShowViewModal(true);
  };

  return (



    <div className="pt-10 sm:pt-10 px-4 sm:px-6 lg:px-8">
      {/* Header row: title + button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[28px] font-bold text-[#00a76f] m-0">Expense</h1>

      </div>

      {/* Filters */}
      <div className="p-4 mb-5">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          {/* Search */}
          <div className="flex-1">
            {/* <label className="block text-xs font-medium text-gray-600 mb-1">
              Search
            </label> */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Receipt No, Reason, Paid to..."
              className="!w-full border h-9 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a76f] focus:border-[#00a76f]"
            />
          </div>

          {/* Bill / Voucher filter */}


          {/* Category Search Filter */}
          <div className="w-full sm:w-48">
            {/* <label className="block text-xs font-medium text-gray-600 mb-1">
    Category
  </label> */}
            <select
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a76f] focus:border-[#00a76f]"
            >
              <option value="">All Category</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Date filter */}
          <div className="flex-1">
            {/* <label className="block text-xs font-medium text-gray-600 mb-1">
              Date Filter
            </label> */}
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="sm:w-40 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a76f] focus:border-[#00a76f]"
              >
                <option value="all">All Date</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom</option>
              </select>

              {dateRange === "custom" && (
                <div className="flex flex-1 gap-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a76f] focus:border-[#00a76f]"
                  />
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a76f] focus:border-[#00a76f]"
                  />
                </div>
              )}
            </div>
          </div>



        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[14px] shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 min-w-0 table-auto text-sm">
            <thead className="bg-[#f7f8fa] sticky top-0 z-20">
              <tr className="text-gray-900">
                <th className="px-4 py-3.5 text-center font-bold border-b border-gray-200">
                  S.No
                </th>
                <th className="px-4 py-3.5 text-center font-bold border-b border-gray-200">
                  Receipt No
                </th>
                <th className="px-4 py-3.5 text-center font-bold border-b border-gray-200">
                  Date
                </th>
                {/* Category near Date */}
                <th className="px-4 py-3.5 text-center font-bold border-b border-gray-200">
                  Category
                </th>
                <th className="px-4 py-3.5 text-center font-bold border-b border-gray-200">
                  Reason
                </th>
                <th className="px-4 py-3.5 text-center font-bold border-b border-gray-200">
                  Amount
                </th>
                {/* <th className="px-4 py-3.5 text-center font-bold border-b border-gray-200">
                  Bill | Voucher
                </th>
                <th className="px-4 py-3.5 text-left font-bold border-b border-gray-200">
                  Number
                </th> */}
                {/* Spend To column */}
                <th className="px-4 py-3.5 text-center font-bold border-b border-gray-200">
                  Paid To
                </th>
                {/* <th className="px-4 py-3.5 text-left font-bold border-b border-gray-200">
                  Spend by User
                </th> */}
                {/* Action column */}
                <th className="px-4 py-3.5 text-center font-bold border-b border-gray-200">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="text-gray-700">
              {loading && (
                <tr>
                  <td
                    colSpan={11}
                    className="text-center py-6 text-gray-500 text-sm"
                  >
                    Loading...
                  </td>
                </tr>
              )}

              {!loading && expenses.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="text-center py-6 text-gray-500 text-sm"
                  >
                    No expenses found.
                  </td>
                </tr>
              )}

              {!loading &&
                expenses.map((exp, idx) => (
                  <tr
                    key={exp._id}
                    className="hover:bg-green-50 transition-colors"
                  >
                    <td className="px-4 py-3 border-b border-gray-200 align-middle whitespace-nowrap">
                      {(page - 1) * limit + idx + 1}
                    </td>

                    <td className="px-4 py-3 border-b text-center border-gray-200 align-middle whitespace-nowrap">
                      {exp.receiptNo}
                    </td>

                    <td className="px-4 py-3 border-b border-gray-200 text-center align-middle whitespace-nowrap">
                      {formatDateDMY(exp.date)}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 border-b border-gray-200 text-center align-middle whitespace-nowrap">
                      {exp.category || "-"}
                    </td>

                    <td className="px-4 py-3 border-b border-gray-200 align-middle max-w-xs whitespace-normal break-words">
                      {exp.reason || "-"}
                    </td>

                    <td className="px-4 py-3 border-b border-gray-200 text-center align-middle whitespace-nowrap">
                      {Number(exp.amount || 0).toFixed(2)}
                    </td>

                    {/* <td className="px-4 py-3 border-b border-gray-200 text-center align-middle whitespace-nowrap">
                      {exp.refType === "voucher" ? "Voucher" : "Bill"}
                    </td> */}

                    {/* <td className="px-4 py-3 border-b border-gray-200 align-middle whitespace-nowrap">
                      {exp.refNumber || "-"}
                    </td> */}

                    {/* Spend To */}
                    <td className="px-4 py-3 border-b border-gray-200 text-center align-middle whitespace-nowrap">
                      {exp.spendTo || "-"}
                    </td>

                    {/* <td className="px-4 py-3 border-b border-gray-200 align-middle whitespace-nowrap">
                      {exp.addedByName || "-"}
                    </td> */}

                    {/* Action */}
                    <td className="px-4 py-3 border-b border-gray-200 align-middle whitespace-nowrap text-center">
                      <button
                        onClick={() => openView(exp)}
                        title="View"
                        style={{
                          border: "none",
                          backgroundColor: "#00A76F",
                          color: "#fff",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "0.5rem",
                          cursor: "pointer",
                          marginRight: "0.5rem",
                        }}
                      >
                        <FaEye />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-200 flex justify-center">
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(newPage) => {
              if (newPage === page) return;
              setPage(newPage);
            }}
          />
        </div>
      </div>





      {/* View Expense Modal */}
      {showViewModal && selectedExpense && (
        <ExpenseViewModal
          expense={selectedExpense}
          onClose={() => {
            setShowViewModal(false);
            setSelectedExpense(null);
          }}
        />
      )}

    </div>
  );
}
