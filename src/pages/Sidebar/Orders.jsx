
// src/pages/Sidebar/Orders.jsx
import { useEffect, useRef, useState, useContext } from "react";
import {
  FaPlus,
  FaEye,
  FaEdit,
  FaCheck,
  FaTimes,
  FaTrash,

} from "react-icons/fa";
import "../../styles/Sidebar/Orders.css";
import { useAuth } from "../../context/AuthContext";
import { ShopContext } from "../../context/ShopContext";
import { tenantApiUrl, apiGet, apiPost, apiPut } from "../../utils/api"; 1
import Pagination from "../../components/Pagination";
import axios from "axios";
import ReactDOM from "react-dom";


import { getApiUrl } from "../../utils/api";

export default function Orders({ shopname: propShopname }) {
  const { user } = useAuth();
  const { selectedShop } = useContext(ShopContext);

  const shopname = selectedShop?.shopname || propShopname || user?.shopname;
  const token = localStorage.getItem("token");
  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const [search, setSearch] = useState("");

  const [searchText, setsearchText] = useState("");

  const ORDERS_API = isAdmin
    ? tenantApiUrl("orders", selectedShop?.shopname || shopname)
    : tenantApiUrl("orders");



  const PRODUCTS_API = (search = "") =>
    isAdmin
      ? `${tenantApiUrl("products/active", selectedShop?.shopname || shopname)}?limit=0&search=${encodeURIComponent(search)}`
      : `${tenantApiUrl("products/active")}?limit=0&search=${encodeURIComponent(search)}`;



  /* ---------- State ---------- */
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);

  const [orderNo, setOrderNo] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [orderLines, setOrderLines] = useState([]);
  const nextLineId = useRef(1);

  const focusedFieldRef = useRef({}); // { [lineId]: "code"|"name" } to manage blur timing

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10); // pagination 10
  const [totalPages, setTotalPages] = useState(1);

  // filters
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const [isEditingOrder, setIsEditingOrder] = useState(false);

  /* ---------- Toasts ---------- */
  const pushToast = (msg) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };

  /* ---------- Fetch Orders & Products ---------- */
  const fetchOrders = async (p = 1, overrides = {}) => {
    setLoading(true);
    try {
      const orderNoQuery = overrides.orderNo ?? debouncedSearch ?? "";
      const statusQuery = overrides.status ?? searchStatus ?? "";
      const startQuery = overrides.startDate ?? dateRange.start ?? "";
      const endQuery = overrides.endDate ?? dateRange.end ?? "";

      const query = new URLSearchParams({
        page: p,
        limit,
        orderNo: orderNoQuery,
        status: statusQuery,
        startDate: startQuery,
        endDate: endQuery,
      }).toString();

      const res = await fetch(`${ORDERS_API}?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      setOrders(data.orders || []);
      setTotalPages(data.totalPages || 1);
      setPage(p);
    } catch (err) {
      console.error("fetchOrders error:", err);
      pushToast("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (search = "") => {
    try {
      const data = await apiGet(PRODUCTS_API(search), token);

      const list =
        Array.isArray(data)
          ? data
          : Array.isArray(data?.products)
            ? data.products
            : Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data?.items)
                ? data.items
                : [];

      const normalized = list.map((p) => ({
        _id: p._id,
        code: (p.code || "").trim(),
        name: (p.name || "").trim(),
      }));

      setProducts(normalized);
    } catch (err) {
      console.error("fetchProducts error:", err);
      pushToast("Failed to fetch products");
    }
  };

  useEffect(() => {
    fetchProducts(searchText);
  }, [searchText]);


  useEffect(() => {
    fetchOrders(page);
    // fetchProducts();
    nextLineId.current = 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopname, selectedShop?.shopname, user?.role]);

  // debounce searchTerm
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    fetchOrders(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, searchStatus, dateRange.start, dateRange.end]);

  /* ---------- Utilities ---------- */
  const todayFormatted = () => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const getDateRange = (type) => {
    const today = new Date();
    let start, end;
    switch (type) {
      case "today":
        start = end = today;
        break;
      case "week":
        start = new Date(today);
        start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
        end = today;
        break;
      case "month":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = today;
        break;
      default:
        return { start: "", end: "" };
    }
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  };

  const handleDateFilter = (type) => {
    const range = getDateRange(type);
    setDateRange(range);
    fetchOrders(1, {
      startDate: range.start,
      endDate: range.end,
      status: searchStatus,
      orderNo: debouncedSearch,
    });
  };

  /* ---------- Modal & Order Lines ---------- */

  const blankLine = () => ({
    id: nextLineId.current++,
    code: "",
    name: "",
    qty: "",
    suggestions: [],
    suggestionType: null,
    isEditing: false,
    isNew: true,
    backup: null,
  });

  const openCreate = async () => {
    setIsEditingOrder(false);
    if (!products.length) await fetchProducts();
    try {
      const res = await apiGet(`${ORDERS_API}/next-order-no/preview`, token);
      setOrderNo(res?.orderNo || "ORDER001");
    } catch {
      setOrderNo("ORDER001");
    }

    setOrderDate(todayFormatted());
    nextLineId.current = 1;
    setOrderLines([blankLine()]);
    setSelectedOrder(null);
    setShowModal(true);
  };

  // open edit (status-only): we fill orderLines for display (readonly) and selectedOrder for status
  const openEdit = async (order) => {
    // allow showing edit modal for any status; inside modal status dropdown can be disabled if not 'placed'
    setIsEditingOrder(true);

    // prepare orderLines from order items (works even if items empty)
    nextLineId.current = 1;
    const lines = (order.items || []).map((it) => ({
      id: nextLineId.current++,
      code: it.code,
      name: it.name,
      qty: it.qty,
      suggestions: [],
      suggestionType: null,
      isEditing: false,
      isNew: false,
      backup: null,
    }));

    setSelectedOrder({ ...order }); // keep original order object for metadata/status
    setOrderNo(order.orderNo);
    setOrderDate(order.date || todayFormatted());
    setOrderLines(lines);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setOrderLines([]);
    setIsEditingOrder(false);
    setSelectedOrder(null);
  };


  // Show all or filtered product suggestions, trigger API if needed
  const showSuggestionsForLine = async (id, by = "name", filter = "") => {
    const term = (filter || "").toLowerCase();

    let matches = [];

    // ✅ If local products exist, try to filter them first
    if (products && products.length > 0) {
      matches =
        term === ""
          ? products
          : by === "name"
            ? products.filter((p) => (p.name || "").toLowerCase().includes(term))
            : products.filter((p) => (p.code || "").toLowerCase().includes(term));
    }

    // ✅ If no matches found or list empty → fetch from API
    if (matches.length === 0 && term) {
      try {
        const res = await axios.get(`${API_BASE}/products?limit=0&search=${encodeURIComponent(term)}`, {
          headers: getAuthHeaders(user),
        });
        const fetched = res?.data?.products || [];
        matches = fetched;
      } catch (err) {
        console.error("Error fetching suggestions:", err);
      }
    }

    // Mark which field is focused
    focusedFieldRef.current[id] = by;

    // Update orderLines with suggestions
    setOrderLines((prev) =>
      prev.map((ln) =>
        ln.id === id
          ? { ...ln, suggestions: matches.slice(0, 300), suggestionType: by }
          : ln
      )
    );
  };




  const selectSuggestionForLine = (id, prod) => {
    setOrderLines(prev =>
      prev.map(ln =>
        ln.id === id
          ? {
            ...ln,
            code: prod.code,
            name: prod.name,
            suggestions: [],
            suggestionType: null,
          }
          : ln
      )
    );

    delete focusedFieldRef.current[id];
  };



  const updateLineField = async (id, field, value) => {
    setOrderLines(prev =>
      prev.map(ln => (ln.id === id ? { ...ln, [field]: value } : ln))
    );

    // Link code <-> name automatically
    if (field === "code" || field === "name") {
      const searchValue = value.trim();

      if (!searchValue) {
        // Clear when empty
        setOrderLines(prev =>
          prev.map(ln =>
            ln.id === id
              ? { ...ln, suggestions: [], code: field === "code" ? "" : ln.code, name: field === "name" ? "" : ln.name }
              : ln
          )
        );
        return;
      }

      try {
        // 🔥 LIVE API SEARCH
        const data = await apiGet(PRODUCTS_API(searchValue), token);

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.products)
            ? data.products
            : [];

        const normalized = list.map(p => ({
          _id: p._id,
          code: (p.code || "").trim(),
          name: (p.name || "").trim(),
        }));

        setOrderLines(prev =>
          prev.map(ln =>
            ln.id === id
              ? {
                ...ln,
                suggestions: normalized.slice(0, 300),
                suggestionType: field,
              }
              : ln
          )
        );
      } catch (err) {
        console.error("Suggestion API Error:", err);
      }
    }

    // Qty update rule
    if (field === "qty") {
      setOrderLines(prev =>
        prev.map(ln =>
          ln.id === id
            ? { ...ln, qty: value === "" || Number(value) <= 0 ? "" : value }
            : ln
        )
      );
    }
  };




  const finalizeRow = (id) => {
    const row = orderLines.find((r) => r.id === id);
    if (!row) return;

    if (!row.code || !row.name || !row.qty) {
      pushToast("Fill required fields");
      return;
    }
    const q = Number(row.qty || 0);
    if (!q || q <= 0) {
      pushToast("Qty must be > 0");
      return;
    }

    setOrderLines((prev) => {
      // mark the row finalized
      const updated = prev.map((r) => (r.id === id ? { ...r, isNew: false } : r));
      // ensure one empty row exists
      if (!updated.some((r) => r.isNew === true)) updated.push(blankLine());
      return updated;
    });
  };

  const removeRow = (id) => {
    setOrderLines((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      if (!filtered.some((r) => r.isNew === true)) filtered.push(blankLine());
      return filtered;
    });
  };

  const startEditRow = (id) => {
    setOrderLines((prev) => prev.map((r) => (r.id === id ? { ...r, isEditing: true, backup: { ...r } } : r)));
  };

  const cancelEditRow = (id) => {
    setOrderLines((prev) => prev.map((r) => (r.id === id ? { ...(r.backup || r), isEditing: false, backup: null } : r)));
  };

  const saveEditRow = (id) => {
    const row = orderLines.find((r) => r.id === id);
    if (!row) return;
    if (!row.code || !row.name || !row.qty) {
      pushToast("Fill required fields");
      return;
    }
    if (!Number(row.qty) || Number(row.qty) <= 0) {
      pushToast("Qty must be > 0");
      return;
    }
    setOrderLines((prev) => prev.map((r) => (r.id === id ? { ...r, isEditing: false, backup: null } : r)));
  };

  const validateLine = (ln) => {
    if (!ln) return "Invalid row";
    if (!ln.code || !ln.name) return "Product required";
    const q = Number(ln.qty || 0);
    if (!q || q <= 0) return "Qty must be > 0";
    return "";
  };

  // Confirm order: create (add mode) or update status (edit mode)
  const confirmOrder = async () => {
    if (!isEditingOrder) {
      // create: collect finalized rows
      const nonBlankLines = orderLines.filter((ln) => ln.code && ln.name && ln.qty && !ln.isNew);
      if (nonBlankLines.length === 0) return pushToast("Cannot confirm empty order");

      const validated = nonBlankLines.map((ln) => ({ ...ln, error: validateLine(ln) }));
      setOrderLines((prev) => prev.map((ln) => validated.find((v) => v.id === ln.id) || ln));
      if (validated.some((ln) => ln.error)) return pushToast("Fix required fields");

      const payload = validated.map((ln) => ({
        code: ln.code.trim(),
        name: ln.name.trim(),
        qty: Number(ln.qty),
      }));

      try {
        const res = await apiPost(ORDERS_API, { items: payload, date: orderDate, status: "placed" }, token, { "x-shopname": shopname });
        pushToast(`Order placed: ${res.orderNo || res.orderNo || ""}`);
        await fetchOrders(1);
        closeModal();
      } catch (err) {
        console.error("confirmOrder error:", err);
        pushToast(err?.response?.data?.message || "Failed to place order");
      }
    } else {
      // edit mode: only update status
      const newStatus = selectedOrder?.status;
      if (!newStatus) return pushToast("Pick status");
      try {
        await apiPut(`${ORDERS_API}/${selectedOrder._id}/status`, { status: newStatus }, token);
        pushToast(`Status updated: ${newStatus}`);
        // update orders in UI (best-effort)
        setOrders((prev) => prev.map((o) => (o._id === selectedOrder._id ? { ...o, status: newStatus } : o)));
        closeModal();
      } catch (err) {
        console.error("updateOrderStatus", err);
        pushToast("Failed to update status");
      }
    }
  };

  const statusColor = (status) => {
    if (!status) return "#9CA3AF";
    const s = status.toLowerCase();
    switch (s) {
      case "placed":
        return "#F59E0B";
      case "received":
      case "completed":
        return "#00A76f";
      case "cancelled":
        return "#E53935";
      default:
        return "#9CA3AF";
    }
  };

  const formatStatusText = (status) => (status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "");

  /* ---------- View Order ---------- */
  const openView = async (order) => {
    try {
      const data = await apiGet(`${ORDERS_API}/${order._id}`, token);
      const full = data.order || data;
      setSelectedOrder(full);
      setViewOpen(true);
    } catch (err) {
      console.error("openView error:", err);
      pushToast("Failed to load order details");
    }
  };
  const closeView = () => {
    setSelectedOrder(null);
    setViewOpen(false);
  };

  const orderTotalQty = (order) => (order.items || []).reduce((s, it) => s + Number(it.qty || 0), 0);



  const renderDropdownPortal = (element, id) => {
    const input = document.querySelector(`[data-input-id='${id}']`);
    if (!input) return null;

    const rect = input.getBoundingClientRect();

    const dropdownStyle = {
      position: "absolute",
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      background: "#fff",
      border: "1px solid #ccc",
      borderRadius: 6,
      boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
      maxHeight: 220,
      overflowY: "auto",
      zIndex: 999999,
      fontSize: "12px"
    };

    return ReactDOM.createPortal(<div style={dropdownStyle}>{element}</div>, document.body);
  };

  /* ---------- Render ---------- */
  return (
    <div className="order-page p-8 pt-10 sm:pt-10">
      {/* Toasts */}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.msg}</div>
        ))}
      </div>

      {/* Header */}
      <div className="orders-header">
        <h2>Orders</h2>
        <button className="
        inline-flex items-center justify-center w-44 gap-2 px-4 py-2 
         rounded-lg 
    font-semibold
    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0     
        
        " onClick={openCreate}>
          <FaPlus /> Purchase Order
        </button>
      </div>

      {/* Filters Row */}
      <div className="flex gap-2 mb-4 items-center flex-wrap">
        <input
          type="text"
          placeholder="Search by Order No or Product Name"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex p-2 border border-gray-300 rounded text-sm"
          style={{ minWidth: "120px", maxWidth: "300px" }}
        />

        <select
          value={searchStatus}
          onChange={(e) => {
            setSearchStatus(e.target.value);
            fetchOrders(1, { status: e.target.value, orderNo: debouncedSearch, startDate: dateRange.start, endDate: dateRange.end });
          }}
          className="p-2 border border-gray-300 rounded text-sm"
          style={{ minWidth: "100px", maxWidth: "100px" }}
        >
          <option value="">All Status</option>
          <option value="placed">Placed</option>
          <option value="received">Received</option>
          {/* <option value="completed">Completed</option> */}
          <option value="cancelled">Cancelled</option>
        </select>

        <select onChange={(e) => handleDateFilter(e.target.value)} className="p-2 border border-gray-300 rounded text-sm" style={{ minWidth: "100px", maxWidth: "100px" }}>
          <option value="">All Dates</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="salesbill-table-wrapper fade-in">
        <table className="table">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Order No</th>
              <th>Order Date</th>
              <th>Product Name</th>
              <th>Qty</th>
              <th>Status</th>
              <th>Status Date</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="text-center p-4 text-muted">Loading...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan="8" className="text-center p-4 text-muted">No orders found</td></tr>
            ) : (
              orders.map((o, i) => {
                const firstName = (o.items && o.items[0]?.name) || "-";
                const updatedDate =
                  (o.confirmedAt && new Date(o.confirmedAt).toLocaleDateString("en-GB")) ||
                  (o.cancelledAt && new Date(o.cancelledAt).toLocaleDateString("en-GB")) ||
                  (o.updatedAt && new Date(o.updatedAt).toLocaleDateString("en-GB")) ||
                  "-";
                return (
                  <tr key={o._id || o.orderNo || i} className="hover:bg-[#fafafa] transition">
                    <td>{(page - 1) * limit + i + 1}</td>
                    <td>{o.orderNo}</td>
                    <td>{o.date}</td>
                    <td>{firstName}{o.items?.length > 1 ? ` (+${o.items.length - 1})` : ""}</td>
                    <td>{orderTotalQty(o)}</td>
                    <td style={{ color: statusColor(o.status) }}>{formatStatusText(o.status)}</td>
                    <td>{updatedDate}</td>
                    <td className="text-center">
                      <button
                        onClick={() => openView(o)}
                        title="View"
                        style={{
                          border: "none",
                          backgroundColor: "#00A76F",
                          color: "#fff",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "0.5rem",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          marginRight: 6,
                        }}
                        onMouseEnter={(e) => (e.target.style.backgroundColor = "#007867")}
                        onMouseLeave={(e) => (e.target.style.backgroundColor = "#00A76F")}
                      >
                        <FaEye />
                      </button>

                      {o.status === "placed" && (
                        <button
                          onClick={() => openEdit(o)}
                          title="Edit"
                          style={{
                            border: "none",
                            backgroundColor: "#F59E0B",
                            color: "#fff",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.5rem",
                            cursor: "pointer",
                            transition: "all 0.3s ease",
                          }}
                          onMouseEnter={(e) => (e.target.style.backgroundColor = "#B45309")}
                          onMouseLeave={(e) => (e.target.style.backgroundColor = "#F59E0B")}
                        >
                          <FaEdit />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <Pagination page={page} totalPages={totalPages} onPageChange={fetchOrders} />
      </div>

      {/* ---------- Add / Edit Modal ---------- */}
      {showModal && (
        <div className="modal wide">
          <div
            className="modal-content slide-up"
            style={{
              maxWidth: isEditingOrder ? "420px" : "850px",
              padding: "1.5rem",
            }}
          >
            {/* Header */}
            <div className="modal-header">
              <h3>{isEditingOrder ? `Edit Order (${orderNo})` : "New Order"}</h3>
              <button className="icon-close" onClick={closeModal}>
                ×
              </button>
            </div>

            {/* Edit Mode: Status Update + product table (readonly from orderLines) */}
            {isEditingOrder ? (
              <div
                className="modal-body"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.2rem",
                  marginTop: "1rem",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    rowGap: "0.8rem",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>Order No:</div>
                  <div>{orderNo}</div>

                  <div style={{ fontWeight: 600 }}>Updated Order Status:</div>
                  <div>
                    <select
                      className="status-dropdown"
                      value={selectedOrder?.status || "placed"}
                      onChange={(e) =>
                        setSelectedOrder({ ...selectedOrder, status: e.target.value })
                      }
                      disabled={selectedOrder?.status !== "placed"}
                      style={{
                        color: statusColor(selectedOrder?.status),
                        fontSize: "0.85rem",
                        padding: "6px 10px",
                        width: "160px",
                        borderRadius: 6,
                        border: "1px solid #ddd",
                        backgroundColor: selectedOrder?.status !== "placed" ? "#f5f5f5" : "white",
                        cursor: selectedOrder?.status !== "placed" ? "not-allowed" : "pointer",
                      }}
                    >
                      <option value="placed" style={{ color: "#F59E0B" }}>Placed</option>
                      <option value="received" style={{ color: "#00A76f" }}>Received</option>
                      <option value="cancelled" style={{ color: "#E53935" }}>Cancelled</option>
                    </select>
                  </div>

                  <div style={{ fontWeight: 600 }}>Date:</div>
                  <div>{orderDate}</div>
                </div>

                <div className="overflow-x-auto mt-2">
                  <table className="min-w-full border-collapse table-auto text-left">
                    <thead>
                      <tr>
                        <th style={{ width: "35%" }}>Product Code</th>
                        <th style={{ width: "45%" }}>Product Name</th>
                        <th style={{ width: "20%" }}>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderLines && orderLines.length > 0 ? (
                        orderLines.map((ln, i) => (
                          <tr key={ln.id}>
                            <td>{ln.code}</td>
                            <td>{ln.name}</td>
                            <td>{ln.qty}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="text-center text-gray-500 p-4">No products found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Add Mode */
              <div className="modal-body">
                <div className="order-fields">
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label><strong>Order No</strong></label>
                      <input value={orderNo} readOnly className="input" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label><strong>Date</strong></label>
                      <input value={orderDate} readOnly className="input" />
                    </div>
                  </div>
                </div>

                <div
                  className="overflow-x-auto mt-4"
                  style={{
                    overflowX: "visible", // allow horizontal overflow
                    overflowY: "visible", // allow dropdown to show outside
                    position: "relative", // allow absolute-position dropdowns
                  }}
                >
                  <table className="min-w-full border-collapse table-auto text-left">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>S.No</th>
                        <th>Product Code</th>
                        <th>Product Name</th>
                        <th style={{ width: 120 }}>Qty</th>
                        <th style={{ width: 160 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderLines.map((ln, idx) => (
                        <tr key={ln.id}>
                          <td style={{ verticalAlign: "top" }}>{idx + 1}</td>

                          {/* ✅ Product Code */}
                          <td>
                            <input
                              data-input-id={`code-${ln.id}`}
                              className="input"
                              value={ln.code}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateLineField(ln.id, "code", val);
                                if (!val.trim()) updateLineField(ln.id, "name", "");
                                showSuggestionsForLine(ln.id, "code", val);
                              }}
                              // onFocus={() => showSuggestionsForLine(ln.id, "code", ln.code)}
                              onBlur={() =>
                                setTimeout(() => {
                                  setOrderLines((prev) =>
                                    prev.map((r) =>
                                      r.id === ln.id ? { ...r, suggestions: [] } : r
                                    )
                                  );
                                  delete focusedFieldRef.current[ln.id];
                                }, 300)
                              }
                              placeholder="Enter product code"
                              style={{
                                width: "100%",
                                padding: "6px 10px",
                                border: "1px solid #ccc",
                                borderRadius: "6px",
                                fontSize: "14px",
                              }}
                            />

                            {/* render dropdown outside table via portal */}
                            {ln.suggestions &&
                              ln.suggestionType === "code" &&
                              ln.suggestions.length > 0 &&
                              renderDropdownPortal(
                                ln.suggestions.map((s) => (
                                  <div
                                    key={s._id || s.code}
                                    onMouseDown={() => selectSuggestionForLine(ln.id, s)}
                                    style={{
                                      padding: "8px 10px",
                                      cursor: "pointer",
                                      borderBottom: "1px solid #f0f0f0",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      transition: "background 0.2s",
                                    }}
                                    onMouseEnter={(e) =>
                                      (e.currentTarget.style.background = "#f5f5f5")
                                    }
                                    onMouseLeave={(e) =>
                                      (e.currentTarget.style.background = "#fff")
                                    }
                                  >
                                    <span style={{ fontWeight: 600 }}>{s.code}</span>
                                    <span
                                      style={{
                                        fontSize: "13px",
                                        color: "#777",
                                        marginLeft: "8px",
                                      }}
                                    >
                                      {s.name}
                                    </span>
                                  </div>
                                )),
                                `code-${ln.id}`
                              )}
                          </td>

                          {/* ✅ Product Name */}
                          <td>
                            <input
                              data-input-id={`name-${ln.id}`}
                              className="input"
                              value={ln.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateLineField(ln.id, "name", val);
                                if (!val.trim()) updateLineField(ln.id, "code", "");
                                showSuggestionsForLine(ln.id, "name", val);
                              }}
                              // onFocus={() => showSuggestionsForLine(ln.id, "name", ln.name)}
                              onBlur={() =>
                                setTimeout(() => {
                                  setOrderLines((prev) =>
                                    prev.map((r) =>
                                      r.id === ln.id ? { ...r, suggestions: [] } : r
                                    )
                                  );
                                  delete focusedFieldRef.current[ln.id];
                                }, 300)
                              }
                              placeholder="Enter product name"
                              style={{
                                width: "100%",
                                padding: "6px 10px",
                                border: "1px solid #ccc",
                                borderRadius: "6px",
                                fontSize: "14px",
                              }}
                            />

                            {/* render dropdown outside table via portal */}
                            {ln.suggestions &&
                              ln.suggestionType === "name" &&
                              ln.suggestions.length > 0 &&
                              renderDropdownPortal(
                                ln.suggestions.map((s) => (
                                  <div
                                    key={s._id || s.name}
                                    onMouseDown={() => selectSuggestionForLine(ln.id, s)}
                                    style={{
                                      padding: "8px 10px",
                                      cursor: "pointer",
                                      borderBottom: "1px solid #f0f0f0",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      transition: "background 0.2s",
                                    }}
                                    onMouseEnter={(e) =>
                                      (e.currentTarget.style.background = "#f5f5f5")
                                    }
                                    onMouseLeave={(e) =>
                                      (e.currentTarget.style.background = "#fff")
                                    }
                                  >
                                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                                    <span
                                      style={{
                                        fontSize: "13px",
                                        color: "#777",
                                        marginLeft: "8px",
                                      }}
                                    >
                                      {s.code}
                                    </span>
                                  </div>
                                )),
                                `name-${ln.id}`
                              )}
                          </td>

                          {/* Qty */}
                          <td>
                            <input
                              type="number"
                              className="input"
                              value={ln.qty || ""}
                              onChange={(e) => updateLineField(ln.id, "qty", e.target.value)}
                              min="0"
                            />
                          </td>

                          {/* Actions */}


                          <td className="flex gap-2" style={{ alignItems: "center" }}>
                            {ln.isNew ? (
                              <button className="btn small primary" onClick={() => finalizeRow(ln.id)} title="Confirm row">
                                <FaPlus />
                              </button>
                            ) : (
                              <>
                                {!ln.isEditing ? (
                                  <>
                                    <button className="btn small" onClick={() => startEditRow(ln.id)} title="Edit row"><FaEdit color="#F59E0B" /></button>
                                    <button className="btn small" onClick={() => removeRow(ln.id)} title="Delete row"><FaTrash color="#E53935" /></button>
                                  </>
                                ) : (
                                  <>
                                    <button className="btn small success" onClick={() => saveEditRow(ln.id)} title="Save"><FaCheck color="#fff" /></button>
                                    <button className="btn small danger" onClick={() => cancelEditRow(ln.id)} title="Cancel"><FaTimes color="#E53935" /></button>
                                  </>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="modal-footer">
              <button className="inline-flex items-center justify-center w-44 gap-2 px-4 py-2 
         rounded-lg 
    font-semibold
    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0     " onClick={confirmOrder}>
                <FaCheck /> {isEditingOrder ? "Update Status" : "Confirm Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- View Modal ---------- */}
      {viewOpen && selectedOrder && (
        <div className="modal wide">
          <div className="modal-content" style={{ maxWidth: "750px", padding: "1rem 1.5rem", alignItems: "center" }}>
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ddd", paddingBottom: "0.5rem" }}>
              <h2 style={{ flex: 1, textAlign: "center", margin: 0 }}>Order</h2>
              <button className="close" onClick={closeView}><FaTimes /></button>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                margin: "1rem 0",
                fontSize: "14px",
              }}
            >

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, marginRight: 6 }}>Order No:</span>
                  <span>{selectedOrder.orderNo}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 600, marginRight: 6 }}>Date:</span>
                  <span>{selectedOrder.date}</span>
                </div>
              </div>


              <div
                style={{
                  textAlign: "center",
                  fontWeight: 600,
                  color: statusColor(selectedOrder.status),
                }}
              >
                <span style={{ fontWeight: 600, marginRight: 6, color: "black" }}>Status :</span>
                {formatStatusText(selectedOrder.status)}
              </div>
            </div>


            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse table-auto text-left">
                <thead><tr><th>Product Code</th><th>Product Name</th><th>Qty</th></tr></thead>
                <tbody>
                  {selectedOrder.items?.map((it, i) => (
                    <tr key={i}>
                      <td>{it.code}</td>
                      <td>{it.name}</td>
                      <td>{it.qty}</td>
                    </tr>
                  )) || <tr><td colSpan="3" className="text-center p-4">No items</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
