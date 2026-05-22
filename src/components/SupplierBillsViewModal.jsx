


// src/components/SupplierBillsViewModal.jsx
import React from "react";
import { FaTimes, FaPrint, FaFilePdf } from "react-icons/fa";
import apiClient from "../utils/apiClient";
import { ShopContext } from "../context/ShopContext";
import { useAuth } from "../context/AuthContext";
import { useState, useMemo, useEffect, useContext } from "react";
import SmallSizeModel from "./SmallSizeModel";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";



/* ------------------ helpers ------------------ */
const formatDate = (date) => {
  if (!date) return "-";
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
};

const getPeriodFromPurchases = (purchases = []) => {
  if (!purchases.length) return null;

  const dates = purchases
    .map((p) => new Date(p.createdAt || p.stockedDate || p.invoiceDate))
    .filter((d) => !isNaN(d));

  if (!dates.length) return null;

  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));

  return `${formatDate(min)} to ${formatDate(max)}`;
};




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


/* =========================================================
   SUPPLIER BILLS VIEW MODAL
========================================================= */
export default function SupplierBillsViewModal({

  supplier,
  purchases = [],
  periodLabel,      // ⭐ optional override
  close,
}) {


  const { user } = useAuth();
  const { selectedShop } = useContext(ShopContext);

  const shopname = selectedShop?.shopname;
  const computedPeriod = getPeriodFromPurchases(purchases);
  const finalPeriod = periodLabel || computedPeriod || "-";


  const [confirmType, setConfirmType] = useState(null); // "print" | "pdf"
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);



  const getPrintApiPath = (user) => {
    if (user?.role === "manager" || user?.role === "megaadmin") {
      return "master/purchase/supplier-bills/print";
    }
    return "purchase/supplier-bills/print"; // tenant (UNCHANGED)
  };

  const getPdfApiPath = (user) => {
    if (user?.role === "manager" || user?.role === "megaadmin") {
      return "master/purchase/supplier-bills/pdf";
    }
    return "purchase/supplier-bills/pdf"; // tenant (UNCHANGED)
  };
  const handlePrint = async () => {
    await apiClient.post(
      buildApiUrl(
        getPrintApiPath(user),
        user,
        shopname
      ),
      {
        shopname,
        supplierName: supplier.supplierName,
        periodLabel: finalPeriod,
        rows: purchases,
      }
    );
  };




  const handlePdf = async () => {
    const res = await apiClient.post(
      buildApiUrl(
        getPdfApiPath(user),
        user,
        shopname
      ),
      {
        shopname,
        supplierName: supplier.supplierName,
        periodLabel: finalPeriod,
        rows: purchases,
      },
      { responseType: "blob" }
    );

    const blob = new Blob([res.data], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Supplier_${supplier.supplierName}_Bills.pdf`;
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

    <div className="w-full overflow-y-auto" style={{ maxHeight: "85vh" }}>
      {/* ---------------- HEADER ---------------- */}
      <div className="mb-6 relative">
        <button
          onClick={close}
          className="absolute right-0 top-0 text-gray-600 hover:text-black"
        >
          <FaTimes size={22} />
        </button>

        <h1 className="text-2xl sm:text-[26px] font-bold text-[#00A76F]">
          Supplier Bills — {supplier?.supplierName}
        </h1>

        {/* PERIOD + ACTIONS ROW */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

          {/* LEFT — PERIOD INFO */}
          <div className="text-sm text-gray-700 font-semibold">
            <div>
              Period: <span className="text-gray-900">{finalPeriod}</span>
            </div>
            <div>
              Total Bills: <span className="text-gray-900">{purchases.length}</span>
            </div>
          </div>

          {/* RIGHT — PRINT / PDF BUTTONS */}
          <div className="flex gap-3">
            <button
              // onClick={handlePrint}

              onClick={() => {
                setConfirmType("print");
                setShowConfirmModal(true);
              }}
              className="
        inline-flex items-center gap-2
        px-4 py-2
        rounded-lg
        font-semibold
        text-[#007867]
        bg-[#c8fad6]
        shadow-[0_8px_24px_rgba(0,0,0,0.08)]
        transition-all
        hover:-translate-y-[1px]
      "
            >
              <FaPrint /> Print
            </button>

            <button
              // onClick={handlePdf}
              onClick={() => {
                setConfirmType("pdf");
                setShowConfirmModal(true);
              }}
              className="
        inline-flex items-center gap-2
        px-4 py-2
        rounded-lg
        font-semibold
        text-[#007867]
        bg-[#c8fad6]
        shadow-[0_8px_24px_rgba(0,0,0,0.08)]
        transition-all
        hover:-translate-y-[1px]
      "
            >
              <FaFilePdf /> PDF
            </button>
          </div>
        </div>

      </div>

      {/* ---------------- BILLS LIST ---------------- */}
      {purchases.length === 0 ? (
        <div className="text-center text-gray-500">
          No bills found
        </div>
      ) : (
        <div className="space-y-6">
          {purchases.map((purchase, billIndex) => (
            <div
              key={purchase._id || billIndex}
              className="bg-white border rounded-2xl shadow-md p-5"
            >
              {/* -------- ORDER NO -------- */}
              <h2 className="text-lg font-semibold text-[#00A76F] mb-4">
                Order No — {purchase.orderNo}
              </h2>

              {/* -------- BATCH TABLE (2nd scroll) -------- */}
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
          ))}
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

      {/* DETAILS */}
      <div className="mt-3 text-sm text-gray-500">
        <div>
          Supplier:{" "}
          <span className="font-semibold text-gray-700">
            {supplier?.supplierName}
          </span>
        </div>

        <div>
          Period:{" "}
          <span className="font-semibold text-gray-700">
            {finalPeriod}
          </span>
        </div>

        <div>
          Total Bills:{" "}
          <span className="font-semibold text-gray-700">
            {purchases.length}
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
</>
  );
}



