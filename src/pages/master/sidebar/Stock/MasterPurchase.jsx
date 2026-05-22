// src/master/sidebar/Stock/MasterPurchase.jsx
import React, { useEffect, useRef, useState, useContext } from "react";
import {

  FaEye,

  FaCheckCircle,
  FaTimesCircle,

} from "react-icons/fa";

import Pagination from "../../../../components/Pagination";
import PurchaseView from "../../../../components/PurchaseView";
import { ShopContext } from "../../../../context/ShopContext";
import { useAuth } from "../../../../context/AuthContext";
import apiClient from "../../../../utils/apiClient";
import { getApiUrl } from "../../../../utils/api";
import { getAuthHeaders, API } from "../../../../utils/apiHeaders";



export default function PurchasesIndex() {

  const { user } = useAuth();
  const { selectedShop } = useContext(ShopContext);

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






  // pagination
  const PER_PAGE = 25;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all"); // all | placed | received | cancelled

  // data
  const [purchases, setPurchases] = useState([]);
  const [total, setTotal] = useState(0);
  const mountedRef = useRef(true);

  // modals
  const [showView, setShowView] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [editStatus, setEditStatus] = useState("placed");
  const [busy, setBusy] = useState(false);


  useEffect(() => () => (mountedRef.current = false), []);






  // ---------------------------------------------
  //  FETCH PURCHASES
  // ---------------------------------------------
  const fetchPurchases = async (p = 1, s = search, st = status) => {
    if (!user) return;

    // If manager but no shop selected → stop
    if ((user.role === "manager" || user.role === "megaadmin") && !selectedShop) {
      setPurchases([]);
      setTotalPages(1);
      return;
    }

    try {
      const params = new URLSearchParams({
        limit: PER_PAGE,
        page: p,
      });

      if (s.trim()) params.append("search", s.trim());
      if (st !== "all") params.append("status", st);

      const endpoint = `${getApiPath("purchases")}?${params.toString()}`;

      const res = await apiClient.get(endpoint, {
        headers: {
          ...getAuthHeaders(user),
          ...(selectedShop?.shopname ? { "x-shopname": selectedShop.shopname } : {}),
        },
      });

      const data = res.data || {};
      let list = Array.isArray(data.purchases) ? data.purchases : [];

      // order by status placed → received → cancelled
      const order = { placed: 0, received: 1, cancelled: 2 };
      list = list.sort((a, b) => {
        const sa = (a.status || "").toLowerCase();
        const sb = (b.status || "").toLowerCase();
        if (order[sa] !== order[sb]) return order[sa] - order[sb];
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      setPurchases(list);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);

    } catch (err) {
      console.error("Fetch purchases error:", err);
      setPurchases([]);
      setTotal(0);
      setTotalPages(1);
    }
  };

  // reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, status, selectedShop]);

  // fetch purchases
  useEffect(() => {
    if (!user) return;

    fetchPurchases(page, search, status);

  }, [page, user, search, status, selectedShop]);


  const handlePageChange = (p) => {
    if (p === page) return;
    setPage(p);
  };

  // View action
  const openView = (purchase) => {
    setSelectedPurchase(purchase);
    setShowView(true);
  };




  // UI helpers (match supplier styles)
  const tdStyle = {
    padding: "12px 10px",
    borderTop: "1px solid #e5e7eb",
    color: "#222",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  };

  // status badge small helper
  const statusBadge = (s) => {
    const st = (s || "placed").toLowerCase();
    let color = "#f59e0b";
    let icon = null;
    if (st === "placed") {
      color = "#f59e0b"; // orange
      icon = null;
    } else if (st === "received") {
      color = "#16a34a"; // green
      icon = <FaCheckCircle />;
    } else if (st === "cancelled") {
      color = "#dc2626"; // red
      icon = <FaTimesCircle />;
    }
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 12px",
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 700,
          color,
          textTransform: "capitalize",
        }}
      >
        {icon}
        {st}
      </div>
    );
  };



  // header buttons area (left title + right add button)
  // header buttons area (left title + right buttons)
  const header = (
    <div className="flex items-center justify-between mb-4 w-full">

      {/* LEFT TITLE */}
      <h1 className="text-[28px] font-bold text-[#00A76F]">
        Purchases
      </h1>



    </div>
  );










  return (
    <div className="p-6 sm:p-8">
      {/* Top header + buttons */}

      <div className="mb-4 flex items-center justify-between">
        {header}
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search Order no, Invoice No"
          className="!w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2
               focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867]
               placeholder-gray-400 transition"
        />
      </div>

      {/* Table */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "14px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          padding: "10px",
          animation: "fadeIn .25s ease",
        }}
      >
        <div style={{ width: "100%", overflowX: "hidden" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              minWidth: 0,
              tableLayout: "auto",
            }}
          >
            <thead>
              <tr>
                {["S.No", "Order No", "Invoice No", "Date", "No. Items", "Amount", "Action"].map(
                  (h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: "12px 10px",
                        borderTop: "1px solid #e5e7eb",
                        color: "#222",
                        background: "#f3f4f6",
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        fontWeight: 600,
                        textAlign: i === 7 ? "center" : "left",
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {purchases.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      color: "#6b7280",
                      fontSize: "14px",
                    }}
                  >
                    No purchases found.
                  </td>
                </tr>
              ) : (
                purchases.map((p, idx) => (
                  <tr
                    key={p._id}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#c8fad6")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={tdStyle}>{(page - 1) * PER_PAGE + idx + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{p.orderNo}</td>
                    <td style={tdStyle}>{p.invoiceNo}</td>
                    {/* <td style={tdStyle}>
                      {p.invoiceDate ? new Date(p.invoiceDate).toLocaleDateString() : "-"}
                    </td> */}
                    <td style={tdStyle}>
                      {p.invoiceDate
                        ? new Date(p.invoiceDate).toLocaleDateString("en-GB").replace(/\//g, "-")
                        : "-"}
                    </td>

                    <td style={tdStyle}>{p.noOfItems ?? "-"}</td>
                    <td style={tdStyle}>{(p.totalAmount ?? "-")}</td>
                    {/* <td style={tdStyle}>{statusBadge(p.status)}</td> */}

                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: "8px" }}>
                        <button
                          onClick={() => openView(p)}
                          title="View"
                          style={{
                            border: "none",
                            backgroundColor: "#00A76F",
                            color: "#fff",
                            padding: "0.45rem 0.65rem",
                            borderRadius: "0.5rem",
                            cursor: "pointer",
                          }}
                        >
                          <FaEye />
                        </button>


                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-4">
        <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      </div>

      {/* View Modal */}
      {showView && selectedPurchase && (
        <Modal onClose={() => setShowView(false)}>
          <PurchaseView purchase={selectedPurchase} close={() => setShowView(false)} />

        </Modal>
      )}


    </div>
  );
}




function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* <div
        className="relative bg-white rounded-lg shadow-lg p-6 z-10 w-[95vw] max-w-[95vw]"
        style={{
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      > */}


      <div
        className="relative bg-white rounded-lg shadow-lg p-6 z-10 w-[60vw] max-w-[60vw]"
      // style={{ maxHeight: "90vh", overflowY: "auto" }}
      >

        {children}
      </div>
    </div>
  );
}

