




// src/components/Sidebar.jsx
import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  FaTachometerAlt,
  FaBoxes,
  FaFileInvoice,
  FaUserCog,
  FaChevronDown,
  FaBoxOpen,
  FaPlusCircle,
  FaExclamationTriangle,
  FaClipboardList,
  FaStore,
  FaSignOutAlt,
  FaUserCircle,
  FaArrowLeft,
  FaPlus,
  FaChartBar,
  FaChartLine,
  FaChartPie,
  FaExclamationCircle,
  FaMoneyBillWave,
  FaShoppingCart,
  FaUsers,
  FaShoppingBag,
  FaFile,
  FaList,
  FaWallet,
  FaReceipt,
  FaTimes,
} from "react-icons/fa";
import logo from "../assets/logo-icon.png";
import "../styles/sidebar.css";
import { useShop } from "../context/ShopContext";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Sidebar({ closeSidebar, onExitShopClick }) {
  const { selectedShop, setSelectedShop, tenantData, setTenantData } = useShop();
  const { user } = useAuth();

  // const [openStock, setOpenStock] = useState(false);
  const [openPages, setOpenPages] = useState(false);
  const [openShop, setOpenShop] = useState(false);
  // const [openReports, setOpenReports] = useState(false);
  const [restoringShop, setRestoringShop] = useState(true);
  const [loadingTenantData, setLoadingTenantData] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();


  const currentUser = JSON.parse(localStorage.getItem("user"));
  const role = currentUser?.role;

  // single controller for ALL dropdowns
  const [openMenu, setOpenMenu] = useState(null);

  // universal toggle
  const toggleMenu = (name) => {
    setOpenMenu((prev) => (prev === name ? null : name));
  };




  useEffect(() => {
    const path = location.pathname;

    // SALES (child of reports)
    if (
      path.startsWith("/master/branch-reports/sales") ||
      path.startsWith("/branch-reports/sales")
    ) {
      setOpenMenu("sales");
      return;
    }

    // REPORTS (parent)
    if (
      path.startsWith("/branch-reports") ||
      path.startsWith("/master/branch-reports")
    ) {
      setOpenMenu("reports");
      return;
    }

    // STOCK
    if (
      path.startsWith("/stock") ||
      path.startsWith("/master/stock")
    ) {
      setOpenMenu("stock");
      return;
    }

    setOpenMenu(null);
  }, [location.pathname]);



  /* ---------- Restore selectedShop on mount ---------- */
  useEffect(() => {
    const exitFlag = localStorage.getItem("exitShop");

    if (exitFlag) {
      // User has exited shop or just logged in, do not restore
      setSelectedShop(null);
    } else {
      const savedShop = localStorage.getItem("selectedShop");
      if (savedShop) {
        try {
          setSelectedShop(JSON.parse(savedShop));
        } catch (err) {
          console.warn("Failed to parse saved selectedShop:", err);
        }
      } else if (currentUser?.shopId && currentUser?.shopname) {
        setSelectedShop({ _id: currentUser.shopId, shopname: currentUser.shopname });
      }
    }

    setRestoringShop(false);
  }, []);

  /* ---------- Persist selectedShop to localStorage ---------- */
  useEffect(() => {
    if (selectedShop) {
      localStorage.setItem("selectedShop", JSON.stringify(selectedShop));
      // Clear exit flag when a new shop is selected
      localStorage.removeItem("exitShop");
    } else {
      localStorage.removeItem("selectedShop");
    }
  }, [selectedShop]);

  /* ---------- Fetch tenant data when selectedShop exists ---------- */
  useEffect(() => {
    if (!selectedShop?.shopname) return;

    const controller = new AbortController();
    const signal = controller.signal;
    const encodedShopname = encodeURIComponent(selectedShop.shopname);

    const getAuthToken = () => {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user) return "";
      return user.type === "master"
        ? localStorage.getItem("masterToken")
        : localStorage.getItem("token");
    };

    const safeFetch = async (endpoint) => {
      try {
        const res = await axios.get(
          `${API_BASE}/api/tenant/shops/${encodedShopname}/${endpoint}`,
          {
            headers: {
              Authorization: `Bearer ${getAuthToken()}`,
              "x-shop-name": encodedShopname,
              "x-shop-id": selectedShop._id,
            },
            signal,
          }
        );
        return res.data || [];
      } catch (err) {
        if (axios.isCancel(err)) return [];
        console.warn(
          `Failed to fetch ${endpoint}:`,
          err.response?.data?.message || err.message
        );
        return [];
      }
    };

    setLoadingTenantData(true);

    Promise.all(
      ["products", "orders", "sales-bills", "customers", "users"].map(safeFetch)
    )
      .then(([products, orders, salesBills, customers, users]) => {
        setTenantData({ products, orders, salesBills, customers, users });
      })
      .finally(() => setLoadingTenantData(false));

    return () => controller.abort();
  }, [selectedShop, setTenantData]);

  /* ---------- Logout & Exit shop ---------- */
  const handleLogout = () => {
    // localStorage.clear();
    setSelectedShop(null);
    localStorage.setItem("exitShop", "true");
    setTenantData(null);
    navigate("/", { replace: true });
  };

  // Exit Shop (no modal here — main layout should show the modal)
  const handleExitShop = () => {
    setSelectedShop(null);
    setTenantData(null);
    localStorage.removeItem("selectedShop");
    localStorage.setItem("exitShop", "true");
    navigate("/master-dashboard");
  };

  // const isActiveLink = (path) => location.pathname === path;

  const isActiveLink = (path) => {
    return (
      location.pathname === path ||
      location.pathname.startsWith(path + "/")
    );
  };




  useEffect(() => {
    const path = location.pathname;

    if (path.startsWith("/shops") || path.startsWith("/all-shops")) {
      setOpenMenu("shop");
    } else if (path.startsWith("/reports")) {
      setOpenMenu("pages");
    }
  }, [location.pathname]);


  const isReportsActive = () => {
    return location.pathname.startsWith("/reports");

  };

  useEffect(() => {
    if (location.pathname.startsWith("/reports")) {
      setOpenMenu("pages");
    }
  }, [location.pathname]);



  const isBranchReportsActive = () => {
    return (
      location.pathname.startsWith("/master/branch-reports") ||
      location.pathname.startsWith("/branch-reports")
    );
  };





  const isShopActive = () => {
    return (
      location.pathname.startsWith("/shops") ||
      location.pathname.startsWith("/all-shops")
    );
  };

  useEffect(() => {
    if (
      location.pathname.startsWith("/shops") ||
      location.pathname.startsWith("/all-shops")
    ) {
      setOpenMenu("shop");
    }
  }, [location.pathname]);


  const isStockActive = () => {
    const path = location.pathname;
    return (
      path.startsWith("/stock") ||
      path.startsWith("/master/stock")
    );
  };



  /* ---------- Loading state ---------- */
  if ((role === "manager" || role === "megaadmin") && restoringShop) {
    return (
      <aside className="bg-white h-full shadow-lg w-64 flex items-center justify-center">
        <p className="text-green-600 font-bold">Loading shop...</p>
      </aside>
    );
  }

  return (
    <>
      <aside
        className=" sidebar-root shadow-lg w-64 lg:static fixed z-50 inset-y-0 left-0 transform lg:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col pr-4 pt-6 pb-8 sm:pr-6 sm:pt-6 sm:pb-10"
        style={{
          height: "100dvh",
          background: "linear-gradient(320deg, rgba(211, 252, 210, 0.7) 0%, #ffffff 70%)",
        }}
      >

        <nav className="sidebar-nav flex-1 overflow-y-auto px-2 py-4 pt-10 sm:pt-10 sm:pb-8"


          style={{ height: "calc(100dvh - 120px)" }}>
          {/* Mobile close button */}
          <div className="flex justify-end lg:hidden p-1">
            <button
              onClick={closeSidebar}
              className="text-red-500 hover:text-red-700 text-xl font-bold"
            >
              <FaTimes />
            </button>
          </div>

          {/* GLOBAL NAV for megaadmin/manager without selectedShop */}
          {(role === "megaadmin" || role === "manager") && !selectedShop && (
            <>
              <NavLink
                to="/master-dashboard"  replace
                className={isActiveLink("/master-dashboard") ? "sidebar-link sidebar-link-active" : "sidebar-link"}
              >
                <FaTachometerAlt /> Dashboard
              </NavLink>




              {/* Shop Dropdown */}
              <div>
     
                <button
                  onClick={() => toggleMenu("shop")}
                  className="sidebar-dropdown-btn"
                  style={{
                    color: isShopActive() ? "#00a76f" : "", // green-600 / gray-700
                    fontWeight: isShopActive() ? "600" : "500",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <FaStore
                      style={{
                        color: isShopActive() ? "#00a76f" : "",
                      }}
                    />
                    Branches
                  </span>

                  <FaChevronDown
                    className={`transform transition-transform ${openMenu === "shop" ? "rotate-180" : ""
                      }`}
                  />
                </button>


                {openMenu === "shop" && (
                  <div className="sidebar-dropdown">
                    <NavLink
                      to="/shops" replace
                      className={
                        isActiveLink("/shops")
                          ? "sidebar-link sidebar-link-active"
                          : "sidebar-link"
                      }
                    >
                      <FaPlus className="inline-block mr-2" /> Add Branch
                    </NavLink>

                    <NavLink
                      to="/all-shops" replace
                      className={
                        isActiveLink("/all-shops")
                          ? "sidebar-link sidebar-link-active"
                          : "sidebar-link"
                      }
                    >
                      <FaStore className="inline-block mr-2" /> Branches
                    </NavLink>
                  </div>
                )}
              </div>


              {/* Add User */}
              <NavLink
                to="/add-user"
                className={isActiveLink("/add-user") ? "sidebar-link sidebar-link-active" : "sidebar-link"}
              >
                <FaUserCog /> Staffs
              </NavLink>

              {/* Reports Dropdown */}
              <div>
                <button
                  onClick={() => toggleMenu("pages")}
                  className="sidebar-dropdown-btn"
                  style={{
                    color: isReportsActive() ? "#00a76f" : "", 
                    fontWeight: isReportsActive() ? "600" : "500",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <FaChartLine
                      style={{
                        color: isReportsActive() ? "#00a76f" : "",
                      }}
                    />
                    Reports
                  </span>

                  <FaChevronDown
                    className={`transform transition-transform ${openMenu === "pages" ? "rotate-180" : ""
                      }`}
                    style={{
                      color: isReportsActive() ? "#00a76f" : "",
                    }}
                  />
                </button>


                {openMenu === "pages" && (
                  <div className="sidebar-dropdown reports-scroll">
                    <NavLink
                      to="/reports/sales"
                      className={
                        isActiveLink("/reports/sales")
                          ? "sidebar-link sidebar-link-active"
                          : "sidebar-link"
                      }
                    >
                      <FaClipboardList className="inline-block mr-2" /> Sales
                    </NavLink>

                    <NavLink
                      to="/reports/top-products"
                      className={
                        isActiveLink("/reports/top-products")
                          ? "sidebar-link sidebar-link-active"
                          : "sidebar-link"
                      }
                    >
                      <FaBoxes className="inline-block mr-2" /> Top Selling Products
                    </NavLink>

                    <NavLink
                      to="/reports/low-stock"
                      className={
                        isActiveLink("/reports/low-stock")
                          ? "sidebar-link sidebar-link-active"
                          : "sidebar-link"
                      }
                    >
                      <FaExclamationTriangle className="inline-block mr-2 text-red-500" /> Low Stock
                    </NavLink>

                    <NavLink
                      to="/reports/inventory"
                      className={
                        isActiveLink("/reports/inventory")
                          ? "sidebar-link sidebar-link-active"
                          : "sidebar-link"
                      }
                    >
                      <FaBoxOpen className="inline-block mr-2" /> Stock Value
                    </NavLink>
                  </div>
                )}
              </div>

            </>
          )}

          {/* ========== SHOP-SPECIFIC NAVIGATION ========== */}
          {(role === "user" || ((role === "manager" || role === "megaadmin") && selectedShop)) && (
            <>
              {(role === "manager" || role === "megaadmin") && selectedShop && (
                <h3 className="font-bold text-green-600">{selectedShop.shopname} Branch</h3>
              )}

              {(role === "manager" || role === "megaadmin") && selectedShop && (
                <button
                  onClick={() => {
                    // use onExitShopClick from MainLayout if provided, otherwise fallback to local handler
                    if (typeof onExitShopClick === "function") {
                      onExitShopClick();
                    } else {
                      handleExitShop();
                    }
                  }}
                  className="sidebar-link text-green-500 hover:text-green-600 flex items-center gap-2"
                >
                  <FaArrowLeft /> Exit Shop
                </button>
              )}

              {role === "user" && (
                <NavLink
                  to="/dashboard"
                  className={isActiveLink("/dashboard") ? "sidebar-link sidebar-link-active" : "sidebar-link"}
                >
                  <FaTachometerAlt /> Dashboard
                </NavLink>
              )}
              {selectedShop && (role === "manager" || role === "megaadmin") && (
                <NavLink
                  to="/user-dashboard" replace
                  className={isActiveLink("/user-dashboard") ? "sidebar-link sidebar-link-active" : "sidebar-link"}
                >
                  <FaTachometerAlt /> Dashboard
                </NavLink>
              )}


              {/* Stock Dropdown */}
              <div className={`sidebar-container ${openMenu === "stock" ? "no-scroll" : ""}`}>
                <button
                  onClick={() => toggleMenu("stock")}
                  className="sidebar-dropdown-btn"
                  style={{
                    color: isStockActive() ? "#00a76f" : "", // active / normal
                    fontWeight: isStockActive() ? "600" : "500",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <FaBoxes
                      style={{
                        color: isStockActive() ? "#00a76f" : "",
                      }}
                    />
                    Stock
                  </span>

                  <FaChevronDown
                    className={`transform transition-transform ${openMenu === "stock" ? "rotate-180" : ""
                      }`}
                    style={{
                      color: isStockActive() ? "#00a76f" : "#374151",
                    }}
                  />
                </button>


                {openMenu === "stock" && (
                  <div className="sidebar-dropdown">
                    {role === "user" && (
                      <NavLink
                        to="/stock/products"
                        className={
                          isActiveLink("/stock/products")
                            ? "sidebar-link sidebar-link-active"
                            : "sidebar-link"
                        }
                      >
                        <FaBoxOpen className="inline-block mr-2" /> Products
                      </NavLink>
                    )}

                    {(role === "manager" || role === "megaadmin") && selectedShop && (
                      <NavLink
                        to="/stock/master-products"
                        className={
                          isActiveLink("/stock/master-products")
                            ? "sidebar-link sidebar-link-active"
                            : "sidebar-link"
                        }
                      >
                        <FaBoxOpen className="inline-block mr-2" /> Products
                      </NavLink>
                    )}

                    {selectedShop && (role === "manager" || role === "megaadmin") && (
                      <NavLink
                        to="/stock/master-purchase"
                        className={
                          isActiveLink("/stock/master-purchase")
                            ? "sidebar-link sidebar-link-active"
                            : "sidebar-link"
                        }
                      >
                        <FaShoppingCart className="inline-block mr-2" /> Purchases
                      </NavLink>
                    )}
     
                    {role === "user" && (
                      <NavLink
                        to="/stock/purchase"
                        className={
                          isActiveLink("/stock/purchase")
                            ? "sidebar-link sidebar-link-active"
                            : "sidebar-link"
                        }
                      >
                        <FaShoppingCart className="inline-block mr-2" /> Purchases
                      </NavLink>
                    )}


                    {role === "user" && (
                      <NavLink
                        to="/stock/min-qty"
                        className={
                          isActiveLink("/stock/min-qty")
                            ? "sidebar-link sidebar-link-active"
                            : "sidebar-link"
                        }
                      >
                        <FaExclamationTriangle className="inline-block mr-2 text-red-500" /> Low Stock
                      </NavLink>
                    )}

                    {selectedShop && (role === "manager" || role === "megaadmin") && (
                      <NavLink
                        to="/master/stock/min-qty"
                        className={
                          isActiveLink("/master/stock/min-qty")
                            ? "sidebar-link sidebar-link-active"
                            : "sidebar-link"
                        }
                      >
                        <FaExclamationTriangle className="inline-block mr-2 text-red-500" /> Low Stock
                      </NavLink>
                    )}
                  </div>
                )}
              </div>


              {/* Sales */}
              {role === "user" && (
                <NavLink
                  to="/sales"
                  className={isActiveLink("/sales") ? "sidebar-link sidebar-link-active" : "sidebar-link"}
                >
                  <FaFileInvoice /> Sales Bill
                </NavLink>
              )}
              {selectedShop && (role === "manager" || role === "megaadmin") && (
                <NavLink
                  to="/master-sales"
                  className={isActiveLink("/master-sales") ? "sidebar-link sidebar-link-active" : "sidebar-link"}
                >
                  <FaFileInvoice /> Sales Bill
                </NavLink>
              )}

              {/* Orders */}
              {/* {selectedShop && (role === "manager" || role === "megaadmin") && (
                <NavLink
                  to="/master-orders"
                  className={isActiveLink("/master-orders") ? "sidebar-link sidebar-link-active" : "sidebar-link"}
                >
                  <FaShoppingBag /> Orders
                </NavLink>
              )}
              {role === "user" && (
                <NavLink
                  to="/orders"
                  className={isActiveLink("/orders") ? "sidebar-link sidebar-link-active" : "sidebar-link"}
                >
                  <FaShoppingBag /> Orders
                </NavLink>
              )} */}


              {/* Customers */}
              {selectedShop && (role === "manager" || role === "megaadmin") && (
                <NavLink
                  to="/master-addcustomer"
                  className={isActiveLink("/master-addcustomer") ? "sidebar-link sidebar-link-active" : "sidebar-link"}
                >
                  <FaUsers /> Customers
                </NavLink>
              )}
              {role === "user" && (
                <NavLink
                  to="/add-customer"
                  className={isActiveLink("/add-customer") ? "sidebar-link sidebar-link-active" : "sidebar-link"}
                >
                  <FaUsers /> Add Customer
                </NavLink>
              )}



              {/* Expense */}
              {selectedShop && (role === "manager" || role === "megaadmin") && (
                <NavLink
                  to="/master-expense"
                  className={isActiveLink("/master-expense") ? "sidebar-link sidebar-link-active" : "sidebar-link"}
                >
                  <FaReceipt /> Expense
                </NavLink>
              )}
              {role === "user" && (
                <NavLink
                  to="/expense"
                  className={isActiveLink("/expense") ? "sidebar-link sidebar-link-active" : "sidebar-link"}
                >
                  <FaReceipt /> Expense
                </NavLink>
              )}







              {/* ================= REPORTS DROPDOWN ================= */}
              <div className={`${openMenu === "sales" ? "no-scroll" : ""}`}>

                <button
                  onClick={() => toggleMenu("reports")}
                  className="sidebar-dropdown-btn"
                  style={{
                    color: isBranchReportsActive() ? "#00a76f" : "",
                    fontWeight: isBranchReportsActive() ? "600" : "500",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <FaChartLine
                      style={{
                        color: isBranchReportsActive() ? "#00a76f" : "",
                      }}
                    />
                    Reports
                  </span>

                  <FaChevronDown
                    className={`transform transition-transform ${openMenu === "reports" || openMenu === "sales" ? "rotate-180" : ""
                      }`}
                    style={{
                      color: isBranchReportsActive() ? "#00a76f" : "",
                    }}
                  />
                </button>


                {(openMenu === "reports" || openMenu === "sales") && (
                  <div className="sidebar-dropdown">

                    {/* ================= MASTER REPORTS ================= */}
                    {selectedShop && (role === "manager" || role === "megaadmin") ? (
                      <>
                        <NavLink
                          to="/master/branch-reports/stock"
                          className={isActiveLink("/master/branch-reports/stock")
                            ? "sidebar-link sidebar-link-active"
                            : "sidebar-link"}
                        >
                          <FaBoxes className="inline-block mr-2" /> Stock
                        </NavLink>

                        <NavLink
                          to="/master/branch-reports/purchase"
                          className={isActiveLink("/master/branch-reports/purchase")
                            ? "sidebar-link sidebar-link-active"
                            : "sidebar-link"}
                        >
                          <FaShoppingCart className="inline-block mr-2" /> Purchase
                        </NavLink>

                        {/* -------- SALES (MASTER) -------- */}
                        <div>
          
                         <button
                            onClick={() => toggleMenu("sales")}
                            className="sidebar-dropdown-link flex justify-between items-center"
                            style={{
                              color: isActiveLink("/master/branch-reports/sales") ? "#00a76f" : "",
                              fontWeight: isActiveLink("/master/branch-reports/sales") ? "600" : "500",
                            }}
                          >
                            <span className="flex items-center gap-2">
                              <FaFileInvoice
                                style={{
                                  color: isActiveLink("/master/branch-reports/sales") ? "#00a76f" : "",
                                }}
                              />
                              Sales
                            </span>

                            <FaChevronDown
                              className={`transform transition-transform ml-2 ${openMenu === "sales" ? "rotate-180" : ""
                                }`}
                              style={{
                                color: isActiveLink("/master/branch-reports/sales") ? "#00a76f" : "",
                              }}
                            />
                          </button>



                          {openMenu === "sales" && (
                            <div className="ml-8 mt-1">
                              <NavLink
                                to="/master/branch-reports/sales/bill-wise"
                                className={isActiveLink("/master/branch-reports/sales/bill-wise")
                                  ? "sidebar-link sidebar-link-active"
                                  : "sidebar-link"}
                              >
                                <FaFile className="inline-block mr-2" /> Bill Wise
                              </NavLink>

                              <NavLink
                                to="/master/branch-reports/sales/item-wise"
                                className={isActiveLink("/master/branch-reports/sales/item-wise")
                                  ? "sidebar-link sidebar-link-active"
                                  : "sidebar-link"}
                              >
                                <FaList className="inline-block mr-2" /> Items Wise
                              </NavLink>
                            </div>
                          )}
                        </div>

                        <NavLink
                          to="/master/branch-reports/expense"
                          className={isActiveLink("/master/branch-reports/expense")
                            ? "sidebar-link sidebar-link-active"
                            : "sidebar-link"}
                        >
                          <FaReceipt className="inline-block mr-2" /> Expense
                        </NavLink>

                        <NavLink
                          to="/master/branch-reports/collections"
                          className={isActiveLink("/master/branch-reports/collections")
                            ? "sidebar-link sidebar-link-active"
                            : "sidebar-link"}
                        >
                          <FaWallet className="inline-block mr-2" /> Collections
                        </NavLink>
                      </>
                    ) : (
                      /* ================= USER REPORTS ================= */
                      <>
                        <NavLink
                          to="/branch-reports/stock"
                          className={isActiveLink("/branch-reports/stock")
                            ? "sidebar-link sidebar-link-active"
                            : "sidebar-link"}
                        >
                          <FaBoxes className="inline-block mr-2" /> Stock
                        </NavLink>

                        <NavLink
                          to="/branch-reports/purchase"
                          className={isActiveLink("/branch-reports/purchase")
                            ? "sidebar-link sidebar-link-active"
                            : "sidebar-link"}
                        >
                          <FaShoppingCart className="inline-block mr-2" /> Purchase
                        </NavLink>

                        {/* -------- SALES (USER) -------- */}
                        <div>
                          <button
                            onClick={() => toggleMenu("sales")}
                            className="sidebar-dropdown-link flex justify-between items-center"
                            style={{
                              color: isActiveLink("/branch-reports/sales") ? "#00a76f" : "",
                              fontWeight: isActiveLink("/branch-reports/sales") ? "600" : "500",
                            }}
                          >
                            <span className="flex items-center gap-2">
                              <FaFileInvoice
                                style={{
                                  color: isActiveLink("/branch-reports/sales") ? "#00a76f" : "",
                                }}
                              />
                              Sales
                            </span>

                            <FaChevronDown
                              className={`transform transition-transform ml-2 ${openMenu === "sales" ? "rotate-180" : ""
                                }`}
                              style={{
                                color: isActiveLink("/branch-reports/sales") ? "#00a76f" : "",
                              }}
                            />
                          </button>



                          {openMenu === "sales" && (
                            <div className="ml-8 mt-1">
                              <NavLink
                                to="/branch-reports/sales/bill-wise"
                                className={isActiveLink("/branch-reports/sales/bill-wise")
                                  ? "sidebar-link sidebar-link-active"
                                  : "sidebar-link"}
                              >
                                <FaFile className="inline-block mr-2" /> Bill Wise
                              </NavLink>

                              <NavLink
                                to="/branch-reports/sales/item-wise"
                                className={isActiveLink("/branch-reports/sales/item-wise")
                                  ? "sidebar-link sidebar-link-active"
                                  : "sidebar-link"}
                              >
                                <FaList className="inline-block mr-2" /> Items Wise
                              </NavLink>
                            </div>
                          )}
                        </div>

                        <NavLink
                          to="/branch-reports/expense"
                          className={isActiveLink("/branch-reports/expense")
                            ? "sidebar-link sidebar-link-active"
                            : "sidebar-link"}
                        >
                          <FaReceipt className="inline-block mr-2" /> Expense
                        </NavLink>

                        <NavLink
                          to="/branch-reports/collections"
                          className={isActiveLink("/branch-reports/collections")
                            ? "sidebar-link sidebar-link-active"
                            : "sidebar-link"}
                        >
                          <FaWallet className="inline-block mr-2" /> Collections
                        </NavLink>
                      </>
                    )}
                  </div>
                )}
              </div>

            </>
          )}
        </nav>
      </aside>
    </>
  );
}

