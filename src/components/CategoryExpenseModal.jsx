// src/components/CategoryExpenseModal.jsx
import React, { useEffect, useState } from "react";
import { FaTimes, FaPrint, FaFilePdf } from "react-icons/fa";
import Pagination from "./Pagination";
import SmallSizeModel from "./SmallSizeModel";
import html2pdf from "html2pdf.js";
import axios from "axios";
// import { useAuth } from "../context/AuthContext";

const PAGE_SIZE = 10;

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function CategoryExpenseModal({
  open,
  onClose,
  category,
  periodLabel,
  fetchFn, // function(page) => api call

  user,
  shopname,
  from,
  to,
  buildApiUrl,
  getHeaders,
}) {

  // const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);


  const [confirmType, setConfirmType] = useState(null); // "print" | "pdf"
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadData(1);
  }, [open]);

  const loadData = async (p) => {
    setLoading(true);
    const res = await fetchFn(p);
    setRows(res.rows || []);
    setTotalPages(res.totalPages || 1);
    setPage(p);
    setLoading(false);
  };

  if (!open) return null;


  const getDetailsPrintPath = () => {
    if (user?.role === "manager" || user?.role === "megaadmin") {
      return "master/expense/category/details/print";
    }
    return "expense/category/details/print"; // tenant (unchanged)
  };

  const getDetailsPdfPath = () => {
    if (user?.role === "manager" || user?.role === "megaadmin") {
      return "master/expense/category/details/pdf";
    }
    return "expense/category/details/pdf"; // tenant (unchanged)
  };



  const buildExportParams = () => {
    const params = {
      export: 1,
      category,
    };

    if (from && to) {
      params.from = from;
      params.to = to;
    }

    return params;
  };



  const handlePrint = async () => {
    try {
      const res = await axios.get(
        buildApiUrl(
          "branch-reports/expense/category/details",
          user,
          shopname
        ),
        {
          params: buildExportParams(),
          headers: getHeaders(),
        }
      );

      await axios.post(
        buildApiUrl(
          getDetailsPrintPath(),
          user,
          shopname
        ),
        {
          shopname,
          category,
          periodLabel,
          rows: res.data.rows,
          summary: res.data.summary,
        },
        { headers: getHeaders() }
      );
    } catch (err) {
      console.error("❌ Category Print failed", err);
    }
  };



  const handlePdf = async () => {
    try {
      const res = await axios.get(
        buildApiUrl(
          "branch-reports/expense/category/details",
          user,
          shopname
        ),
        {
          params: buildExportParams(),
          headers: getHeaders(),
        }
      );

      const pdf = await axios.post(
        buildApiUrl(
          getDetailsPdfPath(),
          user,
          shopname
        ),
        {
          shopname,
          category,
          periodLabel,
          rows: res.data.rows,
          summary: res.data.summary,
        },
        {
          responseType: "blob",
          headers: getHeaders(),
        }
      );

      const blob = new Blob([pdf.data], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Category_${category}.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("❌ Category PDF failed", err);
    }
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[95%] max-w-6xl shadow-xl animate-[fadeIn_.2s_ease]">

        {/* HEADER */}
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">
              Expense Report – Category Wise
            </h2>
            <div className="text-semibold ">{category}</div>
            <div className="text-sm text-gray-600">{periodLabel}</div>
          </div>

          <div className="flex items-center gap-3">


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
      ">
              <FaPrint /> Print
            </button>
            <button
              // onClick={handlePdf} 
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
      ">
              <FaFilePdf /> Pdf
            </button>
            <button onClick={onClose} className="p-2 text-gray-600">
              <FaTimes />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-x-auto" id="category-modal-table">
          {loading ? (
            <div className="text-center">Loading...</div>
          ) : (
            <table className="table-auto w-full border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  {[
                    "S.No",
                    "Date",
                    "Receipt No",
                    "Payment For / Reason",
                    "Amount",
                    "Spend To",
                    "Reference Type",
                    "Bill No",
                    "Added By",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r._id} className="border-t">
                    <td>{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td>{formatDate(r.date)}</td>
                    <td>{r.receiptNo}</td>
                    <td>{r.reason}</td>
                    <td className="text-right">{r.amount.toFixed(2)}</td>
                    <td>{r.spendTo}</td>
                    <td>{r.refType}</td>
                    <td>{r.refNumber}</td>
                    <td>{r.addedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => loadData(p)}
              />
            </div>
          )}
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

            {/* DETAILS */}
            <div className="mt-3 text-sm text-gray-500">
              <div>
                Category:{" "}
                <span className="font-semibold text-gray-700">
                  {category}
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
