

// src/pages/Expense.jsx
import React, { useEffect, useMemo, useState } from "react";
import { FaPlus, FaTimes, FaTrash, FaEye } from "react-icons/fa";
import Pagination from "../components/Pagination";

import apiClient from "../utils/apiClient";
import { getApiUrl } from "../utils/api";
import { getAuthHeaders } from "../utils/apiHeaders";
import { useAuth } from "../context/AuthContext";
import ExpenseViewModal from "../components/ExpenseViewModal";

const getApiPath = (endpoint) => {
  const ep = endpoint.replace(/^\//, "");
  return getApiUrl(ep); // tenant-aware path, same as purchase page
};

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
  return `${yyyy}-${mm}-${dd}`; // for <input type="date">
};

const Expense = () => {
  const { user } = useAuth();

  // Filters + list state
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("all"); // all, today, week, month, custom
  const [typeFilter, setTypeFilter] = useState("all"); // all, bill, voucher
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [searchCategory, setSearchCategory] = useState("");

  const [expenses, setExpenses] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const limit = 50;

  // Category dropdown options (in-memory)
  const [categories, setCategories] = useState([]);

  // Manage Category modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [showCategoryDeleteConfirm, setShowCategoryDeleteConfirm] = useState(false);

  // View modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});
  const [activeField, setActiveField] = useState(null);


  const [form, setForm] = useState({
    date: todayInputValue(),
    receiptNo: "",
    reason: "",
    amount: "",
    refType: "bill", // bill | voucher
    refNumber: "",
    addedByName: user?.name || user?.username || "",

    // ⭐ category & spendTo
    category: "",
    spendTo: "",
  });

  // ─────────────────────────────────────────────
  // Toast helper
  // ─────────────────────────────────────────────
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 2500);
  };




  // ─────────────────────────────────────────────
  // Fetch list
  // ─────────────────────────────────────────────
  const fetchExpenses = async (overridePage) => {
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

      const res = await apiClient.get(getApiPath("/expenses"), {
        params,
        headers: getAuthHeaders(),
      });

      setExpenses(res.data.expenses || []);
      setTotalPages(res.data.totalPages || 1);
      setTotal(res.data.total || 0);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // refetch when filters change
  useEffect(() => {
    fetchExpenses(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, dateRange, typeFilter, customFrom, customTo, searchCategory]);

  // ─────────────────────────────────────────────
  // Modal helpers
  // ─────────────────────────────────────────────
  const resetForm = () => {
    setForm({
      date: todayInputValue(),
      receiptNo: "",
      reason: "",
      amount: "",
      refType: "bill",
      refNumber: "",
      addedByName: user?.name || user?.username || "",

      category: "",
      spendTo: "",
    });
  };

  const openModal = async () => {
    resetForm();
    setShowModal(true);

    try {
      const res = await apiClient.get(getApiPath("/expenses/next-receipt"), {
        headers: getAuthHeaders(),
      });
      const nextReceipt = res.data?.nextReceiptNo || "";
      const addedByName = res.data?.addedByName || user?.name || user?.username || "";

      setForm((prev) => ({
        ...prev,
        receiptNo: nextReceipt,
        addedByName,
      }));
    } catch (err) {
      console.error("fetchNextReceipt ERROR:", err);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRefTypeToggle = (type) => {
    if (type === form.refType) return;
    setForm((prev) => ({
      ...prev,
      refType: type,
      // keep refNumber as-is (user might be switching back and forth)
    }));
  };


  /* -------------------------
     Prevent refresh while saving expense
  ------------------------- */
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (saving) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saving]);


  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;

    // --- REQUIRED FIELD VALIDATION ---
    if (!form.date) {
      showToast("Date is required", "error");
      return;
    }

    if (!form.category) {
      showToast("Category is required", "error");
      return;
    }

    if (!form.spendTo.trim()) {
      showToast("Spend To is required", "error");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      showToast("Valid amount is required", "error");
      return;
    }

    if (!form.reason.trim()) {
      showToast("Reason is required", "error");
      return;
    }

    if (!form.refNumber.trim()) {
      showToast(
        form.refType === "voucher"
          ? "Voucher number is required"
          : "Bill number is required",
        "error"
      );
      return;
    }

    if (!form.receiptNo) {
      showToast("Receipt number missing", "error");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        date: form.date,
        receiptNo: form.receiptNo,
        reason: form.reason,
        amount: Number(form.amount),
        refType: form.refType,
        refNumber: form.refNumber,
        addedByName: form.addedByName,
        category: form.category,
        spendTo: form.spendTo,
      };

      const res = await apiClient.post(getApiPath("/expenses"), payload, {
        headers: getAuthHeaders(),
      });

      const created = res.data?.expense;
      if (created) {
        // update table instantly (prepend)
        setExpenses((prev) => [created, ...prev]);

        // update categories list
        if (created.category && !categories.includes(created.category)) {
          setCategories((prev) => [...prev, created.category]);
        }

        showToast("Expense added successfully");
      }

      closeModal();
    } catch (err) {
      console.error("saveExpense ERROR:", err);
      showToast(err?.response?.data?.message || "Failed to save expense", "error");
    } finally {
      setSaving(false);
    }
  };


  const currentUserLabel = useMemo(
    () => form.addedByName || user?.name || user?.username || "",
    [form.addedByName, user]
  );

  // ─────────────────────────────────────────────
  // Category helpers
  // ─────────────────────────────────────────────
  const addCategoryDraft = () => {
    const name = categoryDraft.trim();
    if (!name) return;
    if (!categories.includes(name)) {
      setCategories((prev) => [...prev, name]);
      showToast("Category added");
    }
    setCategoryDraft("");
  };

  const confirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    setCategories((prev) => prev.filter((c) => c !== categoryToDelete));
    // Clear from form if it was selected
    setForm((prev) =>
      prev.category === categoryToDelete ? { ...prev, category: "" } : prev
    );
    setShowCategoryDeleteConfirm(false);
    setCategoryToDelete(null);
    showToast("Category deleted");
  };

  // ─────────────────────────────────────────────
  // View helpers
  // ─────────────────────────────────────────────
  const openView = (exp) => {
    setSelectedExpense(exp);
    setShowViewModal(true);
  };

  const validateMaxLength = (name, value, max = 50) => {
    if (value.length > max) {
      setErrors((prev) => ({
        ...prev,
        [name]: `Maximum ${max} characters allowed`,
      }));

      setTimeout(() => {
        setErrors((prev) => {
          const copy = { ...prev };
          delete copy[name];
          return copy;
        });
      }, 3000);

      return false;
    }

    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });

    return true;
  };


  const CharCounter = ({ value = "", max = 50, show }) => {
    if (!show) return null;

    return (
      <span className="absolute bottom-1 right-2 text-xs text-gray-400">
        {value.length}/{max}
      </span>
    );
  };



  return (
    <div className="pt-10 sm:pt-10 px-4 sm:px-6 lg:px-8">
      {/* Header row: title + button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[28px] font-bold text-[#00a76f] m-0">Expense</h1>

        <button
          type="button"
          onClick={openModal}
          className="
          
          inline-flex items-center justify-center w-44 gap-2 px-4 py-2 
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
          <FaPlus />
          <span>Add Expense</span>
        </button>
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

                {/* Spend To column */}
                <th className="px-4 py-3.5 text-center font-bold border-b border-gray-200">
                  Paid To
                </th>

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


                    {/* Spend To */}
                    <td className="px-4 py-3 border-b border-gray-200 text-center align-middle whitespace-nowrap">
                      {exp.spendTo || "-"}
                    </td>



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
              if (loading || newPage === page) return;
              setPage(newPage);
              fetchExpenses(newPage);
            }}
          />
        </div>
      </div>

      {/* Add Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[100vh] overflow-hidden flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Add Expense</h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <FaTimes size={14} />
              </button>
            </div>

            {/* Modal body */}
            {/* <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-4 py-3 space-y-4"> */}
            <form
              onSubmit={handleSave}
              className={`flex-1 overflow-y-auto px-4 py-3 space-y-4 transition-all duration-200
    ${saving ? "pointer-events-none opacity-60" : ""}
  `}
            >

              {/* Top: Left (Date, Category, Spend To) / Right (Receipt No, Amount) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Left column */}
                <div className="space-y-3">
                  {/* Date */}
                  <div>
                    {/* <label className="block text-xs font-medium text-gray-600 mb-1">
                      Date
                    </label> */}

                    <RequiredLabel>Date</RequiredLabel>

                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => handleChange("date", e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50"
                      readOnly
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      {/* <label className="block text-xs font-medium text-gray-600">
                        Category
                      </label> */}

                      <RequiredLabel>Category</RequiredLabel>
                      <button
                        type="button"
                        className="text-xs text-[#00a76f] hover:underline"
                        onClick={() => setShowCategoryModal(true)}
                      >
                        + Category
                      </button>
                    </div>
                    <select
                      className="w-full !border !border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a76f] focus:border-[#00a76f]"
                      value={form.category}
                      onChange={(e) => handleChange("category", e.target.value)}
                    >
                      <option value="">Select category</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>



                </div>

                {/* Right column */}
                <div className="space-y-3">
                  {/* Receipt No */}
                  <div>
                    {/* <label className="block text-xs font-medium text-gray-600 mb-1">
                      Receipt No
                    </label> */}

                    <RequiredLabel>  Receipt No</RequiredLabel>
                    <input
                      type="text"
                      value={form.receiptNo}
                      readOnly
                      className="w-full h-10 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50"
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    {/* <label className="block text-xs font-medium text-gray-600 mb-1">
                      Amount
                    </label> */}
                    <RequiredLabel>Amount</RequiredLabel>
                    <input
                      type="number"
                      value={form.amount}
                      onChange={(e) => handleChange("amount", e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a76f] focus:border-[#00a76f]"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      onKeyDown={(e) => {
                        if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Payment for / Reason – full width */}
              <div className="relative">

                <RequiredLabel>Payment for / Reason</RequiredLabel>
                <textarea
                  rows={3}
                  value={form.reason}
                  onFocus={() => setActiveField("reason")}
                  onBlur={() => setActiveField(null)}
                  // onChange={(e) => handleChange("reason", e.target.value)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (validateMaxLength("reason", val, 150)) {
                      handleChange("reason", val);
                    }
                  }}
                  // className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a76f] focus:border-[#00a76f] resize-none"

                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none pr-10 pb-5
      ${errors.reason ? "border-red-500" : ""}
    `}
                  placeholder="Enter the reason for this expense..."
                />

                <CharCounter
                  value={form.reason}
                  max={150}
                  show={activeField === "reason"}
                />

                {errors.reason && (
                  <span className="text-red-600 text-xs mt-1 block">
                    {errors.reason}
                  </span>
                )}
              </div>


              {/* Spend To - input box */}

              <div className="w-1/2 relative">
                {/* <label className="block text-xs font-medium text-gray-600 mb-1">
                      Spend To
                    </label> */}

                <RequiredLabel>Spend To</RequiredLabel>
                <input
                  type="text"
                  value={form.spendTo}
                  onFocus={() => setActiveField("spendTo")}
                  onBlur={() => setActiveField(null)}
                  // onChange={(e) => handleChange("spendTo", e.target.value)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (validateMaxLength("spendTo", val, 50)) {
                      handleChange("spendTo", val);
                    }
                  }}
                  // className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a76f] focus:border-[#00a76f]"

                  //       className="w-full !h-10 border border-gray-200 rounded-lg px-3 py-2 text-sm
                  //  focus:outline-none focus:ring-2 focus:ring-[#00a76f]"
                  className={`w-full h-10 border border-gray-200 rounded-lg px-3 py-2 text-sm pr-10 pb-5
      ${errors.spendTo ? "border-red-500" : ""}
    `}

                  placeholder="Person / place..."
                />

                <CharCounter
                  value={form.spendTo}
                  max={50}
                  show={activeField === "spendTo"}
                />

                {errors.spendTo && (
                  <span className="text-red-600 text-xs mt-1 block">
                    {errors.spendTo}
                  </span>
                )}
              </div>

              {/* Reference section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Reference
                  </h3>
                </div>
                <hr className="border-gray-200 mb-3" />

                <div className="flex items-center gap-4 flex-nowrap w-full">

                  {/* LEFT COLUMN = 50% */}
                  <div className="w-1/2 min-w-[240px] flex bg-gray-100 rounded-full p-1">

                    {/* BILL = 50% of left column */}
                    <button
                      type="button"
                      onClick={() => handleRefTypeToggle("bill")}
                      className={`
        w-1/2 text-center px-4 py-1 text-sm rounded-full transition-all
        ${form.refType === "bill"
                          ? "bg-[#c8fad6] text-[#007867] shadow"
                          : "text-gray-700"
                        }
      `}
                    >
                      Bill
                    </button>

                    {/* VOUCHER = 50% of left column */}
                    <button
                      type="button"
                      onClick={() => handleRefTypeToggle("voucher")}
                      className={`
        w-1/2 text-center px-4 py-1 text-sm rounded-full transition-all
        ${form.refType === "voucher"
                          ? "bg-[#c8fad6] text-[#007867] shadow"
                          : "text-gray-700"
                        }
      `}
                    >
                      Voucher
                    </button>

                  </div>

                  {/* RIGHT COLUMN = 50% */}
                  <div className="w-1/2 min-w-[220px] relative">
                    {/* <label className="block text-xs font-medium text-gray-600 mb-1">
      {form.refType === "voucher" ? "Voucher No" : "Bill No"}
    </label> */}

                    <RequiredLabel>
                      {form.refType === "voucher" ? "Voucher No" : "Bill No"}
                    </RequiredLabel>

                    <input
                      type="text"
                      value={form.refNumber}
                      onFocus={() => setActiveField("refNumber")}
                      onBlur={() => setActiveField(null)}
                      // onChange={(e) => handleChange("refNumber", e.target.value)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (validateMaxLength("refNumber", val, 100)) {
                          handleChange("refNumber", val);
                        }
                      }}
                      //               className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                      // focus:outline-none focus:ring-2 focus:ring-[#00a76f] 
                      // focus:border-[#00a76f]"
                      className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-10 pb-5
      ${errors.refNumber ? "border-red-500" : ""}
    `}
                      placeholder={
                        form.refType === "voucher"
                          ? "Enter voucher number"
                          : "Enter bill number"
                      }
                    />
                    <CharCounter
                      value={form.refNumber}
                      max={100}
                      show={activeField === "refNumber"}
                    />

                    {errors.refNumber && (
                      <span className="text-red-600 text-xs mt-1 block">
                        {errors.refNumber}
                      </span>
                    )}
                  </div>

                </div>



              </div>



              {/* Added by (50% width) */}
              <div className="w-1/2">



                <RequiredLabel>   Added by</RequiredLabel>

                <input
                  type="text"
                  value={currentUserLabel}
                  readOnly
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50"
                />
              </div>

            </form>

            {/* Footer buttons */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => !saving && closeModal()}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Discard
              </button>
              {/* <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 
                
                
               font-semibold
    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0  
                
                disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save"}
              </button> */}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={`px-4 py-2 font-semibold flex items-center gap-2
    text-[#007867] bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0
    ${saving ? "opacity-60 cursor-not-allowed" : ""}
  `}
              >
                {saving && (
                  <span className="w-4 h-4 border-2 border-[#007867] border-t-transparent rounded-full animate-spin"></span>
                )}
                {saving ? "Saving..." : "Save"}
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Category Manage Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Manage Categories</h2>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <FaTimes size={14} />
              </button>
            </div>
            <div className="px-4 py-3 space-y-3 overflow-y-auto">
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a76f] focus:border-[#00a76f]"
                  placeholder="Type a category name"
                  value={categoryDraft}
                  onChange={(e) => setCategoryDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Tab") {
                      e.preventDefault();
                      addCategoryDraft();
                    }
                  }}
                />
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-xs font-semibold  flex items-center gap-1
                  

    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
        
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0   
                  
                  
                  "
                  onClick={addCategoryDraft}
                >
                  <FaPlus size={10} />
                  <span>Add</span>
                </button>
              </div>



              <div className="space-y-2">
                {categories.length === 0 ? (
                  <p className="text-xs text-gray-500">No categories yet.</p>
                ) : (
                  categories.map((c) => (
                    <div
                      key={c}
                      className="inline-flex items-center gap-2 border border-gray-200 rounded-full px-3 py-1.5 text-xs w-auto"
                    >
                      <span>{c}</span>
                      <button
                        type="button"
                        className="text-red-500 hover:text-red-600"
                        title="Delete"
                        onClick={() => {
                          setCategoryToDelete(c);
                          setShowCategoryDeleteConfirm(true);
                        }}
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>


            </div>
          </div>
        </div>
      )}

      {/* Category Delete Confirm */}
      {showCategoryDeleteConfirm && categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              Delete Category
            </h3>
            <p className="text-xs text-gray-600 mb-4">
              Are you sure you want to delete the category &quot;{categoryToDelete}&quot;?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCategoryDeleteConfirm(false);
                  setCategoryToDelete(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCategory}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${toast.type === "error" ? "bg-red-500" : "bg-[#00a76f]"
            }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default Expense;



const RequiredLabel = ({ children }) => (
  <label className="block text-xs font-medium text-gray-600 mb-1">
    {children}
    <span className="text-red-500 ml-0.5">*</span>
  </label>
);
