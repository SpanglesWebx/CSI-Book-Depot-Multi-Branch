



import apiClient from "../utils/apiClient";
import { FaPrint, FaFilePdf, FaTimes } from "react-icons/fa";
import Pagination from "./Pagination";
import { useState, useMemo, useEffect, useContext } from "react";
import { ShopContext } from "../context/ShopContext";
import { useAuth } from "../context/AuthContext";
import SmallSizeModel from "./SmallSizeModel";


const ROWS_PER_PAGE = 100;
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";


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

const CategoryProductsModal = ({
  open,
  onClose,
  category,
  periodLabel,
  rows = [],     // UI paginated
  allRows = [],  // used only for totals
  shopname = "",
  fromDate,
  toDate,
}) => {
  /* ---------------- HOOKS ---------------- */
  const [page, setPage] = useState(1);
  const { user } = useAuth();

  const { selectedShop } = useContext(ShopContext);


  const [confirmType, setConfirmType] = useState(null); // "print" | "pdf"
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);



  useEffect(() => {
    setPage(1);
  }, [category]);

  const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return rows.slice(start, start + ROWS_PER_PAGE);
  }, [rows, page]);

  const totals = useMemo(() => {
    return allRows.reduce(
      (acc, r) => {
        acc.qty += Number(r.qty || 0);
        acc.value += Number(r.value || 0);
        return acc;
      },
      { qty: 0, value: 0 }
    );
  }, [allRows]);

  if (!open) return null;



  const buildExportParams = () => {
    const params = {
      category,
      export: 1,          // 🔥 KEY
    };

    if (fromDate && toDate) {
      params.from = fromDate;
      params.to = toDate;
    }

    return params;
  };



  const getPrintApiPath = () => {
    if (user?.role === "manager" || user?.role === "megaadmin") {
      return "master/category-products/print";
    }
    return "category-products/print"; // tenant (UNCHANGED)
  };

  const getPdfApiPath = () => {
    if (user?.role === "manager" || user?.role === "megaadmin") {
      return "master/category-products/pdf";
    }
    return "category-products/pdf"; // tenant (UNCHANGED)
  };



  const handlePrint = async () => {
    await apiClient.post(
      buildApiUrl(
        getPrintApiPath(),
        user,
        shopname
      ),
      {
        shopname,
        periodLabel,
        ...buildExportParams(), // category + dates + export
      }
    );
  };


  const handlePdf = async () => {
    const res = await apiClient.post(
      buildApiUrl(
        getPdfApiPath(),
        user,
        shopname
      ),
      {
        shopname,
        periodLabel,
        ...buildExportParams(),
      },
      { responseType: "blob" }
    );

    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${category}_Stock_${Date.now()}.pdf`;
    a.click();

    URL.revokeObjectURL(url);
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
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white w-[1100px] max-h-[92vh] rounded-lg shadow-lg overflow-hidden">

          {/* HEADER */}
          <div className="flex justify-between items-center p-4 border-b">
            <div>
              <h2 className="text-xl font-bold">{category}</h2>
              <p className="text-sm text-gray-600">{periodLabel}</p>
            </div>

            <div className="flex gap-3">


              <div className="flex gap-3 justify-end">
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

                ><FaPrint />Print</button>
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
      "

                ><FaFilePdf />Pdf</button>

              </div>
              <button onClick={onClose}><FaTimes /></button>
            </div>
          </div>

          {/* UI TABLE */}
          <div className="p-4 overflow-auto">



            <div className="text-right text-sm flex justify-end gap-6 mb-2">
              <div className="font-semibold text-green-700">
                Total Qty <span className="font-bold ml-1">{totals.qty}</span>
              </div>
              <div className="font-semibold text-green-700">
                Total Value <span className="font-bold ml-1">{totals.value}</span>
              </div>
            </div>

            <div className="p-4 overflow-auto max-h-[480px]">

              <table className="table-auto w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th>S.No</th>
                    <th>Product Code</th>
                    <th>Product Name</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Stock Value</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td>{(page - 1) * ROWS_PER_PAGE + i + 1}</td>
                      <td>{r.code}</td>
                      <td>{r.name}</td>
                      <td className="text-right">{r.qty}</td>
                      <td className="text-right">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

            </div>

            {totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            )}
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

            {/* Message */}
            <p className="text-base font-medium text-gray-800">
              Are you sure you want to
            </p>

            <p className="text-lg font-semibold text-dasher mt-1">
              {confirmType === "print" ? "Print" : "Download PDF"}?
            </p>

            {/* Category + Period */}
            <div className="mt-3 text-sm text-gray-500">
              <div>
                Category: <span className="font-semibold text-gray-700">{category}</span>
              </div>
              <div>
                Period: <span className="font-semibold text-gray-700">{periodLabel}</span>
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
};

export default CategoryProductsModal;
