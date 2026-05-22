

// src/layouts/MainLayouts.jsx
import { useState, useEffect } from "react";
import { useLocation, Outlet, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopNavbar from "../components/Navbar";
import { useShop } from "../context/ShopContext";
import { useAuth } from "../context/AuthContext";
import { FaArrowLeft } from "react-icons/fa";

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  const hideLayout = ["/login", "/register"].includes(location.pathname);

  const { selectedShop, setSelectedShop, setTenantData } = useShop();
  const { user } = useAuth();



  const handleExitShop = () => {
    try {
      // Clear all tenant/shop-specific states
      setSelectedShop(null);
      setTenantData(null);

      // Clean up localStorage
      localStorage.removeItem("selectedShop");
      localStorage.setItem("exitShop", "true");

      // Optional: If you want to ensure the next reload starts clean
      // sessionStorage.clear();

      // localStorage.clear()


      // Close modal and navigate to dashboard
      setShowExitModal(false);
      navigate("/master-dashboard");
    } catch (err) {
      console.error("Failed to exit shop:", err);
    }
  };




  useEffect(() => {
    // push state on every route change
    window.history.pushState(null, "", window.location.href);

    const handleBack = () => {
      // 🚫 block back
      window.history.pushState(null, "", window.location.href);

      // 🔥 force stay on same page
      navigate(location.pathname, { replace: true });
    };

    window.addEventListener("popstate", handleBack);

    return () => {
      window.removeEventListener("popstate", handleBack);
    };
  }, [location.pathname, navigate]);


  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {!hideLayout && (
        <>
          {/* Overlay */}
          <div
            className={`fixed inset-0 bg-black bg-opacity-0 z-40 lg:hidden transition-opacity duration-300 ease-in-out ${sidebarOpen ? "bg-opacity-50 visible" : "invisible"
              }`}
            onClick={() => setSidebarOpen(false)}
          ></div>

          {/* Sidebar */}
          <aside
            className={`bg-white h-full shadow-lg w-64 lg:static fixed z-50 inset-y-0 left-0
              transform transition-transform duration-300 ease-in-out
              flex flex-col pr-6 py-6 pl-0
              ${sidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"}
              lg:translate-x-0 lg:opacity-100`}
          >
            <Sidebar
              closeSidebar={() => setSidebarOpen(false)}
              onExitShopClick={() => setShowExitModal(true)}
            />
          </aside>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!hideLayout && <TopNavbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />}

        <main
          className={`flex-1 overflow-y-auto transition-all duration-300 ${hideLayout ? "flex items-center justify-center" : "pt-24"
            } p-4 sm:p-6 md:p-8 lg:p-12`}
        >
          <Outlet />
        </main>
      </div>

      {/* Exit Shop Modal */}
      {showExitModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-[9999]">
          <div className="bg-white rounded-lg p-6 max-w-xs w-full text-center relative">
            <div className="flex justify-center mb-4">
              <FaArrowLeft className="text-red-500 text-2xl" />
            </div>

            <h2 className="text-lg font-bold mb-2">Exit Shop</h2>
            <p className="text-gray-700 mb-6">
              Are you sure you want to exit{" "}
              <span className="font-semibold text-green-700">{selectedShop?.shopname}</span> branch?
            </p>


            <div className="flex justify-center gap-4">

              <button
                onClick={() => setShowExitModal(false)}
                className="px-4 py-2 rounded border border-red-500 bg-white text-red-600 hover:border-red-700 hover:bg-red-50 transition-colors duration-200"
              >
                Cancel
              </button>

              <button
                onClick={handleExitShop}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-green-800"
              >
                Yes, Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
