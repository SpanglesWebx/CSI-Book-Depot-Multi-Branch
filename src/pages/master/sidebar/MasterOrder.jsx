// src/pages/master/sidebar/MasterOrders.jsx
import { useEffect, useState, useContext } from "react";
import axios from "axios";
import { FaEye, FaTimes } from "react-icons/fa";
import "../../../styles/Sidebar/Orders.css";
import { useAuth } from "../../../context/AuthContext";
import { ShopContext } from "../../../context/ShopContext";
import Pagination from "../../../components/Pagination";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function MasterOrders() {
  const { user } = useAuth();
  const { selectedShop } = useContext(ShopContext);

  const shopId = selectedShop?._id;
  const shopName = selectedShop?.shopname;
  const token = localStorage.getItem("token");
  const role = user?.role;

  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [searchOrderNo, setSearchOrderNo] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const pushToast = (msg) => {
    alert(msg);
  };

  const buildHeaders = () => ({
    Authorization: token ? `Bearer ${token}` : "",
    "x-shop-id": shopId || "",
    "x-shop-name": shopName ? encodeURIComponent(shopName) : "",
  });

  const encodedShopname = shopName ? encodeURIComponent(shopName) : null;

  const ORDERS_API =
    role === "user"
      ? `${API_BASE}/api/orders`
      : encodedShopname
        ? `${API_BASE}/api/tenant/shops/${encodedShopname}/orders`
        : null;

  // ---------------- Debounce search ----------------
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchOrderNo), 400);
    return () => clearTimeout(handler);
  }, [searchOrderNo]);

  // ---------------- Fetch Orders ----------------
  const fetchOrders = async (pageNumber = 1) => {
    if (!ORDERS_API) return;
    setLoading(true);

    try {
      const params = {
        page: pageNumber,
        limit,
        orderNo: debouncedSearch || undefined,      // send to backend
        productName: debouncedSearch || undefined,  // send to backend
        status: searchStatus || undefined,
        startDate: dateRange.start || undefined,
        endDate: dateRange.end || undefined,
      };

      const { data } = await axios.get(ORDERS_API, {
        headers: buildHeaders(),
        params,
      });

      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setPage(data.page || pageNumber);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("fetchOrders:", err);
      setOrders([]);
      setTotalPages(1);
      pushToast(err?.response?.data?.message || "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Trigger fetch when filters change ----------------
  useEffect(() => {
    if (shopId) fetchOrders(1);
  }, [debouncedSearch, searchStatus, dateRange.start, dateRange.end, shopId, ORDERS_API]);

  const orderTotalQty = (order) =>
    (order.items || []).reduce((s, it) => s + Number(it.qty || 0), 0);

  const statusColor = (status) => {
    switch ((status || "").toLowerCase()) {
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

  const formatStatusText = (status) =>
    status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "";

  const openView = async (order) => {
    if (!ORDERS_API) return pushToast("No API available for this shop");
    try {
      const res = await axios.get(`${ORDERS_API}/${order._id}`, { headers: buildHeaders() });
      const fullOrder = res.data.order || res.data;
      if (!fullOrder.items) fullOrder.items = [];
      setSelectedOrder(fullOrder);
      setViewOpen(true);
    } catch (err) {
      console.error("openView:", err);
      pushToast("Failed to load order details");
    }
  };

  const closeView = () => {
    setSelectedOrder(null);
    setViewOpen(false);
  };

  return (
    <div className="order-page p-6 pt-10 sm:pt-10">
      {/* Header */}
      <div className="orders-header">
        <h2>Orders</h2>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 items-center flex-wrap">
        {/* Search */}
        <input
          type="text"
          placeholder="Search by Order No or Product Name"
          value={searchOrderNo}
          onChange={(e) => setSearchOrderNo(e.target.value)}
          className="flex p-2 border border-gray-300 rounded text-sm"
          style={{ minWidth: "120px", maxWidth: "300px" }}
        />

        {/* Status */}
        <select
          value={searchStatus}
          onChange={(e) => setSearchStatus(e.target.value)}
          className="p-2 border border-gray-300 rounded text-sm"
          style={{ minWidth: "100px", maxWidth: "120px" }}
        >
          <option value="">All Status</option>
          <option value="placed">Placed</option>
          <option value="received">Received</option>
          {/* <option value="completed">Completed</option> */}
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Date */}
        <select
          onChange={(e) => {
            const type = e.target.value;
            if (!type) {
              setDateRange({ start: "", end: "" });
            } else {
              const today = new Date();
              let start, end;
              if (type === "today") start = end = today;
              if (type === "week") {
                start = new Date(today);
                start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
                end = today;
              }
              if (type === "month") {
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = today;
              }
              setDateRange({
                start: start.toISOString().slice(0, 10),
                end: end.toISOString().slice(0, 10),
              });
            }
          }}
          className="p-2 border border-gray-300 rounded text-sm"
          style={{ minWidth: "100px", maxWidth: "120px" }}
        >
          <option value="">All Dates</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {/* ---------- Orders Table ---------- */}
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
              <th>Status Date</th> {/* ✅ NEW COLUMN */}
              <th className="text-center">Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="text-center p-4 text-muted">
                  Loading...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center p-4 text-muted">
                  No orders found
                </td>
              </tr>
            ) : (
              orders.map((o, i) => {
                const firstName = (o.items && o.items[0]?.name) || "-";

                // ✅ Determine updated date based on status
                let updatedDate = "-";
                if (o.status === "received" || o.status === "completed") {
                  updatedDate =
                    o.confirmedDate ||
                    (o.updatedAt
                      ? o.updatedAt.slice(0, 10).split("-").reverse().join("/")
                      : "-");
                } else if (o.status === "cancelled") {
                  updatedDate =
                    o.cancelledDate ||
                    (o.updatedAt
                      ? o.updatedAt.slice(0, 10).split("-").reverse().join("/")
                      : "-");
                } else if (o.status === "placed") {
                  updatedDate = o.date || "-";
                }

                return (
                  <tr key={o._id || o.orderNo || i} className="hover:bg-[#fafafa] transition">
                    <td>{(page - 1) * limit + i + 1}</td>
                    <td>{o.orderNo}</td>
                    <td>{o.date}</td>
                    <td>
                      {firstName}
                      {o.items?.length > 1 ? ` (+${o.items.length - 1})` : ""}
                    </td>
                    <td>{orderTotalQty(o)}</td>
                    <td style={{ color: statusColor(o.status), fontWeight: 600 }}>
                      {formatStatusText(o.status)}
                    </td>
                    <td style={{ color: "#555" }}>{updatedDate}</td> {/* ✅ show date */}

                    {/* === Action Buttons === */}
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
                        }}
                        onMouseEnter={(e) =>
                          (e.target.style.backgroundColor = "#007867")
                        }
                        onMouseLeave={(e) =>
                          (e.target.style.backgroundColor = "#00A76F")
                        }
                      >
                        <FaEye />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <Pagination page={page} totalPages={totalPages} onPageChange={fetchOrders} />
      </div>

      {/* ---------- View Modal ---------- */}
      {viewOpen && selectedOrder && (
        <div className="modal wide">
          <div
            className="modal-content"
            style={{
              maxWidth: "750px",
              padding: "1rem 1.5rem",
              alignItems: "center",
            }}
          >
            {/* Header */}
            <div
              className="modal-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #ddd",
                paddingBottom: "0.5rem",
              }}
            >
              <h2 style={{ flex: 1, textAlign: "center", margin: 0 }}>Order</h2>
              <button className="close" onClick={closeView}>
                <FaTimes />
              </button>
            </div>

            {/* Top Info Section */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                width: "100%",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "1.5rem",
                  margin: "1.5rem 0",
                  alignItems: "center",
                  width: "80%",
                  maxWidth: "600px",
                }}
              >
                {/* Left Column */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <p style={{ fontWeight: 600, minWidth: "130px" }}>
                      Order No:
                    </p>
                    <p>{selectedOrder.orderNo}</p>
                  </div>
                </div>

                {/* Right Column */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <p style={{ fontWeight: 600, minWidth: "130px" }}>Date:</p>
                    <p>{selectedOrder.date}</p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <p style={{ fontWeight: 600, minWidth: "130px" }}>
                      Status:
                    </p>
                    <p
                      style={{
                        color: statusColor(selectedOrder.status),
                      }}
                    >
                      {formatStatusText(selectedOrder.status)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse table-auto text-left">
                <thead>
                  <tr>
                    <th>Product Code</th>
                    <th>Product Name</th>
                    <th>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((it, i) => (
                    <tr key={i}>
                      <td>{it.code}</td>
                      <td>{it.name}</td>
                      <td>{it.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

