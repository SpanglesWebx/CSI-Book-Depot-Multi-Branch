//src/components/PurchaseView.jsx
import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { FaPrint, FaFilePdf } from "react-icons/fa";
import apiClient from "../utils/apiClient";
import { useAuth } from "../context/AuthContext";
import { useContext } from "react";
import { ShopContext } from "../context/ShopContext";
import SmallSizeModel from "./SmallSizeModel";




const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const buildApiUrl = (path, user, selectedShopName) => {
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



const inputBoxStyle = {
  background: "#f3f4f6",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "10px 12px",
  width: "100%",
  fontSize: "14px",
  fontWeight: 600,
};

const formatDate = (date) => {
  if (!date) return "-";
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
};

/**
 * @param {object} purchase  - purchase document
 * @param {function} close   - optional close handler
 * @param {boolean} showClose - controls ❌ visibility
 */
export default function PurchaseView({
  purchase,
  close,
  mode,
  showClose = true, // ⭐ DEFAULT TRUE
  periodLabel = "",
}) {


  const { user } = useAuth();
  const { selectedShop } = useContext(ShopContext);


  const [confirmType, setConfirmType] = useState(null); // "print" | "pdf"
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const shopname =
    selectedShop?.shopname ||
    user?.shopname ||
    localStorage.getItem("shopname");



  const getPrintApiPath = (user) => {
    if (user?.role === "manager" || user?.role === "megaadmin") {
      return "master/purchase/view/print";
    }
    return "purchase/view/print";
  };

  const getPdfApiPath = (user) => {
    if (user?.role === "manager" || user?.role === "megaadmin") {
      return "master/purchase/view/pdf";
    }
    return "purchase/view/pdf";
  };


  const handlePrint = async () => {
    await apiClient.post(
      buildApiUrl(
        getPrintApiPath(user),
        user,
        selectedShop?.shopname
      ),
      {
        shopname: selectedShop?.shopname,
        periodLabel,
        purchase, // ✅ FIXED
      }
    );
  };


  const handlePdf = async () => {
    const res = await apiClient.post(
      buildApiUrl(
        getPdfApiPath(user),
        user,
        selectedShop?.shopname
      ),
      {
        shopname: selectedShop?.shopname,
        periodLabel,
        purchase, // ✅ FIXED
      },
      { responseType: "blob" }
    );

    const blob = new Blob([res.data], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Purchase_${purchase.orderNo}.pdf`;
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
    <>
    <div
      className="w-full overflow-y-auto"
      style={{ maxHeight: "80vh" }}
    >
      {/* Header */}
      <div className="mb-6 relative">
        {showClose && close && (
          <button
            onClick={close}
            className="absolute right-0 top-0 pb-2 text-gray-600 hover:text-black"
          >
            <FaTimes size={22} />
          </button>
        )}






        <div className="flex justify-between items-center pt-7 mt-8">
          {/* Left side */}
          <h1 className="text-2xl sm:text-[28px] font-bold text-[#00A76F]">
            Purchase Order
          </h1>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {mode === "purchase-register" && (
              <>
                <button
                  // onClick={handlePrint}
                  onClick={() => {
                    setConfirmType("print");
                    setShowConfirmModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-[#007867] bg-[#c8fad6]"
                >
                  <FaPrint /> Print
                </button>

                <button
                  // onClick={handlePdf}
                  onClick={() => {
                    setConfirmType("pdf");
                    setShowConfirmModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-[#007867] bg-[#c8fad6]"
                >
                  <FaFilePdf /> PDF
                </button>
              </>
            )}

            <div
              style={{
                background:
                  "linear-gradient(320deg, rgba(211,252,210,0.7) 0%, #ffffff 90%)",
                padding: "8px 14px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                minWidth: 120,
                textAlign: "center",
              }}
            >
              <h1 className="text-sm sm:text-[18px] font-bold text-[#00A76F]">
                Order No - {purchase.orderNo}
              </h1>
            </div>
          </div>
        </div>

      </div>

      {/* Purchase Info */}
      <div className="bg-white border rounded-2xl shadow-md p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium mb-1 block">
              Supplier ID
            </label>
            <div style={inputBoxStyle}>
              {purchase.supplierId || "-"}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Supplier Name
            </label>
            <div style={inputBoxStyle}>
              {purchase.supplierName}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Mobile
            </label>
            <div style={inputBoxStyle}>
              {purchase.supplierMobile}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium mb-1 block">
              Invoice No
            </label>
            <div style={inputBoxStyle}>
              {purchase.invoiceNo}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Invoice Date
            </label>
            <div style={inputBoxStyle}>
              {formatDate(purchase.invoiceDate)}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Stocked Date
            </label>
            <div style={inputBoxStyle}>
              {formatDate(purchase.stockedDate)}
            </div>
          </div>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white border rounded-2xl shadow-md p-6">
        <div className="overflow-y-auto" style={{ maxHeight: "300px" }}>
          <table className="min-w-full border-collapse text-sm sm:text-base">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2">S.No</th>
                <th className="p-2">Product Code</th>
                <th className="p-2">Product Name</th>
                <th className="p-2">Batch</th>
                <th className="p-2">MRP</th>
                <th className="p-2">Rate</th>
                <th className="p-2">GST%</th>
                <th className="p-2">Qty</th>
                <th className="p-2 text-right">Value</th>
              </tr>
            </thead>

            <tbody>
              {(purchase.batches || []).map((b, idx) => (
                <tr
                  key={b._id || idx}
                  className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="p-2">{idx + 1}</td>
                  <td className="p-2"><strong>{b.code}</strong></td>
                  <td className="p-2"><strong>{b.name}</strong></td>
                  <td className="p-2"><strong>{b.batchNo}</strong></td>
                  <td className="p-2"><strong>{b.mrp}</strong></td>
                  <td className="p-2"><strong>{b.rate}</strong></td>
                  <td className="p-2"><strong>{b.gst}</strong></td>
                  <td className="p-2"><strong>{b.qty}</strong></td>
                  <td className="p-2 text-right">
                    <strong>{Number(b.value || 0).toFixed(2)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {/* ORDER INFO 🔥 */}
      <div className="mt-3 text-sm text-gray-500">
        <div>
          Order No:{" "}
          <span className="font-semibold text-gray-700">
            {purchase?.orderNo}
          </span>
        </div>
        <div>
          Period:{" "}
          <span className="font-semibold text-gray-700">
            {periodLabel}
          </span>
        </div>
      </div>

      {/* CONFIRM BUTTON (YOUR UI 🔥) */}
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
}



