// src/pages/Sidebar/Shop.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaPlus, FaEye, FaSyncAlt, FaTimes, FaEdit } from "react-icons/fa";
import "../../styles/Sidebar/Shop.css";
import Pagination from "../../components/Pagination";
import { useShop } from "../../context/ShopContext";

import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function ShopPage() {
  const token = localStorage.getItem("token");
  const { setSelectedShop } = useShop(); // added context usage
  const [counters, setCounters] = useState("1");

  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [showView, setShowView] = useState(false);
  const [viewShop, setViewShop] = useState(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const pageSize = 25;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [designation, setDesignation] = useState("")

  const [filteredShops, setFilteredShops] = useState(shops);

  const [errors, setErrors] = useState({});
  const [activeField, setActiveField] = useState(null);
  const [saving, setSaving] = useState(false);



  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    shopname: "",
    contact: "",
    address: "",
    counters: "1",
    status: "active",
  });
  const [editTargetId, setEditTargetId] = useState(null);


  const navigate = useNavigate();

  const openEditModal = (shop) => {
    setEditTargetId(shop._id);
    setEditForm({
      shopname: shop.shopname,
      contact: shop.contact,
      address: shop.address,
      counters: String(shop.counters),
      status: shop.status,
    });
    setShowEdit(true);
  };


  // Form
  const [form, setForm] = useState({
    shopname: "",
    designation: "",
    address: "",
    contact: "",
  });

  const [error, setError] = useState("");

  // Fetch shops
  const fetchShops = async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 25, search, status };
      const res = await axios.get(`${API}/api/shops`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        params,
      });

      const data = res.data;

      if (Array.isArray(data)) {
        setShops(data);
        setPage(p);
        setTotalPages(1); // Change if your API returns totalPages
      } else {
        setShops(data.shops || []);
        setPage(data.page || 1);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error("fetchShops:", err);
      pushToast("Failed to fetch shops");
      setShops([]);
    } finally {
      setLoading(false);
    }
  };

  // useEffect(() => {
  //   fetchShops(1);
  // }, []);



  // Inside your component
  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchShops(1); // always start from page 1 on new search
    }, 300); // 300ms debounce

    return () => clearTimeout(debounce);
  }, [search, status, designation]); // triggers when search or status changes


  // Search & Reset
  const handleSearch = () => fetchShops(1);
  const handleReset = () => {
    setSearch("");
    setStatus("");
    fetchShops(1);
  };

  // Toasts
  const pushToast = (msg) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };


  useEffect(() => {
    const blockRefresh = (e) => {
      if (saving) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", blockRefresh);
    return () => window.removeEventListener("beforeunload", blockRefresh);
  }, [saving]);


  const validateForm = () => {
    const newErrors = {};

    if (!form.shopname.trim()) {
      newErrors.shopname = "Branch name is required";
    }

    if (!form.contact.trim()) {
      newErrors.contact = "Contact is required";
    }

    if (form.contact.length !== 10) {
      newErrors.contact = "Contact must be 10 digits";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };


  // Create shop
  const handleCreateShop = async (e) => {
    e?.preventDefault();
    if (saving) return;

    if (!validateForm()) return;

    const payload = {
      shopname: form.shopname.trim(),
      designation: form.designation.trim(),
      address: form.address.trim(),
      contact: form.contact.trim(),
      counters: Number(counters),
    };

    if (!payload.shopname) {
      pushToast("⚠️ Shop name is required");
      return;
    }

    try {
      setSaving(true);
      const res = await axios.post(`${API}/api/shops`, payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const newShop = res.data?.shop;
      if (!newShop) {
        pushToast("⚠️ Server did not return shop data");
        return;
      }

      setShops((prev) => {
        const exists = prev.some((s) => s._id === newShop._id);
        return exists ? prev : [newShop, ...prev];
      });




      pushToast("✅ Branch created successfully");
      setShowAdd(false);
      setForm({ shopname: "", designation: "", address: "", contact: "" });
    }
    // catch (err) {
    //   console.error("❌ Create Branch error:", err);
    //   pushToast(err?.response?.data?.message || "Failed to create Branch");
    // }
    catch (err) {
      console.error("Create error:", err);

      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        pushToast(
          err.response?.data?.message || "Failed to create Branch"
        );
      }
    }
    finally {
      setSaving(false);
    }
  };

  const openView = (shop) => {
    setViewShop(shop);
    setShowView(true);
  };

  const openStatusModal = (shop) => {
    setStatusTarget(shop);
    setStatusModalOpen(true);
  };

  const closeStatusModal = () => {
    setStatusTarget(null);
    setStatusModalOpen(false);
  };






  const handleUpdateShop = async (e) => {
    e.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      await axios.put(
        `${API}/api/shops/edit/${editTargetId}`,
        {
          contact: editForm.contact,
          address: editForm.address,
          status: editForm.status,
          counters: Number(editForm.counters),
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      pushToast("Branch updated successfully");

      setShops((prev) =>
        prev.map((s) =>
          s._id === editTargetId
            ? { ...s, contact: editForm.contact, address: editForm.address, status: editForm.status }
            : s
        )
      );

      setShowEdit(false);
    } catch (err) {
      console.error("Update error:", err);
      pushToast("Failed to update branch");
    }
    finally {
      setSaving(false); // ✅ Stop saving mode
    }
  };


  const handleChange = (e) => {
    let value = e.target.value.replace(/\D/g, ""); // only digits
    if (value.length > 11) value = value.slice(0, 11);

    if (value.startsWith("0")) {
      setError("Kindly enter the contact number without zero or code.");
    } else if (value.length > 10) {
      setError("Contact number should be 10 digits only.");
    } else {
      setError("");
    }

    setForm({ ...form, contact: value });
  };

  // // Handle selecting a shop from table
  // const handleSelectShop = (shop) => {
  //   setSelectedShop({
  //     _id: shop._id,
  //     shopname: shop.shopname,
  //     designation: shop.designation || "",
  //   });
  //   pushToast(`Selected shop: ${shop.shopname}`);
  //     navigate("/user-dashboard");
  // };


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
      }, 4000);

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
    if (!show || !value.length) return null;

    return (
      <span className="absolute bottom-1 right-2 text-[10px] text-gray-400 pointer-events-none">
        {value.length}/{max}
      </span>
    );
  };

const handleCounterChange = (e) => {
  let value = e.target.value.replace(/\D/g, "");

  // Allow empty while typing/backspace
  if (value === "") {
    setCounters("");
    return;
  }

  // If 0 typed → make it 1
  if (Number(value) < 1) {
    value = "1";
  }

  setCounters(value);
};

const handleCounterBlur = () => {
  // If left empty after focus out → restore 1
  if (counters === "") {
    setCounters("1");
  }
};


  return (
    <div className="shop-page px-2 sm:px-4 md:px-6 lg:px-8 p-7 pt-10 sm:pt-10">
      {/* Toasts */}
      <div className="toasts fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast bg-gray-800 text-white p-3 rounded shadow-md"
          >
            {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="shops-header flex flex-col sm:flex-row items-center justify-between mb-2 gap-2">
        <h2 className=" text-2xl sm:text-3xl font-bold mb-6   text-[28px]  text-[#00a76f]">Branches</h2>
        <div>
          <button
            className="btn btn-primary flex items-center gap-2 px-4 py-2 rounded shadow hover:bg-blue-600 transition"
            onClick={() => setShowAdd(true)}
          >
            <FaPlus /> Add Branch
          </button>
        </div>
      </div>

      {/* Search + Status Filter */}
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          placeholder="Search by Branch"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!w-[220px] !md:w-[250px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867] transition duration-200 placeholder-gray-400"
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="!w-[100px] !md:w-[250px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1
             focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500
             transition duration-200 placeholder-gray-400"
        >
          <option value="" style={{ color: "black" }}>All Status</option>
          <option value="active" style={{ color: "green" }}>ACTIVE</option>
          <option value="inactive" style={{ color: "red" }}>INACTIVE</option>
        </select>
      </div>

      {/* Table */}
      <div className="card table-card bg-white rounded-2xl shadow p-4">
        <table className="table min-w-[600px] border-collapse w-full">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">S.No</th>
              <th className="px-4 py-2 text-left">Branch</th>

              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {!loading && shops.length === 0 && (
              <tr>
                <td colSpan="5" className="px-4 py-4 text-center text-gray-500">
                  No shops found
                </td>
              </tr>
            )}

            {shops
              // .filter((s) => {
              //   const query = search.toLowerCase();
              //   return (
              //     s.shopname.toLowerCase().includes(query) ||
              //     (s.designation || "").toLowerCase().includes(query)
              //   );
              // })
              // .filter((s) => (status ? s.status === status : true))
              .map((s, idx) => (
                <tr key={s._id || idx} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-2 border-t">{(page - 1) * pageSize + idx + 1}</td>
                  <td className="px-4 py-2 border-t">
                    <button
                      className="text-left w-full"
                      onClick={() => handleSelectShop(s)}
                    >
                      {s.shopname}
                    </button>
                  </td>
                  {/* <td className="px-4 py-2 border-t">{s.designation || "-"}</td> */}
                  <td className="px-4 py-2 border-t font-semibold" style={{ color: s.status === "active" ? "#00A76F" : "#E53935" }}>
                    {s.status.toUpperCase()}
                  </td>
                  <td className="px-4 py-2 border-t text-center flex justify-center gap-2">
                    {/* View Button */}
                    <button
                      onClick={() => openView(s)}
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

                    {/* Status Button */}
                    {/* <button
                onClick={() => openStatusModal(s)}
                title="Update Status"
                style={{
                  border: "none",
                  backgroundColor: "orange",
                  color: "#fff",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => (e.target.style.backgroundColor = "#cc8400")}
                onMouseLeave={(e) => (e.target.style.backgroundColor = "orange")}
              >
                <FaSyncAlt />
              </button> */}


                    {/* Edit Button – ONLY SHOW IF SHOP IS ACTIVE */}
                    {s.status === "active" && (
                      <button
                        onClick={() => openEditModal(s)}
                        title="Edit Branch"
                        style={{
                          border: "none",
                          backgroundColor: "#F59E0B",
                          color: "#fff",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "0.5rem",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                        }}
                        onMouseEnter={(e) => (e.target.style.backgroundColor = "#F59E0B")}
                        onMouseLeave={(e) => (e.target.style.backgroundColor = "#F59E0B")}
                      >
                        <FaEdit />
                      </button>
                    )}

                  </td>
                </tr>
              ))}

            {/* {loading && (
        <tr>
          <td colSpan="5" className="px-4 py-4 text-center text-gray-500">
            Loading...
          </td>
        </tr>
      )} */}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="mt-3">
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(p) => {
              if (p === page) return;
              setPage(p);
              fetchShops(p);
            }}
          />
        </div>
      </div>

      {/* Add / View / Status Modals */}
      {showAdd && (
        <Modal
          onClose={() => {
            if (saving) return;
            setShowAdd(false);
            setForm({
              shopname: "",
              designation: "",
              address: "",
              contact: "",
            });
            setError("");
          }}
          title="Add Branch"
        >

          <div className={`${saving ? "pointer-events-none opacity-60" : ""}`}>
            <form className="shop-form flex flex-col gap-4" onSubmit={handleCreateShop}>
              <div className="form-row flex flex-col relative">
                {/* <label className="font-medium">Branch</label> */}
                <RequiredLabel>Branch Name</RequiredLabel>

                <input
                  value={form.shopname}
                  // onChange={(e) => setForm({ ...form, shopname: e.target.value })}
                  required
                  // className="border rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"




                  onFocus={() => setActiveField("shopname")}
                  onBlur={() => setActiveField(null)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (validateMaxLength("shopname", val, 50)) {
                      setForm({ ...form, shopname: val });
                    }
                  }}


                  className={`border rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-400
      ${errors.shopname
                      ? "border-red-500 focus:ring-red-400"
                      : "focus:ring-green-400"
                    }`}
                />

                <CharCounter
                  value={form.shopname}
                  max={50}
                  show={activeField === "shopname"}
                />

                {errors.shopname && (
                  <p className="text-red-600 text-sm mt-1">{errors.shopname}</p>
                )}
              </div>


              <div className="form-row flex flex-col mb-2">
                {/* <label className="font-medium mb-1">Contact</label> */}

                <RequiredLabel>Contact</RequiredLabel>

                <input
                  type="text"
                  value={form.contact}
                  onChange={handleChange}
                  required
                  maxLength={11}
                  className={`border rounded px-2 py-1 w-full focus:outline-none focus:ring-2 ${error ? "border-red-500 focus:ring-red-400" : "focus:ring-green-400"
                    }`}
                />
                {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
              </div>

              <div className="form-row flex flex-col mb-2">
                <RequiredLabel>Counters</RequiredLabel>

                <input
                  type="text"
                  required
                  value={counters}
                  maxLength={11}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onChange={handleCounterChange}
                  onBlur={handleCounterBlur}
                  className={`border rounded px-2 py-1 w-full focus:outline-none focus:ring-2 ${error
                      ? "border-red-500 focus:ring-red-400"
                      : "focus:ring-green-400"
                    }`}
                />

                {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
              </div>

              <div className="form-row flex flex-col">
                <label className="font-medium">Address</label>
                <textarea
                  value={form.address}
                  // onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={4}
                  // className="border rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-green-400"





                  onFocus={() => setActiveField("address")}
                  onBlur={() => setActiveField(null)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (validateMaxLength("address", val, 250)) {
                      setForm({ ...form, address: val });
                    }
                  }}
                  className={`border rounded px-2 py-2 w-full pr-10 pb-5
      focus:outline-none focus:ring-2
      ${errors.address
                      ? "border-red-500 focus:ring-red-400"
                      : "focus:ring-green-400"
                    }`}
                />

                <CharCounter
                  value={form.address}
                  max={250}
                  show={activeField === "address"}
                />

                {errors.address && (
                  <p className="text-red-600 text-sm mt-1">{errors.address}</p>
                )}
              </div>

              <div className="modal-actions flex justify-end gap-2 mt-2 flex-wrap">
                {/* <button
                type="submit"
                className="btn btn-primary px-4 py-2 rounded hover:bg-blue-600"
              >
                Add Branch
              </button> */}

                <button
                  type="submit"
                  disabled={saving}
                  className={`btn btn-primary px-4 py-2 rounded hover:bg-green-600
    ${saving ? "bg-gray-400 cursor-not-allowed" : "btn-primary hover:bg-green-600"}
  `}
                >
                  {saving && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}

                  {saving ? "Adding..." : "Add Branch"}
                </button>


              </div>
            </form>

          </div>
        </Modal>
      )}


      {showView && viewShop && (
        <div className="modal fade-in">
          <div
            className="modal-content slide-up large"
            style={{ maxWidth: "800px", padding: "1rem 1.5rem", alignItems: "center" }}
          >
            {/* Header */}
            <div
              className="modal-header"
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                borderBottom: "1px solid #ddd",
                paddingBottom: "0.5rem",
                position: "relative",
                width: "100%",
              }}
            >
              <h2 style={{ margin: 0, textAlign: "center", flex: 1 }}>{viewShop.shopname}</h2>
              {/* Close Icon in Top Right */}
              <button
                className="icon-close"
                onClick={() => setShowView(false)}
                style={{
                  position: "absolute",
                  right: "0.5rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
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
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1.5rem",
                  margin: "1.5rem 0",
                  alignItems: "start",
                  width: "80%",
                  maxWidth: "500px",
                }}
              >
                {/* Left Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <p style={{ fontWeight: 600, minWidth: "120px" }}>Branch:</p>
                    <p>{viewShop.shopname || "-"}</p>
                  </div>
                  {/* Status */}
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <p
                      style={{
                        fontWeight: 600,
                        color: "#000000", // key only black
                        textTransform: "uppercase",
                        fontSize: "1rem",
                        minWidth: "120px",
                      }}
                    >
                      Status:
                    </p>

                    <p
                      style={{
                        fontWeight: 600,
                        textTransform: "uppercase",
                        fontSize: "1rem",
                        color:
                          viewShop.status?.toLowerCase() === "active"
                            ? "#00A76F"
                            : viewShop.status?.toLowerCase() === "inactive"
                              ? "#E53935"
                              : "#000000",
                      }}
                    >
                      {viewShop.status?.toUpperCase() || "-"}
                    </p>
                  </div>
                </div>

                {/* Right Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <p style={{ fontWeight: 600, minWidth: "120px" }}>Contact:</p>
                    <p>{viewShop.contact || "-"}</p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <p style={{ fontWeight: 600, minWidth: "120px" }}>Address:</p>
                    <p style={{ wordBreak: "break-word" }}>{viewShop.address || "-"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {statusModalOpen && statusTarget && (
        <Modal onClose={closeStatusModal} title="Update Shop destination Status">
          <div className="flex flex-col gap-3 p-2">
            <p>Change status for <b>{statusTarget.shopname}</b></p>
            <p>
              Current:{" "}
              <span style={{ color: statusTarget.status === "active" ? "#00A76F" : "#E53935" }}>
                {statusTarget.status.toUpperCase()}
              </span>
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                className="btn btn-primary px-4 py-2 rounded hover:bg-blue-600"
                onClick={() => { updateStatus(statusTarget._id, "active"); closeStatusModal(); }}
              >
                ACTIVE
              </button>
              <button
                className="btn btn-muted px-4 py-2 rounded hover:bg-gray-300"
                onClick={() => { updateStatus(statusTarget._id, "inactive"); closeStatusModal(); }}
              >
                INACTIVE
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title="Edit Branch"


          onClose={() => {
            if (saving) return;
            setShowEdit(false);
          }}


        >

          <div className={`${saving ? "pointer-events-none opacity-60" : ""}`}>

            <form className="flex flex-col gap-4" onSubmit={handleUpdateShop}>

              {/* READ-ONLY BRANCH NAME */}
              <div className="form-row flex flex-col">
                <label className="font-medium">Branch Name</label>
                <div className="border rounded px-2 py-1 bg-gray-100 text-gray-700">
                  {editForm.shopname}
                </div>
              </div>

              {/* CONTACT */}
              <div className="form-row flex flex-col">
                <label className="font-medium mb-1">Contact</label>
                <input
                  type="text"
                  value={editForm.contact}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      contact: e.target.value.replace(/\D/g, "").slice(0, 10),
                    })
                  }
                  required
                  className="border rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>

              {/* COUNTERS */}
<div className="form-row flex flex-col">
  <label className="font-medium mb-1">Counters</label>

  <input
    type="text"
    required
    value={editForm.counters}
    maxLength={11}
    inputMode="numeric"
    pattern="[0-9]*"
    onChange={(e) => {
      let value = e.target.value.replace(/\D/g, "");

      // Allow empty while typing
      if (value === "") {
        setEditForm({
          ...editForm,
          counters: "",
        });
        return;
      }

      // Prevent 0
      if (Number(value) < 1) {
        value = "1";
      }

      setEditForm({
        ...editForm,
        counters: value,
      });
    }}
    onBlur={() => {
      if (editForm.counters === "") {
        setEditForm({
          ...editForm,
          counters: "1",
        });
      }
    }}
    className="border rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-green-400"
  />
</div>

              {/* ADDRESS */}
              <div className="form-row flex flex-col">
                <label className="font-medium">Address</label>
                <textarea
                  value={editForm.address}
                  // onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}


                  rows={4}
                  // className="border rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"


                  onFocus={() => setActiveField("address")}
                  onBlur={() => setActiveField(null)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (validateMaxLength("address", val, 250)) {
                      setEditForm({ ...editForm, address: val });
                    }
                  }}
                  className={`border rounded px-2 py-2 w-full pr-10 pb-5 focus:outline-none focus:ring-2 focus:ring-green-400
      ${errors.address ? "border-red-500" : "border-gray-300"}`}
                />


                {/* Character Counter */}
                <CharCounter
                  value={editForm.address}
                  max={250}
                  show={activeField === "address"}
                />

                {/* Error Message */}
                {errors.address && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.address}
                  </p>
                )}
              </div>

              {/* STATUS */}
              <div className="form-row flex flex-col">
                <label className="font-medium">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="border rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="active">ACTIVE</option>
                  <option value="inactive">INACTIVE</option>
                </select>
              </div>

              {/* <div className="flex justify-end gap-2 mt-2">
              <button
                type="submit"
                className="btn btn-primary px-4 py-2 rounded hover:bg-blue-600"
              >
                Update Branch
              </button>
            </div> */}


              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-4 py-2 rounded  flex items-center gap-2  btn btn-primary  hover:bg-green-600
      ${saving
                      ? "bg-gray-400 cursor-not-allowed"
                      : "btn btn-primary hover:bg-green-600"}
    `}
                >
                  {saving && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}

                  {saving ? "Updating..." : "Update Branch"}
                </button>
              </div>

            </form>

          </div>
        </Modal>
      )}


    </div>
  );
}

/* Modal component */
function Modal({ title, children, onClose }) {
  return (
    <div
      className="modal-overlay fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center p-2 z-50"
      onMouseDown={onClose}
    >
      <div
        className="modal-card bg-white rounded-lg shadow-lg max-w-full w-full sm:w-11/12 md:w-3/4 lg:w-1/2 overflow-auto max-h-full p-4 relative"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="icon-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}



const RequiredLabel = ({ children }) => (
  <label className="font-medium flex items-center gap-1">
    <span>{children}</span>
    <span className="text-red-500">*</span>
  </label>
);
