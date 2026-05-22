
// src/pages/Sidebar/AddUser.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { FaPlus, FaEdit, FaTimes, FaEye, FaEyeSlash, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import "../../styles/Sidebar/adduser.css";
import Pagination from "../../components/Pagination";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const USERS_API = `${API}/api/users`;
const SHOPS_API = `${API}/api/shops`;

export default function AddUser() {
  const { user } = useAuth();
  const token = localStorage.getItem("token");

  const [users, setUsers] = useState([]);
  const [shops, setShops] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  // const [newUser, setNewUser] = useState({ username: "", mobileNumber: "", password: "", shopname: "",  });
  const [newUser, setNewUser] = useState({
    shopname: "",
    name: "",
    username: "",
    mobileNumber: "",
    password: "",
    role: "user"
  });

  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewUser, setViewUser] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editError, setEditError] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const limit = 25;
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState({});
  const [activeField, setActiveField] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showBranchMessage, setShowBranchMessage] = useState(false);



  /* ---------- Fetch Users ---------- */
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit, search, status });
      const res = await axios.get(`${USERS_API}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = Array.isArray(res.data) ? res.data : res.data.users || [];
      // Simulate 1s loading
      setTimeout(() => {
        setUsers(data);
        setTotalPages(res.data.totalPages || 1);
        setLoading(false);
      }, 100);
    } catch (err) {
      console.error("fetchUsers error:", err);
      setUsers([]);
      setTotalPages(1);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search, status]);

  /* ---------- Fetch Shops ---------- */


  const fetchShops = async () => {
    try {
      if (!token) return console.error("No token found. Cannot fetch shops.");

      const res = await axios.get(`${SHOPS_API}?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });

      console.log("Shops API response:", res.data);

      const data = Array.isArray(res.data) ? res.data : res.data.shops || [];
      setShops(data);

      // Set default shop in Add User modal if not set
      if (!newUser.shopname && data.length) {
        setNewUser((p) => ({ ...p, shopname: data[0].shopname }));
      }

    } catch (err) {
      console.error("fetchShops error:", err.response?.data || err.message);
      setShops([]);
    }
  };

  useEffect(() => { fetchShops(); }, []);



  // 🔒 Prevent refresh while saving
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


  /* ---------- Add User ---------- */
  const handleAddUser = async () => {
    if (saving) return;
    setErrorMsg("");
    const name = newUser.name?.trim();
    const username = newUser.username?.trim();
    const password = newUser.password?.trim();
    const shopname = newUser.shopname?.trim();
    const mobileNumber = newUser.mobileNumber?.trim() || "";

    if (!name) return setErrorMsg("name required");
    if (!username) return setErrorMsg("Username required");
    if (!password) return setErrorMsg("Password required");
    if (password.length < 6) return setErrorMsg("Password must be at least 6 characters");
    if (!shopname) return setErrorMsg("Please Select a shop");

    // ✅ Check globally using backend
    try {
      const res = await axios.get(`${USERS_API}?username=${encodeURIComponent(username)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.usernameExists) {
        return setErrorMsg("Username already exists in another branch");
      }
    } catch (err) {
      console.error("Username check error:", err.response?.data || err.message);
      return setErrorMsg("Failed to validate username");
    }

    setSaving(true);
    try {
      const payload = { name: newUser.name.trim(), username, mobileNumber, password, shopname, role: "user" };
      const res = await axios.post(USERS_API, payload, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000,
      });

      const created = res.data?.user || res.data;
      if (created) {
        setUsers((prev) => [...prev, created]); // update table immediately
      } else {
        await fetchUsers();
      }

      setNewUser({ shopname: "", username: "", name: "", mobileNumber: "", password: "", role: "user", });
      setShowAddModal(false);
    }


    catch (err) {
      console.error("handleAddUser error:", err.response?.data || err.message);

      // 🔥 Backend field-level error
      if (err.response?.data?.field) {
        setErrorMsg(err.response.data.message);
      }
      // 🔥 Backend general error
      else if (err.response?.data?.message) {
        setErrorMsg(err.response.data.message);
      }
      // 🔥 Network / unknown error
      else {
        setErrorMsg("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  /* ---------- View User ---------- */
  const openViewModal = (u) => { setViewUser(u); setShowViewModal(true); };
  const closeViewModal = () => { setViewUser(null); setShowViewModal(false); };

  /* ---------- Edit User ---------- */
  const openEditModal = (u) => {
    setEditUser({
      _id: u._id,
      name: u.name || "",
      username: u.username || "",
      email: u.email || "",
      password: "",
      mobileNumber: u.mobileNumber || "",
      shopname: u.shopname || shops[0]?.shopname || "",
      role: u.role || "user",
      status: u.status || "active",
    });
    setEditError("");
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setEditUser(null);
    setShowEditModal(false);
    setEditError("");
  };

  const handleSaveEdit = async () => {

    if (!editUser || saving) return;
    setEditError("");
    setErrors({});
    if (!editUser.username.trim()) return setEditError("Username required");



    setSaving(true);
    try {
      const payload = {
        name: editUser.name.trim(),
        username: editUser.username.trim(),
        mobileNumber: editUser.mobileNumber || "",
        ...(editUser.password ? { password: editUser.password } : {}),
        role: editUser.role || "user",
        shopname: editUser.shopname,
        status: editUser.status || "active",
      };

      const res = await axios.put(`${USERS_API}/${editUser._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const updated = res.data?.user || res.data;
      if (updated) {
        setUsers((prev) => prev.map((u) => (u._id === updated._id ? { ...u, ...updated } : u))); // update table immediately
      } else {
        await fetchUsers();
      }

      closeEditModal();
    }
    // catch (err) {
    //   console.error("handleSaveEdit error:", err.response?.data || err.message);
    //   const msg = err.response?.data?.message || err.message || "Failed to update user";
    //   setEditError(msg);
    // } finally {
    //   setEditBusy(false);
    // }

    catch (err) {
      console.error("handleSaveEdit error:", err.response?.data || err.message);

      if (err.response?.data?.field) {
        setErrors({
          [err.response.data.field]: err.response.data.message,
        });
      } else if (err.response?.data?.message) {
        setEditError(err.response.data.message);
      } else {
        setEditError("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }

  };

  const openAddModal = () => {
    setNewUser({
      // shopname: shops[0]?.shopname || "", // default to first shop
      name: "",
      username: "",
      mobileNumber: "",
      password: "",
      role: "user",
    });
    setErrorMsg("");
    setShowAddModal(true);
  };




  useEffect(() => {
    if (shops.length > 0 && !newUser.shopname) {
      setNewUser(prev => ({ ...prev, shopname: shops[0].shopname }));
    }
  }, [shops]);




  const closeAddModal = () => {
    setShowAddModal(false);
    setNewUser({
      shopname: "",
      name: "",
      username: "",
      mobileNumber: "",
      password: "",
      role: "user",
    });
    setErrorMsg("");
    setShowPassword(false);
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
      }, 3000); // auto hide after 3 sec

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


  useEffect(() => {
    if (!newUser.shopname) {
      setNewUser({
        shopname: "",
        name: "",
        username: "",
        mobileNumber: "",
        password: "",
        role: "user"
      });
    }
  }, [newUser.shopname]);


  return (
    <div className="users-page  pt-10 sm:pt-10">

      <div className="users-header">
        <h2 className=" text-2xl sm:text-3xl font-bold text-[28px]  text-[#00a76f]" >Staffs</h2>
        {user && (user.role === "megaadmin" || user.role === "manager") && (
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 
         rounded-lg     
    font-semibold
    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
        
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0      
    
    " onClick={openAddModal}>
            <FaPlus /> Add Staff
          </button>
        )}
      </div>

      {/* Search & Status Filter */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Search Name / Username / Mobile No / Branch"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="!w-[380px] !md:w-[400px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867] transition duration-200 placeholder-gray-400"
        />

        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="!w-[150px] !md:w-[200px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867] transition duration-200 placeholder-gray-400"
        >
          <option value="">All Status</option>
          <option value="active">ACTIVE</option>
          <option value="inactive">INACTIVE</option>
        </select>
      </div>
      {/* Users Table */}
      <div className="card table-card bg-white rounded-2xl shadow p-4">
        <table className="table min-w-[600px] border-collapse w-full">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">S.No</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Mobile</th>
              <th className="px-4 py-2 text-left">Username</th>
              <th className="px-4 py-2 text-left">Branch</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="px-4 py-4 text-center text-gray-500">Loading...</td>
              </tr>
            ) : users.length > 0 ? (
              users.map((u, idx) => (
                <tr key={u._id || idx} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-2 border-t">{(page - 1) * limit + idx + 1}</td>

                  <td className="px-4 py-2 border-t">{u.name || "-"}</td>
                  <td className="px-4 py-2 border-t">
                    {u.mobileNumber ? (
                      u.mobileNumber
                    ) : (
                      <span className="text-red-600 font-semibold">No mobile</span>
                    )}
                  </td>
                  <td className="px-4 py-2 border-t">{u.username}</td>
                  {/* <td className="px-4 py-2 border-t">{u.mobileNumber || "-"}</td> */}



                  <td className="px-4 py-2 border-t">{u.shopname}</td>
                  <td className="px-4 py-2 border-t">{u.role}</td>
                  <td
                    className="px-4 py-2 border-t font-semibold"
                    style={{ color: u.status === "active" ? "#00A76F" : "#E53935", textTransform: "uppercase" }}
                  >
                    {u.status?.toUpperCase() || "INACTIVE"}
                  </td>
                  <td className="px-4 py-2 border-t text-center flex justify-center gap-2">
                    {/* View Button */}
                    <button
                      onClick={() => openViewModal(u)}
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

                    {/* Edit Button */}
                    <button
                      onClick={() => openEditModal(u)}
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
                      onMouseEnter={(e) => (e.target.style.backgroundColor = "#d17a00")}
                      onMouseLeave={(e) => (e.target.style.backgroundColor = "#F59E0B")}
                    >
                      <FaEdit />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="px-4 py-4 text-center text-gray-500">No users found</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="mt-3 flex justify-center">
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(p) => {
              if (p === page) return;
              setPage(p);
            }}
          />
        </div>
      </div>



      {/* ---------- Add, View, Edit Modals ---------- */}
      {showAddModal && (
        <div className="modal fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="modal-content bg-white rounded-xl shadow-lg p-6 w-full max-w-md relative">
            {/* <button className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 transition" onClick={() => setShowAddModal(false)}><FaTimes size={18} /></button> */}

            <div className={`${saving ? "pointer-events-none opacity-60" : ""}`}>
              <button
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 transition"
                // onClick={closeAddModal} // ✅ use the reset function
                onClick={() => {
                  if (saving) return;
                  closeAddModal();
                }}
              >
                <FaTimes size={18} />
              </button>
              <h3 className="text-xl font-semibold mb-4 text-center">Add Staff</h3>
              {errorMsg && <div className="text-red-600 bg-red-100 p-2 rounded mb-2 text-sm">{errorMsg}</div>}

              <form onSubmit={(e) => { e.preventDefault(); handleAddUser(); }} className="flex flex-col gap-4">







                <div className="flex flex-col gap-1">
                  <RequiredLabel>Branch</RequiredLabel>
                  <select
                    value={newUser.shopname}
                    // onChange={(e) =>
                    //   setNewUser({ ...newUser, shopname: e.target.value })
                    // }
                    onChange={(e) => {
                      const value = e.target.value;

                      setNewUser({ ...newUser, shopname: value });

                      if (value) {
                        setShowBranchMessage(true);

                        setTimeout(() => {
                          setShowBranchMessage(false);
                        }, 2000); // 2 seconds
                      }
                    }}

                    required
                    className="border rounded-md px-3 py-2"
                  >
                    <option value="">Select Branch</option>
                    {shops.map((s) => (
                      <option key={s._id || s.shopname} value={s.shopname}>
                        {s.shopname}
                      </option>
                    ))}

                  </select>
                  {/* Message below dropdown */}
                  {!newUser.shopname && (
                    <span className="text-sm text-green-600 mt-1">
                      Please select a Branch to continue
                    </span>
                  )}


                  {showBranchMessage && (
                    <span className="text-sm text-green-600 mt-1 transition-opacity duration-300">
                      Branch selected. Enter staff details below.
                    </span>
                  )}



                </div>



                {/* Name Input */}


                {newUser.shopname && (
                  <>

                    <div className="flex flex-col gap-1 relative">
                      <RequiredLabel>Name</RequiredLabel>
                      <input
                        type="text"
                        value={newUser.name || ""}
                        // onChange={(e) =>
                        //   setNewUser({ ...newUser, name: e.target.value })
                        // }
                        required
                        // className="border rounded-md px-3 py-2"
                        placeholder="Enter Full Name"


                        onFocus={() => setActiveField("name")}
                        onBlur={() => setActiveField(null)}
                        onChange={(e) => {
                          const val = e.target.value;

                          if (validateMaxLength("name", val, 50)) {
                            setNewUser({ ...newUser, name: val });
                          }
                        }}

                        className={`border rounded-md px-3 py-2 pr-10 pb-5
      ${errors.name ? "border-red-500" : ""}`}
                      />

                      <CharCounter
                        value={newUser.name}
                        max={50}
                        show={activeField === "name"}
                      />

                      {errors.name && (
                        <span className="text-red-600 text-xs mt-1">{errors.name}</span>
                      )}
                    </div>


                    <div className="flex flex-col gap-1">
                      <RequiredLabel>Mobile No</RequiredLabel>
                      <input
                        type="text"
                        placeholder="Enter Mobile Number"
                        value={newUser.mobileNumber}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Allow only numbers and limit to 10 digits
                          if (/^\d{0,10}$/.test(value)) {
                            setNewUser({ ...newUser, mobileNumber: value });
                          }
                        }}
                        autoComplete="tel"
                        className="border rounded-md px-3 py-2"
                      />
                    </div>


                    {/* ---------- Username Input with Validation ---------- */}
                    <div className="flex flex-col gap-1 relative">
                      <RequiredLabel>Username</RequiredLabel>

                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Enter Username"
                          value={newUser.username}
                          // onChange={(e) => {
                          //   const username = e.target.value;
                          //   setNewUser((prev) => ({ ...prev, username }));
                          //   setErrorMsg(""); // clear previous error on typing
                          // }}

                          onChange={(e) => {
                            const val = e.target.value;

                            // Optional max length limit (example 30)
                            if (validateMaxLength("username", val, 30)) {
                              setNewUser((prev) => ({ ...prev, username: val }));
                              setErrorMsg("");
                            }
                          }}
                          required
                          autoComplete="username"
                          className={`border rounded-md px-3 py-2 pr-10
        ${errorMsg === "Username already exists in another shop"
                              ? "border-red-500 text-red-600"
                              : ""
                            }
        ${errors.username ? "border-red-500" : ""}
      `}


                          onFocus={() => setActiveField("username")}

                          onBlur={async () => {
                            setActiveField(null);
                            const username = newUser.username.trim();

                            if (!username) return;

                            try {
                              const res = await axios.get(`${USERS_API}?username=${encodeURIComponent(username)}`, {
                                headers: { Authorization: `Bearer ${token}` },
                              });

                              if (res.data.usernameExists) {
                                setErrorMsg("Username already exists in another Branch");
                              } else {
                                setErrorMsg("");
                              }
                            } catch (err) {
                              console.error("Username check error:", err.response?.data || err.message);
                            }
                          }}
                        // required
                        // autoComplete="username"
                        // className={`border rounded-md px-3 py-2 ${errorMsg === "Username already exists" ? "border-red-500 text-red-600" : ""
                        //   }`}
                        />
                        {/* Character Counter */}
                        <CharCounter
                          value={newUser.username}
                          max={30}
                          show={activeField === "username"}
                        />
                      </div>




                      {/* Max Length Error */}
                      {errors.username && (
                        <span className="text-red-600 text-xs">
                          {errors.username}
                        </span>
                      )}

                      {errorMsg === "Username already exists in another Branch" && (
                        <span className="text-red-600 text-xs mt-1">{errorMsg}</span>
                      )}
                    </div>






                    <div className="flex flex-col gap-1 relative">
                      <RequiredLabel>Password</RequiredLabel>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={newUser.password}
                        onFocus={() => setActiveField("password")}
                        onBlur={() => setActiveField(null)}
                        // onChange={(e) =>
                        //   setNewUser({ ...newUser, password: e.target.value })
                        // }

                        onChange={(e) => {
                          const val = e.target.value;

                          if (validateMaxLength("password", val, 20)) {
                            setNewUser({ ...newUser, password: val });

                            // Optional: live validation
                            if (val.length > 0 && val.length < 6) {
                              setErrors((prev) => ({
                                ...prev,
                                password: "Password must be at least 6 characters",
                              }));
                            } else {
                              setErrors((prev) => {
                                const copy = { ...prev };
                                delete copy.password;
                                return copy;
                              });
                            }
                          }
                        }}

                        required
                        autoComplete="new-password"

                        className={`w-full border rounded-md px-3 py-2 pr-10 pb-5
      ${errors.password ? "border-red-500" : ""}`}
                        placeholder="Enter password"
                      />
                      <span
                        className="absolute right-3 top-9 cursor-pointer text-gray-500"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </span>


                      {/* 🔢 Character Counter */}
                      <CharCounter
                        value={newUser.password}
                        max={20}
                        show={activeField === "password"}
                      />

                      {/* ❌ Error Message */}
                      {errors.password && (
                        <span className="text-red-600 text-xs mt-1">
                          {errors.password}
                        </span>
                      )}
                    </div>

                    {/* <button type="submit" disabled={busy} className="bg-emerald-600 text-white py-2 rounded-md hover:bg-emerald-700 transition">{busy ? "Adding..." : "Add"}</button> */}

                    {/* <button
                type="submit"
                disabled={
                  busy ||
                  !newUser.username ||
                  !newUser.shopname ||
                  errorMsg === "Username already exists" ||
                  errorMsg === "This username already exists for the selected shop"
                }
                // className={`bg-emerald-600 text-white py-2 rounded-md hover:bg-emerald-700 transition 


                className={`
    inline-flex items-center justify-center gap-2 px-4 py-2
    rounded-lg font-semibold
    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0
    
    ${busy ||
                    errorMsg === "Username already exists" ||
                    errorMsg === "This username already exists for the selected shop"
                    ? "opacity-50 cursor-not-allowed hover:translate-y-0"
                    : ""
                  }`}
              >
                {busy ? "Adding Staff..." : "Add Staff"}
              </button> */}

                    <button
                      type="submit"
                      disabled={saving}
                      className={`
    inline-flex items-center justify-center gap-2 px-4 py-2
    rounded-lg font-semibold
    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    transition-all duration-150
    active:translate-y-0
    ${saving
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:-translate-y-[1px]"}
  `}
                    >
                      {saving && (
                        <span className="w-4 h-4 border-2 border-[#007867] border-t-transparent rounded-full animate-spin"></span>
                      )}

                      {saving ? "Adding Staff..." : "Add Staff"}
                    </button>
                  </>
                )}

              </form>
            </div>
          </div>
        </div>
      )}


      {showViewModal && viewUser && (
        <div className="modal fade-in">
          <div
            className="modal-content slide-up large"
            style={{ maxWidth: "700px", padding: "1rem 1.5rem", alignItems: "center", }}
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
              <h3 style={{ margin: 0 }}>View Staff</h3>
              <button className="icon-close" onClick={closeViewModal}>
                <FaTimes />
              </button>
            </div>

            {/* Top Info Section */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                width: "100%",
                marginTop: "1rem",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1.5rem",
                  width: "80%",
                  maxWidth: "500px",
                  alignItems: "center",
                }}
              >
                {/* Left Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <p style={{ fontWeight: 600, minWidth: "120px" }}>Branch</p>
                    <p>{viewUser.shopname || "-"}</p>
                  </div>


                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <p style={{ fontWeight: 600, minWidth: "120px" }}>Username:</p>
                    <p>{viewUser.username || "-"}</p>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <p style={{ fontWeight: 600, minWidth: "120px" }}>Mobile Number:</p>
                    <p style={{ color: viewUser.mobileNumber ? "inherit" : "#E53935", fontWeight: viewUser.mobileNumber ? "normal" : 600 }}>
                      {viewUser.mobileNumber || "No mobile"}
                    </p>
                  </div>

                </div>

                {/* Right Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <p style={{ fontWeight: 600, minWidth: "120px" }}>Name:</p>
                    <p>{viewUser.name || "-"}</p>
                  </div>


                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <p style={{ fontWeight: 600, minWidth: "120px" }}>Password:</p>
                    <p>{viewUser.password || "-"}</p>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <p style={{ fontWeight: 600, minWidth: "120px" }}>Status:</p>
                    <p
                      style={{
                        color: (viewUser.status || "active").toLowerCase() === "active" ? "#00A76F" : "#E53935",
                        fontWeight: 600,
                        textTransform: "uppercase",
                      }}
                    >
                      {(viewUser.status || "active").toUpperCase()}
                    </p>
                  </div>

                  {/* <div style={{ display: "flex", gap: "0.5rem" }}>
              <p style={{ fontWeight: 600, minWidth: "120px" }}>Role:</p>
              <p>{viewUser.role || "user"}</p>
            </div> */}
                </div>
              </div>
            </div>


          </div>
        </div>
      )}




      {showEditModal && editUser && (
        <div className="modal fixed inset-0 bg-black/30 flex items-center justify-center z-50">

          <div className="modal-content bg-white rounded-xl shadow-lg p-6 w-full max-w-md relative">
            <div className={`${saving ? "pointer-events-none opacity-60" : ""}`}>
              <h3 className="text-xl font-semibold mb-4 text-center">Edit Staff</h3>
              {editError && <div className="text-red-600 bg-red-100 p-2 rounded mb-2 text-sm">{editError}</div>}
              <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} className="flex flex-col gap-4">

                <div className="flex flex-col gap-1">

                  <RequiredLabel> Branch</RequiredLabel>
                  <input
                    type="text"
                    value={editUser.shopname || ""}
                    readOnly
                    className="border rounded-md px-3 py-2 bg-gray-100 cursor-not-allowed"
                  />
                </div>



                {/* <input
                  type="text"
                  placeholder="Full Name"
                  value={editUser.name || ""}
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                  required
                  className="border rounded-md px-3 py-2"
                /> */}

                <div className="flex flex-col gap-1 relative">
                  <RequiredLabel>Name</RequiredLabel>

                  <input
                    type="text"
                    value={editUser.name || ""}
                    onFocus={() => setActiveField("editName")}
                    onBlur={() => setActiveField(null)}
                    placeholder="Enter Full Name"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (validateMaxLength("name", val, 50)) {
                        setEditUser({ ...editUser, name: val });
                      }
                    }}
                    className={`border rounded-md px-3 py-2 pr-10 pb-5
      ${errors.name ? "border-red-500" : ""}`}
                  />

                  <CharCounter
                    value={editUser.name}
                    max={50}
                    show={activeField === "editName"}
                  />

                  {errors.name && (
                    <span className="text-red-600 text-xs mt-1">
                      {errors.name}
                    </span>
                  )}
                </div>



                <input
                  type="text"
                  placeholder="Mobile Number"
                  value={editUser.mobileNumber || ""}

                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d{0,10}$/.test(value)) { setEditUser({ ...editUser, mobileNumber: e.target.value }); }
                  }}


                  autoComplete="tel"
                  className="border rounded-md px-3 py-2"
                />



                {/* <input type="text" placeholder="Mobile Number (optional)" value={editUser.mobileNumber || ""} onChange={(e) => setEditUser({ ...editUser, mobileNumber: e.target.value })} className="border rounded-md px-3 py-2" /> */}
                {/* <input type="text" placeholder="Username" value={editUser.username} onChange={(e) => setEditUser({ ...editUser, username: e.target.value })} required className="border rounded-md px-3 py-2" /> */}

                <div className="flex flex-col gap-1 relative">
                  <RequiredLabel>Username</RequiredLabel>

                  <input
                    type="text"
                    value={editUser.username}
                    onFocus={() => setActiveField("editUsername")}
                    onBlur={() => setActiveField(null)}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (validateMaxLength("username", val, 30)) {
                        setEditUser({ ...editUser, username: val });
                      }
                    }}
                    placeholder="Enter Username"
                    className={`border rounded-md px-3 py-2 pr-10 pb-5
      ${errors.username ? "border-red-500" : ""}`}
                  />

                  <CharCounter
                    value={editUser.username}
                    max={30}
                    show={activeField === "editUsername"}
                  />

                  {errors.username && (
                    <span className="text-red-600 text-xs mt-1">
                      {errors.username}
                    </span>
                  )}
                </div>

                {/* <div className="relative">
                  <input type={showPassword ? "text" : "password"} placeholder="New Password (optional)" value={editUser.password || ""} onChange={(e) => setEditUser({ ...editUser, password: e.target.value })} autoComplete="new-password" className="w-full border rounded-md px-3 py-2" />
                  <span className="absolute inset-y-0 right-3 flex items-center cursor-pointer text-gray-500" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div> */}

                <div className="flex flex-col gap-1 relative">
                  <label className="text-sm font-medium text-gray-700">
                    New Password
                  </label>

                  <input
                    type={showPassword ? "text" : "password"}
                    value={editUser.password || ""}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    onFocus={() => setActiveField("editPassword")}
                    onBlur={() => setActiveField(null)}
                    onChange={(e) => {
                      const val = e.target.value;

                      if (validateMaxLength("password", val, 20)) {
                        setEditUser({ ...editUser, password: val });

                        if (val.length > 0 && val.length < 6) {
                          setErrors((prev) => ({
                            ...prev,
                            password: "Password must be at least 6 characters",
                          }));
                        } else {
                          setErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.password;
                            return copy;
                          });
                        }
                      }
                    }}
                    className={`w-full border rounded-md px-3 py-2 pr-10 pb-5
      ${errors.password ? "border-red-500" : ""}`}
                  />

                  <span
                    className="absolute right-3 top-9 cursor-pointer text-gray-500"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </span>

                  <CharCounter
                    value={editUser.password}
                    max={20}
                    show={activeField === "editPassword"}
                  />

                  {errors.password && (
                    <span className="text-red-600 text-xs mt-1">
                      {errors.password}
                    </span>
                  )}
                </div>

                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input type="checkbox" checked={editUser.status === "active"} onChange={(e) => {
                    const newStatus = e.target.checked ? "active" : "inactive";
                    setEditUser(p => ({ ...p, status: newStatus }));
                    setUsers(prev => prev.map(u => u._id === editUser._id ? { ...u, status: newStatus } : u));
                  }} className="form-checkbox h-4 w-4" />
                  Status: <span className={`font-semibold ${editUser.status === "active" ? "text-green-600" : "text-red-600"}`}>{editUser.status?.toUpperCase() || "INACTIVE"}</span>
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className={`bg-emerald-600 text-white py-2 rounded-md flex items-center justify-center gap-2
    ${saving ? "opacity-50 cursor-not-allowed" : "hover:bg-emerald-700"}
  `}
                >
                  {saving && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}

                  {saving ? "Updating Staff..." : "Update Staff"}
                </button>

                <button type="button" onClick={closeEditModal} className="text-gray-500 text-sm hover:text-gray-700 mt-1">Cancel</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




const RequiredLabel = ({ children }) => (
  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
    {children}
    <span className="text-red-500">*</span>
  </label>
);
