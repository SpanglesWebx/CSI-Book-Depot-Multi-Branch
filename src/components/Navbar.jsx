
// src/components/Navbar.jsx
import React, { useEffect, useState, useRef } from "react";
import { FaBars, FaUserCircle, FaExclamationTriangle, FaSignOutAlt } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useShop } from "../context/ShopContext";
import logo from "../assets/logo-icon.png";

export default function Navbar({ toggleSidebar }) {
  const { user, logout } = useAuth();
  const { selectedShop, setSelectedShop } = useShop();

  const [displayName, setDisplayName] = useState("CSI Diocese Book Depot");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const dropdownRef = useRef(null);

  
  useEffect(() => {
    const defaultText = "CSI Diocese Book Depot";
    if (!user) {
      setDisplayName(`<span style="color:#29bb88;">${defaultText}</span>`);
      return;
    }

    const roleLower = user.role?.toLowerCase();
    let fullText = defaultText;
    let shopDesignation = "";
    let shopname = "";

    if (roleLower === "manager" || roleLower === "megaadmin") {
      fullText = defaultText;
    } else if (roleLower === "user") {
      const shop = selectedShop || JSON.parse(localStorage.getItem("selectedShop")) || {};
      shopname = shop.shopname || user?.shopname || user?.shop?.shopname || "";
      const designation = shop.designation || user?.designation || "";
      if (shopname) {
        fullText = `CSI Diocese Book Depot - ${shopname}`;
        if (designation) shopDesignation = designation;
      }
    }

   
    let styled = `<span style="color: #00A76F;">CSI Diocese Book Depot</span>`;
    if (shopname) {
      styled += ` <span style="color:#29bb88 ;">- ${shopname}</span>`;
    }
    if (shopDesignation) {
      styled += ` <span>${shopDesignation}</span>`;
    }

    setDisplayName(styled);
  }, [user, selectedShop]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogoutClick = () => {
    setShowUserDropdown(false);
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    localStorage.removeItem("selectedShop");
    localStorage.setItem("exitShop", "true");
    setSelectedShop(null);
    logout();
      window.location.replace("/");
  };



  return (
    <header
      className="shadow-md w-full fixed top-0 left-0 z-50 h-16 flex items-center px-4 md:px-8 justify-between"
      style={{
        background: "linear-gradient(320deg, rgba(211, 252, 210, 0.7) 0%, #ffffff 70%)",
      }}
    >
      {/* Mobile Menu */}
      <button className="text-green-600 hover:text-green-800 md:hidden" onClick={toggleSidebar}>
        <FaBars size={22} />
      </button>

      {/* Logo + Title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <img src={logo} alt="Logo" className="h-10 w-10 object-contain flex-shrink-0" />

        <h1
          className="text-lg sm:text-xl font-semibold truncate"
          style={{ fontWeight: "1000" }}
          dangerouslySetInnerHTML={{ __html: displayName }}
        />
      </div>

      {/* User Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          className="text-green-600 hover:text-green-800 text-2xl"
          onClick={() => setShowUserDropdown(!showUserDropdown)}
          aria-haspopup="true"
          aria-expanded={showUserDropdown}
        >
          <FaUserCircle />
        </button>

        {showUserDropdown && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50 transition-transform transform origin-top-right animate-fade-in">
            <div className="px-4 py-2 border-b border-gray-200">
              <p className="font-semibold truncate">{user?.username}</p>
              <p className="text-sm text-gray-500 truncate">{user?.role}</p>
            </div>
            <button
              onClick={handleLogoutClick}
              className="w-full text-left px-4 py-2 hover:text-red-600 text-green-600 font-semibold flex items-center gap-2"
            >
              <FaSignOutAlt /> Logout
            </button>
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
          <div className="bg-white rounded-lg shadow-lg w-11/12 sm:w-96 p-6 text-center relative">
            <FaSignOutAlt className="text-red-600 text-4xl mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">Are you sure you want to logout?</h2>
            <p className="text-gray-600 mb-6">You will be logged out from the system.</p>
            <div className="flex justify-center gap-4 flex-wrap">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 rounded border border-red-500 bg-white text-red-600 hover:bg-red-50 hover:border-red-700 transition-colors duration-200"
              >
                Cancel
              </button>

              <button
                onClick={confirmLogout}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-green-700"
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}



