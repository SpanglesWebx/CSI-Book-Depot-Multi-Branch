

// src/pages/purchase/supplier.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  FaArrowLeft,
  FaPlus,
  FaEye,
  FaEdit,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Pagination from "../../components/Pagination";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../utils/apiClient";
import { getApiUrl } from "../../utils/api";

export default function SupplierPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Manager/megaadmin selector
  const [selectedShop, setSelectedShop] = useState("");



  // --- Always tenant API ---
  const getApiPath = (endpoint) => {
    const ep = endpoint.replace(/^\//, "");
    return getApiUrl(ep);   // ALWAYS /api/suppliers
  };


  // Pagination
  const limit = 25;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  // Data
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [showView, setShowView] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Saving state for Add/Edit
  const [savingSupplier, setSavingSupplier] = useState(false);


  const emptyForm = {
    supplierId: "",
    name: "",
    mobile: "",
    gstin: "",
    address: "",
    status: "active",
  };
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const mountedRef = useRef(true);
  useEffect(() => () => (mountedRef.current = false), []);

  // -------------------------
  // Fetch suppliers — NO loading state, instant UI
  // -------------------------
  const fetchSuppliers = async (p = 1, q = search, st = status) => {
    try {
      const base = getApiPath("suppliers");

      const params = new URLSearchParams();
      params.append("limit", limit);
      params.append("page", p);
      params.append("status", st);
      if (q.trim()) params.append("search", q.trim());

      const url = `${base}?${params.toString()}`;

      const res = await apiClient.get(url);
      const data = res.data;

      let list = Array.isArray(data.suppliers) ? data.suppliers : [];

      // ⭐️ SORT: ACTIVE FIRST — INACTIVE BELOW  
      list = list.sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (a.status !== "active" && b.status === "active") return 1;
        return 0;
      });

      // Set data
      setSuppliers(list);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
     

    } catch (err) {
      console.error("Fetch suppliers error:", err);
      setSuppliers([]);
      setTotal(0);
      setTotalPages(1);
    }
  };









  useEffect(() => {
  if (!user) return;

  fetchSuppliers(page, search, status);

}, [page, search, status, user]);





  const handlePageChange = (p) => {
  if (p === page) return;
  setPage(p);
};

  const refresh = () => fetchSuppliers(page, search, status);

  useEffect(() => {
    console.log("USER:", user);
    console.log("SHOP:", selectedShop);
    console.log("API PATH:", getApiPath("suppliers"));
  }, [user, selectedShop]);


  // -------------------------
  // Add supplier (fetch next ID)
  // -------------------------
  const openAdd = async () => {
    setErrors({});
    setForm(emptyForm);

    try {
      const base = getApiPath("suppliers/next-supplier-id");
      const res = await apiClient.get(base);
      const id = res?.data?.nextSupplierId || "";

      setForm((f) => ({ ...emptyForm, supplierId: id }));
    } catch (err) {
      console.error("Failed to get next supplier id", err);
    }

    setShowAdd(true);
  };

  // -------------------------
  // Create supplier
  // -------------------------
  const validate = (f) => {
    const e = {};
    if (!f.name.trim()) e.name = "Name is required";
    if (!/^\d{10}$/.test(f.mobile)) e.mobile = "Mobile must be 10 digits";
    if (!f.gstin?.trim()) e.gstin = "GSTIN is required";
    return e;
  };

  /* -------------------------
   Prevent refresh while saving supplier
------------------------- */
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (savingSupplier) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [savingSupplier]);


  const createSupplier = async () => {
    if (savingSupplier) return;
    const e = validate(form);
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    setSavingSupplier(true);

    try {
      const base = getApiPath("suppliers");

      const payload = {
        supplierId: form.supplierId,
        name: form.name,
        mobile: form.mobile,
        gstin: form.gstin,
        address: form.address,
      };

      await apiClient.post(base, payload);

      setShowAdd(false);
      refresh();
    } catch (err) {
      console.error("Create supplier failed", err);
      alert(err?.response?.data?.message || "Failed to create supplier");
    } finally {
      setSavingSupplier(false);
    }


  };

  // -------------------------
  // View
  // -------------------------
  const openView = async (id) => {
    try {
      const base = getApiPath(`suppliers/${id}`);
      const res = await apiClient.get(base);
      setSelectedSupplier(res.data);
      setShowView(true);
    } catch (err) {
      alert("Failed to load supplier");
    }
  };

  // -------------------------
  // Edit
  // -------------------------
  const openEdit = async (id) => {
    try {
      const base = getApiPath(`suppliers/${id}`);
      const res = await apiClient.get(base);
      const d = res.data;

      setSelectedSupplier(d);
      setErrors({});
      setForm({
        supplierId: d.supplierId,
        name: d.name,
        mobile: d.mobile,
        gstin: d.gstin,
        address: d.address,
        status: d.status,
      });

      setShowEdit(true);
    } catch (err) {
      alert("Failed to load supplier");
    }
  };

  const updateSupplier = async () => {

    if (savingSupplier) return;
    if (!selectedSupplier) return;

    const e = validate(form);
    if (Object.keys(e).length) return setErrors(e);

    setSavingSupplier(true);

    try {
      const base = getApiPath(`suppliers/${selectedSupplier._id}`);

      const payload = {
        name: form.name,
        mobile: form.mobile,
        gstin: form.gstin,
        address: form.address,
        status: form.status,
      };

      await apiClient.patch(base, payload);

      setShowEdit(false);
      setSelectedSupplier(null);
      refresh();
    } catch (err) {
      alert("Failed to update supplier");
    }
    finally {
      setSavingSupplier(false);
    }
  };

  // -------------------------
  // UI helpers
  // -------------------------
  const statusBadge = (s) =>
    s === "active" ? (
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold uppercase text-[#006b43] bg-[#c8fad6]">
        <FaCheckCircle /> Active
      </div>
    ) : (
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold uppercase text-[#a11] bg-[#ffeaea]">
        <FaTimesCircle /> Inactive
      </div>
    );

  // table classes
  const tableWrapperClass = "w-full table-responsive bg-transparent rounded-md";
  const tableClass =
    "w-full border-separate border-spacing-0 min-w-0 table-auto";
  const theadThClass =
    "px-3 py-3 border-t border-[#e5e7eb] text-left text-sm text-[#222] sticky top-0 z-20 bg-[#f3f4f6]";
  const tbodyTdClass =
    "px-3 py-3 border-t border-[#e5e7eb] text-sm text-[#222] align-middle whitespace-nowrap";
  const hoverRowClass =
    "hover:bg-[#c8fad6]/40 transition-colors duration-150";



  const tdStyle = {
    padding: "12px 10px",
    borderTop: "1px solid #e5e7eb",
    color: "#222",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  };

  const iconButton = {
    padding: "6px",
    borderRadius: "6px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };






  return (
    <div className="sm:p-8  p-8 pt-10 sm:pt-10">
      {/* Back */}
      <div className="mb-4">
        <button
          onClick={() => navigate("/stock/purchase")}
          className="inline-flex items-center gap-2 text-sm text-[#00A76F] hover:underline"
        >
          <FaArrowLeft /> Back
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[28px] font-bold text-[#00A76F]">Supplier</h1>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2
                rounded-lg 
    font-semibold
    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0 "
        >
          <FaPlus /> Add Supplier
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search ID, Name, Mobile, GSTIN No"
          className="!w-[250px] !md:w-[350px] h-8 text-sm border border-gray-300 rounded-md px-2 
               focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867]
               placeholder-gray-400 transition"
        />

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-40 h-8 rounded border border-[#e5e7eb] px-3 focus:ring-2 focus:ring-[#00A76F]"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
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
                {["S.No", "Supplier ID", "Supplier Name", "Mobile", "GSTIN No", "Status", "Action"].map(
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
                        textAlign: i === 6 ? "center" : "left",
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      color: "#6b7280",
                      fontSize: "14px",
                    }}
                  >
                    No suppliers found.
                  </td>
                </tr>
              ) : (
                suppliers.map((s, idx) => (
                  <tr
                    key={s._id}
                    style={{
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#c8fad6")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={tdStyle}>{(page - 1) * limit + idx + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{s.supplierId}</td>
                    <td style={tdStyle}>{s.name}</td>
                    <td style={tdStyle}>{s.mobile}</td>
                    <td style={tdStyle}>{s.gstin || "-"}</td>

                    {/* Status Badge */}
                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 10px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          color: s.status === "active" ? "#006b43" : "#a11",
                          // background: s.status === "active" ? "#c8fad6" : "#ffeaea",
                        }}
                      >
                        {s.status === "active" ? <FaCheckCircle /> : <FaTimesCircle />}
                        {s.status}
                      </div>
                    </td>


                    {/* Action Buttons */}
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: "8px" }}>

                        {/* View Button */}
                        <button
                          onClick={() => openView(s._id)}
                          title="View"
                          style={{
                            border: "none",
                            backgroundColor: "#00A76F",
                            color: "#fff",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.5rem",
                            cursor: "pointer",
                            marginRight: "0.5rem",
                          }}
                        >
                          <FaEye title="View" />
                        </button>

                        {/* Edit Button (only when active) */}
                        {s.status === "active" && (
                          <button
                            onClick={() => openEdit(s._id)}
                            title="Edit"
                            style={{
                              border: "none",
                              backgroundColor: "#f59e0b",
                              color: "#fff",
                              padding: "0.5rem 0.75rem",
                              borderRadius: "0.5rem",
                              cursor: "pointer",
                              marginRight: "0.5rem",
                            }}
                          >
                            <FaEdit title="Edit" />
                          </button>
                        )}

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
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Add Modal */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <AddEditForm
            mode="add"
            form={form}
            errors={errors}
            setForm={setForm}
            setErrors={setErrors}
            submit={createSupplier}
            close={() => setShowAdd(false)}
            saving={savingSupplier}
          />
        </Modal>
      )}

      {/* View Modal */}
      {showView && selectedSupplier && (
        <Modal onClose={() => setShowView(false)}>
          <ViewSupplier supplier={selectedSupplier} close={() => setShowView(false)} />
        </Modal>
      )}

      {/* Edit Modal */}
      {showEdit && selectedSupplier && (
        <Modal onClose={() => setShowEdit(false)}>
          <AddEditForm
            mode="edit"
            form={form}
            errors={errors}
            setForm={setForm}
            setErrors={setErrors}
            submit={updateSupplier}
            close={() => setShowEdit(false)}
            saving={savingSupplier}
          />
        </Modal>
      )}
    </div>
  );
}

/* ----------------------------
   MODALS
----------------------------- */
function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg p-6 z-10 w-full max-w-2xl animate-[fadeIn_.15s_ease]">
        {children}
      </div>
    </div>
  );
}

/* ----------------------------
   VIEW MODAL
----------------------------- */






function ViewSupplier({ supplier, close }) {
  const ref = useRef(null);

  // Simple fade-in animation
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

  /* ----- STYLES ----- */
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

  const table = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "1rem",
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
  };

  const footer = {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "26px",
  };

  const closeButton = {
    padding: "10px 22px",
    borderRadius: "8px",
    background: "#f1f1f1",
    border: "1px solid #d3d3d3",
    cursor: "pointer",
    fontSize: "0.95rem",
  };

  return (
    <div ref={ref} style={container}>
      {/* Header */}
      <div style={headerRow}>
        <h2 style={title}>Supplier Details</h2>
        <button style={closeBtn} onClick={close}>✕</button>
      </div>

      {/* Key-Value Rows */}
      <div>
        <div style={row}>
          <span style={keyStyle}>Supplier ID</span>
          <span style={valueStyle}>{supplier.supplierId}</span>
        </div>
        <div style={row}>
          <span style={keyStyle}>Name</span>
          <span style={valueStyle}>{supplier.name}</span>
        </div>
        <div style={row}>
          <span style={keyStyle}>Mobile</span>
          <span style={valueStyle}>{supplier.mobile}</span>
        </div>
        <div style={row}>
          <span style={keyStyle}>GSTIN</span>
          <span style={valueStyle}>{supplier.gstin || "-"}</span>
        </div>
        <div style={row}>
          <span style={keyStyle}>Address</span>
          <span style={valueStyle}>{supplier.address || "-"}</span>
        </div>
        <div style={row}>
          <span style={keyStyle}>Status</span>

          <span
            style={{
              ...valueStyle,
              color: supplier.status?.toLowerCase() === "active" ? "#16a34a" : "#dc2626",
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {supplier.status ? supplier.status.toLowerCase() : "-"}
          </span>
        </div>

      </div>


    </div>
  );
}


function AddEditForm({ mode, form, setForm, errors, setErrors, submit, close, saving }) {
  const containerRef = useRef(null);

  // Animation on mount
  useEffect(() => {
    const el = containerRef.current;
    el.classList.add("opacity-0", "translate-y-3");
    requestAnimationFrame(() => {
      el.classList.remove("opacity-0", "translate-y-3");
      el.classList.add("opacity-100", "translate-y-0");
    });
  }, []);

  // Mobile input → only numbers, max 10 digits
  const handleMobileChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 10) value = value.slice(0, 10);
    setForm((f) => ({ ...f, mobile: value }));
  };

  return (
    <div
      ref={containerRef}
      className={`w-full transition-all duration-300 ease-out
    ${saving ? "pointer-events-none opacity-60" : ""}
  `}
    >

      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">
          {mode === "add" ? "Add Supplier" : "Edit Supplier"}
        </h2>
        <button
          onClick={close}
          className="text-gray-500 hover:text-gray-700 text-xl transition"
        >
          ✕
        </button>
      </div>

      {/* FORM */}
      <div className="space-y-4">

        {/* Supplier ID */}
        <div>



          <RequiredLabel> Supplier ID</RequiredLabel>
          <input
            value={form.supplierId}
            className="w-full h-11 rounded-lg border px-3 bg-gray-100 text-gray-600"
            readOnly
          />
        </div>

        {/* Name */}
        <div>
          {/* <label className="block text-sm font-medium mb-1 text-gray-700">
            Name
          </label> */}
          <RequiredLabel>Name</RequiredLabel>

          <input
            value={form.name}
            onChange={(e) =>
              setForm((f) => ({ ...f, name: e.target.value }))
            }
            className="w-full h-11 rounded-lg border px-3 focus:ring-2 focus:ring-green-400 outline-none"
          />
          {errors.name && (
            <div className="text-red-600 text-sm mt-1">{errors.name}</div>
          )}
        </div>

        {/* Mobile */}
        <div>
          <RequiredLabel>Mobile</RequiredLabel>

          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={form.mobile}
            onChange={handleMobileChange}
            className="w-full h-11 rounded-lg border px-3 focus:ring-2 focus:ring-green-400 outline-none"

          />
          {errors.mobile && (
            <div className="text-red-600 text-sm mt-1">{errors.mobile}</div>
          )}
        </div>

        {/* GSTIN */}
        <div>
          <RequiredLabel>GSTIN No</RequiredLabel>
          <input
            value={form.gstin}
            onChange={(e) =>
              setForm((f) => ({ ...f, gstin: e.target.value }))
            }
            className="w-full h-11 rounded-lg border px-3 focus:ring-2 focus:ring-green-400 outline-none"
          />
          {errors.gstin && (
            <div className="text-red-600 text-sm mt-1">{errors.gstin}</div>
          )}

        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Address
          </label>
          <textarea
            value={form.address}
            onChange={(e) =>
              setForm((f) => ({ ...f, address: e.target.value }))
            }
            className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-green-400 outline-none"
            rows={3}
          />
        </div>

        {/* Status (only in edit mode) */}
        {mode === "edit" && (
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value }))
              }
              className="w-full h-11 rounded-lg border px-3 focus:ring-2 focus:ring-green-400 outline-none"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        )}

        {/* BUTTONS */}
        <div className="flex justify-end gap-3 pt-4">


          {/* <button
            onClick={submit}
            className="px-4 py-2 
                     rounded-lg 
    font-semibold
    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0     
            
            "
          >
            {mode === "add" ? "Add Supplier" : "Save"}
          </button> */}
        
        
        
        <button
  onClick={submit}
  disabled={saving}
  className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2
    text-[#007867] bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0
    ${saving ? "opacity-60 cursor-not-allowed" : ""}
  `}
>
  {saving && (
    <span className="w-4 h-4 border-2 border-[#007867] border-t-transparent rounded-full animate-spin"></span>
  )}
  {mode === "add" ? "Add Supplier" : "Save"}
</button>

        
        
        </div>
      </div>
    </div>
  );
}



const RequiredLabel = ({ children }) => (
  <label className="block text-sm font-medium mb-1 text-gray-700">
    {children}
    <span className="text-red-500 ml-0.5">*</span>
  </label>
);




