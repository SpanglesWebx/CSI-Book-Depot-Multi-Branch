


//src/components/ExpenseViewModel.jsx
import React, { useEffect, useRef, useState } from "react";

import { FaTimes, FaPrint, FaFilePdf } from "react-icons/fa";
import apiClient from "../utils/apiClient";
import { useAuth } from "../context/AuthContext";
import { ShopContext } from "../context/ShopContext";
import { useContext } from "react";
import SmallSizeModel from "./SmallSizeModel";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const buildApiUrl = (path, user, selectedShopName) => {
  const ep = path.replace(/^\/+/, "");

  // Tenant
  if (!user || user.role === "tenant") {
    return `${API}/api/${ep}`;
  }

  // Manager / MegaAdmin
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

/* ---------- Helpers ---------- */
const formatDateDMY = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

/* ---------- View Modal ---------- */
const ExpenseViewModal = ({ expense, onClose, mode,
  periodLabel = "", }) => {

  const { user } = useAuth();
  const { selectedShop } = useContext(ShopContext);

  const shopname =
    selectedShop?.shopname;


  const [confirmType, setConfirmType] = useState(null); // "print" | "pdf"
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);


  const ref = useRef(null);

  if (!expense) return null;


  useEffect(() => {
    const el = ref.current;
    el.style.opacity = 0;
    el.style.transform = "scale(0.98)";
    requestAnimationFrame(() => {
      el.style.transition = "0.25s ease";
      el.style.opacity = 1;
      el.style.transform = "scale(1)";
    });
  }, []);


  const container = {
    width: "100%",
    maxWidth: "600px",
    padding: "24px 28px",
  };

  const headerRow = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  };

  const title = {
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#222",
  };

  const closeBtn = {
    fontSize: "22px",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#777",
  };

  const row = {
    display: "flex",
    justifyContent: "space-between",
    padding: "14px 0",
    borderBottom: "1px solid #e6e6e6",
  };

  const keyStyle = {
    fontWeight: 600,
    color: "#444",
    width: "35%",
  };

  const valueStyle = {
    width: "60%",
    textAlign: "right",
    color: "#222",
    fontWeight: 500,
    wordBreak: "break-word",
  };


  const getPrintApiPath = () =>
    user?.role === "manager" || user?.role === "megaadmin"
      ? "master/expense/view/print"
      : "expense/view/print";

  const getPdfApiPath = () =>
    user?.role === "manager" || user?.role === "megaadmin"
      ? "master/expense/view/pdf"
      : "expense/view/pdf";


  const handlePrint = async () => {
    await apiClient.post(
      buildApiUrl(getPrintApiPath(), user, shopname),
      {
        shopname,
        periodLabel,
        expense, // 🔥 ONLY SELECTED RECEIPT
      }
    );
  };


  const handlePdf = async () => {
    const res = await apiClient.post(
      buildApiUrl(getPdfApiPath(), user, shopname),
      {
        shopname,
        periodLabel,
        expense,
      },
      { responseType: "blob" }
    );

    const blob = new Blob([res.data], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Expense_${expense.receiptNo}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
  };



  const handleConfirmAction = async () => {
    try {
      if (saving) return;

      setSaving(true);

      if (confirmType === "print") {
        await handlePrint();
      } else {
        await handlePdf();
      }

      setShowConfirmModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        ref={ref}
        style={container}
        className="bg-white rounded-lg shadow-lg"
      >

        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Expense Details</h2>

          <div className="flex gap-2 items-center">
            {/* ✅ PRINT + PDF ONLY FOR EXPENSE REPORT */}
            {mode === "expense-report" && (
              <>
                <button
                  // onClick={handlePrint}
                  onClick={() => {
                    setConfirmType("print");
                    setShowConfirmModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#c8fad6] text-[#007867] font-semibold"
                >
                  <FaPrint />
                  Print
                </button>

                <button
                  // onClick={handlePdf}
                  onClick={() => {
                    setConfirmType("pdf");
                    setShowConfirmModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#c8fad6] text-[#007867] font-semibold"
                >
                  <FaFilePdf />
                  PDF
                </button>
              </>
            )}

            <button onClick={onClose}>
              <FaTimes size={20} />
            </button>
          </div>
        </div>


        {/* Key – Value Rows */}
        <div>
          <div style={row}>
            <span style={keyStyle}>Date</span>
            <span style={valueStyle}>{formatDateDMY(expense.date)}</span>
          </div>

          <div style={row}>
            <span style={keyStyle}>Receipt No</span>
            <span style={valueStyle}>{expense.receiptNo || "-"}</span>
          </div>


          <div style={row}>
            <span style={keyStyle}>Spend To</span>
            <span style={valueStyle}>{expense.spendTo || "-"}</span>
          </div>


          <div style={row}>
            <span style={keyStyle}>Category</span>
            <span style={valueStyle}>{expense.category || "-"}</span>
          </div>


          <div style={row}>
            <span style={keyStyle}>Payment For / Reason</span>
            <span style={valueStyle}>{expense.reason || "-"}</span>
          </div>



          <div style={row}>
            <span style={keyStyle}>Amount</span>
            <span style={valueStyle}>
              ₹ {Number(expense.amount || 0).toFixed(2)}
            </span>
          </div>

          <div style={row}>
            <span style={keyStyle}>Reference Type</span>

            <span
              style={{
                ...valueStyle,
                textTransform: "capitalize",
              }}
            >
              {expense.refType || "-"}
            </span>

          </div>

          <div style={row}>
            <span style={keyStyle}>
              {expense.refType === "voucher" ? "Voucher No" : "Bill No"}
            </span>
            <span style={valueStyle}>{expense.refNumber || "-"}</span>
          </div>

          <div style={row}>
            <span style={keyStyle}>Added By</span>
            <span style={valueStyle}>{expense.addedByName || "-"}</span>
          </div>
        </div>
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

            {/* EXPENSE DETAILS */}
            <div className="mt-3 text-sm text-gray-500">
              <div>
                Receipt No:{" "}
                <span className="font-semibold text-gray-700">
                  {expense?.receiptNo}
                </span>
              </div>

              <div>
                Amount:{" "}
                <span className="font-semibold text-gray-700">
                  ₹{Number(expense?.amount || 0).toFixed(2)}
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

export default ExpenseViewModal;
