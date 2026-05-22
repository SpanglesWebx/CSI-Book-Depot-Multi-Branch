// src/pages/AddCustomer.jsx
import { useState, useEffect, useMemo, useContext } from "react";
import axios from "axios";
import { FaPlus, FaEye, FaTimes, FaUserSlash, FaUserCheck } from "react-icons/fa";
import "../styles/addCustomer.css";
import { useAuth } from "../context/AuthContext";
import { ShopContext } from "../context/ShopContext";
import Pagination from "../components/Pagination";
import CustomerViewModal from "../components/CustomerViewModal";


const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ---------------- Safe Fetch Helper ---------------- */
async function safeFetchCustomers(url, headers = {}) {
  try {
    const res = await axios.get(url, { headers });
    if (Array.isArray(res.data)) return res.data;           // tenant API
    if (Array.isArray(res.data?.data)) return res.data.data;
    if (Array.isArray(res.data?.customers)) return res.data.customers;
    return [];
  } catch (err) {
    console.error("safeFetchCustomers failed:", err);
    return [];
  }
}

export default function AddCustomer({ shopname: propShopname }) {
  const { user } = useAuth();
  const { selectedShop } = useContext(ShopContext);

  const shopname = selectedShop?.shopname || propShopname || user?.shopname;
  const token = localStorage.getItem("token");

  const CUSTOMERS_API = `${API}/api/customers`;

  /* ---------- State ---------- */
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [form, setForm] = useState({ name: "", mobile: "", address: "" });


  /* ---------- State ---------- */
  const [status, setStatus] = useState(""); // active/inactive
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 50;

  // Saving state for Add Customer
  const [savingCustomer, setSavingCustomer] = useState(false);


  const [errors, setErrors] = useState({});
  const [activeField, setActiveField] = useState(null);

  /* ---------- Toast Helper ---------- */
  const pushToast = (msg) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };

  /* ---------- Utilities ---------- */
  const getId = (c) => c?._id ?? c?.id;
  const isActive = (c) => ((c.status ?? "active").toString().toLowerCase() !== "inactive");
  // const labelFromActive = (active) => (active ? "active" : "inactive");
  const labelFromActive = (active) => (active ? "ACTIVE" : "INACTIVE");

  const payloadForActive = (cust, nextActive) => ({ status: nextActive ? "active" : "inactive" });
  const pickUpdatedFromResponse = (resData) => resData?.data ?? resData?.customer ?? resData;

  const buildHeaders = () => {
    const h = { Authorization: `Bearer ${token}` };
    if (shopname) h["x-shopname"] = shopname;
    return h;
  };



  const fetchCustomers = async (p = 1) => {
  try {
    const params = {
      page: p,
      limit,
      search,
      status,
    };

    const headers = buildHeaders();

    const res = await axios.get(CUSTOMERS_API, { params, headers });

    const data = res.data || {};

    setCustomers(Array.isArray(data.customers) ? data.customers : []);
    setTotalPages(Number(data.totalPages || 1));
    setPage(p); // control page from UI
  } catch (err) {
    console.error("fetchCustomers failed:", err);
    pushToast("Failed to fetch customers");
  }
};

  // Trigger fetch on search/status change
  useEffect(() => {
    fetchCustomers(1);
  }, [search, status, shopname]);


  /* ---------- Filtered List ---------- */
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const mobile = (c.mobile ?? "").toLowerCase();
      return name.includes(s) || mobile.includes(s);
    });
  }, [search, customers]);


  /* -------------------------
   Prevent refresh while saving customer
------------------------- */
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (savingCustomer) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [savingCustomer]);


  /* ---------- Create Customer ---------- */
  const onCreate = async (e) => {
    e.preventDefault();
    if (savingCustomer) return;

    setSavingCustomer(true);
    try {
      const headers = buildHeaders();
      const res = await axios.post(CUSTOMERS_API, form, { headers });
      const created = pickUpdatedFromResponse(res.data);
      setCustomers((prev) => [created, ...prev]);
      pushToast(`Customer ${created?.name ?? ""} added`);
      setShowAddModal(false);
      setForm({ name: "", mobile: "", address: "" });
    } catch (err) {
      console.error("POST create failed:", err);
      pushToast(err?.response?.data?.message || "Failed to add customer");
    }
    finally {
      setSavingCustomer(false);
    }
  };

  /* ---------- Toggle Status ---------- */
  const toggleStatus = async (cust) => {
    const id = getId(cust);
    if (!id) return pushToast("Cannot update: missing id");

    const wasActive = isActive(cust);
    const nextActive = !wasActive;
    const optimistic = payloadForActive(cust, nextActive);

    // optimistic UI
    setCustomers((prev) =>
      prev.map((c) => (getId(c) === id ? { ...c, ...optimistic } : c))
    );

    try {
      const headers = buildHeaders();
      const url = `${CUSTOMERS_API}/${id}/status`;
      const res = await axios.patch(url, optimistic, { headers });
      const updated = pickUpdatedFromResponse(res.data);
      if (updated) {
        setCustomers((prev) =>
          prev.map((c) => (getId(c) === id ? { ...c, ...updated } : c))
        );
      }
      pushToast(`Customer ${cust.name} is now ${labelFromActive(nextActive)}`);
    } catch (err) {
      console.error("PATCH status failed:", err);
      // revert
      setCustomers((prev) =>
        prev.map((c) => (getId(c) === id ? { ...c, ...payloadForActive(c, wasActive) } : c))
      );
      pushToast("Failed to update status");
    }
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


  /* ---------- Render ---------- */
  return (
    <div className="customers-page pt-10 sm:pt-10">
      {/* Toasts */}
      <div className="toasts">{toasts.map((t) => <div key={t.id} className="toast">{t.msg}</div>)}</div>

      {/* Header */}
      <div className="customers-header">
        <h1 className="title">Customers</h1>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <FaPlus /> Add Customer
        </button>
      </div>

      {/* Toolbar */}


      {/* Toolbar */}
      <div className="flex flex-wrap items-center p-4 space-x-3 space-y-3 lg:space-y-0 lg:space-x-3
 ">
        {/* Left: Name / Mobile Search */}
        <div className="flex min-w-[200px] h-8">
          <input
            type="text"
            placeholder="Search by Name or Mobile"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="!w-[240px] !md:w-[250px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867] transition duration-200 placeholder-gray-400"
          />
        </div>

        {/* Right: Status Filter */}
        <div className="flex min-w-[120px] h-8">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full text-sm border rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] transition
             hover:bg-green-50 hover:border-green-400"
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
                      <td style={{ padding: "12px 10px", borderTop: "1px solid #e5e7eb" }}> {(page - 1) * limit + idx + 1}</td>
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
                            if (!active) return;
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
        // <Modal title="Add Customer" onClose={() => setShowAddModal(false)}>
        <Modal
          title="Add Customer"
          onClose={() => !savingCustomer && setShowAddModal(false)}
        >

          {/* <form onSubmit={onCreate} className="customer-form"> */}
          <form
            onSubmit={onCreate}
            className={`customer-form ${savingCustomer ? "pointer-events-none opacity-60" : ""
              }`}
          >

            {/* <div className="form-row">
              <RequiredLabel>Name</RequiredLabel>

              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div> */}


            <div className="form-row relative">
              <RequiredLabel>Name</RequiredLabel>

              <input
                className={`input pr-10 pb-5 ${errors.name ? "border-red-500" : ""}`}
                value={form.name}
                required
                onFocus={() => setActiveField("name")}
                onBlur={() => setActiveField(null)}
                onChange={(e) => {
                  const val = e.target.value;

                  if (validateMaxLength("name", val, 50)) {
                    setForm((f) => ({ ...f, name: val }));
                  }
                }}
              />

              <CharCounter
                value={form.name}
                max={50}
                show={activeField === "name"}
              />

              {errors.name && (
                <span className="text-red-600 text-xs mt-1">
                  {errors.name}
                </span>
              )}
            </div>

            <div className="form-row">
              <RequiredLabel>Mobile</RequiredLabel>

              <input
                className="input"
                value={form.mobile}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, ""); // Remove non-numeric characters
                  if (value.length > 10) value = value.slice(0, 10); // Limit to 10 digits
                  setForm(f => ({ ...f, mobile: value }));
                }}

                required
              />
            </div>

            {/* <div className="form-row">
              <label>Address</label>
              <textarea className="input textarea" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div> */}

            <div className="form-row relative">
              <label>Address</label>

              <textarea
                className={`input textarea pr-10 pb-5 ${errors.address ? "border-red-500" : ""}`}
                value={form.address}
                onFocus={() => setActiveField("address")}
                onBlur={() => setActiveField(null)}
                onChange={(e) => {
                  const val = e.target.value;

                  if (validateMaxLength("address", val, 150)) {
                    setForm((f) => ({ ...f, address: val }));
                  }
                }}
              />

              <CharCounter
                value={form.address}
                max={150}
                show={activeField === "address"}
              />

              {errors.address && (
                <span className="text-red-600 text-xs mt-1">
                  {errors.address}
                </span>
              )}
            </div>

            <div className="modal-actions">
              {/* <button type="submit" className="btn btn-primary">Add Customer</button> */}

              <button
                type="submit"
                disabled={savingCustomer}
                className="btn btn-primary flex items-center justify-center gap-2"
              >
                {savingCustomer && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                )}
                {savingCustomer ? "Adding..." : "Add Customer"}
              </button>

            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Small Components ---------------- */
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


const RequiredLabel = ({ children }) => (
  <label className="flex items-center gap-1 font-medium">
    <span>{children}</span>
    <span className="text-red-500">*</span>
  </label>
);
