
// src/pages/master/sidebar/MasterAddCustomer.jsx
import { useState, useEffect, useMemo, useContext } from "react";
import axios from "axios";
import { FaPlus, FaEye, FaTimes, FaUserSlash, FaUserCheck } from "react-icons/fa";
import "../../../styles/addCustomer.css";
import { useAuth } from "../../../context/AuthContext";
import { ShopContext } from "../../../context/ShopContext";
import Pagination from "../../../components/Pagination";
import CustomerViewModal from "../../../components/CustomerViewModal";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function MasterAddCustomer() {
  const { selectedShop } = useContext(ShopContext);
  const { user } = useAuth(); // master user
  const shopId = selectedShop?._id;

  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [form, setForm] = useState({ name: "", mobile: "", address: "" });

  /* ---------- State ---------- */
  const [status, setStatus] = useState(""); // active/inactive
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);;


  /* ---------- Toast helper ---------- */
  const pushToast = (msg) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500);
  };

  /* ---------- Headers for master access ---------- */
  const buildHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      Authorization: token ? `Bearer ${token}` : "",
      "x-shop-id": shopId || "",
      "x-shop-name": selectedShop?.shopname ? encodeURIComponent(selectedShop.shopname) : "",
    };
  };

  /* ---------- API URL ---------- */
  const CUSTOMERS_API = shopId
    ? `${API}/api/tenant/shops/${encodeURIComponent(selectedShop.shopname)}/customers`
    : null;

  /* ---------- Fetch Customers ---------- */
  const fetchCustomers = async (p = 1) => {
    if (!CUSTOMERS_API) return;
    try {
      const { data } = await axios.get(CUSTOMERS_API, {
        headers: buildHeaders(),
        params: { page: p, limit: 25, search, status },
      });
      setCustomers(data.customers || []);
      setTotalPages(data.totalPages || 1);
      setPage(p);
    } catch (err) {
      console.error("fetchCustomers:", err);
      pushToast(err?.response?.data?.message || "Failed to fetch customers");
    }
  };

  useEffect(() => {
    if (shopId) fetchCustomers(1);
  }, [shopId, search, status]);


  /* ---------- Helpers ---------- */
  const getId = (c) => c?._id ?? c?.id;
  const isActive = (c) => {
    if ("isActive" in c) return !!c.isActive;
    const s = (c.status ?? "active").toLowerCase();
    return s !== "inactive";
  };
  // const labelFromActive = (active) => (active ? "active" : "inactive");
  const labelFromActive = (active) => (active ? "ACTIVE" : "INACTIVE");

  const payloadForActive = (cust, nextActive) => ({
    status: nextActive ? "active" : "inactive",
  });

  const pickUpdatedFromResponse = (resData) => resData?.data ?? resData?.customer ?? resData;

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const mobile = (c.mobile ?? "").toLowerCase();
      return name.includes(s) || mobile.includes(s);
    });
  }, [search, customers]);

  /* ---------- Create Customer ---------- */
  const onCreate = async (e) => {
    e.preventDefault();
    if (!CUSTOMERS_API) return pushToast("No shop selected");

    try {
      const res = await axios.post(CUSTOMERS_API, form, { headers: buildHeaders() });
      const created = pickUpdatedFromResponse(res.data);
      setCustomers((prev) => [created, ...prev]);
      pushToast(`Customer ${created?.name ?? ""} added`);
      setForm({ name: "", mobile: "", address: "" });
      setShowAddModal(false);
    } catch (err) {
      console.error("POST create failed:", err);
      pushToast(err?.response?.data?.message || "Failed to add customer");
    }
  };

  /* ---------- Toggle Status ---------- */
  const toggleStatus = async (cust) => {
    const id = getId(cust);
    if (!id) return pushToast("Cannot update: missing id");

    const nextActive = !isActive(cust);

    // Optimistic UI
    setCustomers((prev) =>
      prev.map((c) =>
        getId(c) === id
          ? { ...c, status: nextActive ? "active" : "inactive" }
          : c
      )
    );

    try {
      const url = `${CUSTOMERS_API}/${id}/status`;
      const res = await axios.patch(url, payloadForActive(cust, nextActive), { headers: buildHeaders() });
      const updated = pickUpdatedFromResponse(res.data);
      if (updated) {
        setCustomers((prev) =>
          prev.map((c) => (getId(c) === id ? { ...c, ...updated } : c))
        );
      }
      pushToast(`Customer ${cust.name} is now ${labelFromActive(nextActive)}`);
    } catch (err) {
      console.error("Update status failed:", err);
      // Revert UI
      setCustomers((prev) =>
        prev.map((c) =>
          getId(c) === id ? { ...c, status: isActive(cust) ? "active" : "inactive" } : c
        )
      );
      pushToast(err?.response?.data?.message || "Failed to update status");
    }
  };

  /* ---------- Render ---------- */
  return (
    <div className="customers-page p-8 pt-10 sm:pt-10">
      {/* Toasts */}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.msg}</div>
        ))}
      </div>

      {/* Header */}
      <div className="customers-header">
        <h1 className="title">Customers</h1>

      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center p-4 space-x-3 space-y-3 lg:space-y-0 lg:space-x-3">
        {/* Left: Name / Mobile Search */}
        <div className="flex min-w-[330px] h-8">
          <input
            type="text"
            placeholder="Search by Customer Name or Mobile No"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm border rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] transition placeholder-gray-400"
          />
        </div>

        {/* Right: Status Filter */}
        <div className="flex min-w-[80px] h-8">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full text-sm border rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] transition"
          >
            <option value="">ALL STATUS</option>
            <option value="active">ACTIVE</option>
            <option value="inactive">INACTIVE</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card table-card shadow-lg rounded-lg bg-white p-4">
        <div className="w-full">
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: "600px" }}>
            <thead style={{ background: "#f3f4f6" }}>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 10px", fontWeight: "700", borderBottom: "1px solid #e5e7eb" }}>S.No</th>
                <th style={{ textAlign: "left", padding: "12px 10px", fontWeight: "700", borderBottom: "1px solid #e5e7eb" }}>Name</th>
                <th style={{ textAlign: "left", padding: "12px 10px", fontWeight: "700", borderBottom: "1px solid #e5e7eb" }}>Mobile</th>
                <th style={{ textAlign: "left", padding: "12px 10px", fontWeight: "700", borderBottom: "1px solid #e5e7eb" }}>Status</th>
                <th style={{ textAlign: "center", padding: "12px 10px", fontWeight: "700", borderBottom: "1px solid #e5e7eb" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: "12px 10px", color: "#6b7280" }}>No customers found</td>
                </tr>
              ) : (
                filtered.map((c, idx) => {
                  const active = isActive(c);
                  return (
                    <tr key={getId(c)} style={{ transition: "background 0.2s" }} className="hover:bg-green-100">
                      <td style={{ padding: "12px 10px", borderTop: "1px solid #e5e7eb" }}>{(page - 1) * 25 + idx + 1}</td>
                      <td style={{ padding: "12px 10px", borderTop: "1px solid #e5e7eb" }}>{c.name}</td>
                      <td style={{ padding: "12px 10px", borderTop: "1px solid #e5e7eb" }}>{c.mobile}</td>
                      <td style={{ padding: "12px 10px", borderTop: "1px solid #e5e7eb", fontWeight: "600", color: active ? "#16a34a" : "#dc2626" }}>
                        {labelFromActive(active)}
                      </td>
                      <td style={{ padding: "12px 10px", borderTop: "1px solid #e5e7eb", textAlign: "center", display: "flex", justifyContent: "center", gap: "6px" }}>

                        {/* View Button - Green */}
                        <button
                          onClick={() => setShowViewModal(c)}
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
                          onMouseEnter={(e) => (e.target.style.backgroundColor = "#007867")}
                          onMouseLeave={(e) => (e.target.style.backgroundColor = "#00A76F")}
                        >
                          <FaEye />
                        </button>

                        {/* Status Toggle Button */}
                        <button
                          onClick={() => {
                            // if (!active) return; 
                            toggleStatus(c)
                          }}
                          title={active ? "Deactivate" : "Activate"}
                          style={{
                            border: "none",
                            backgroundColor: active ? "#FEE2E2" : "#DCFCE7",
                            color: active ? "#DC2626" : "#16A34A",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.5rem",
                            cursor: "pointer",
                            transition: "all 0.3s ease",
                          }}
                          onMouseEnter={(e) =>
                            (e.target.style.backgroundColor = active ? "#FECACA" : "#BBF7D0")
                          }
                          onMouseLeave={(e) =>
                            (e.target.style.backgroundColor = active ? "#FEE2E2" : "#DCFCE7")
                          }
                        >
                          {active ? <FaUserSlash /> : <FaUserCheck />}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(p) => {
              if (p === page) return;
              fetchCustomers(p);
            }}
          />
        </div>
      </div>



      {/* View Modal */}
      {showViewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <CustomerViewModal
            customer={showViewModal}
            onClose={() => setShowViewModal(null)}
          />
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <Modal title="Add Customer" onClose={() => setShowAddModal(false)}>
          <form onSubmit={onCreate} className="customer-form">
            <div className="form-row">
              <label>Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>


            <div className="form-row">
              <label>Mobile</label>
              <input
                className="input"
                value={form.mobile}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, ""); // remove non-numeric
                  if (value.length > 10) value = value.slice(0, 10); // limit to 10 digits
                  setForm(f => ({ ...f, mobile: value }));
                }}
                required
              />
            </div>

            <div className="form-row">
              <label>Address</label>
              <textarea className="input textarea" value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-muted" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add Customer</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Small Components ---------- */
function Detail({ label, value }) {
  return (
    <div className="detail">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{String(value ?? "-")}</span>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-close" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
