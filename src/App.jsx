// // src/App.jsx
import React, { useEffect } from "react";


import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Login from "./pages/auth/Login";


// import SessionTimeout from "./utils/SessionTimeout";
import "./utils/axiosInterceptor";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Stock/Products";
import AddStock from "./pages/Stock/AddStock";
import MinQty from "./pages/Stock/MinQty";
import SalesBill from "./pages/SalesBill";
import Orders from "./pages/Sidebar/Orders.jsx";
import AddCustomer from "./pages/AddCustomer";
import Expense from "./pages/Expense.jsx";
import AddUser from "./pages/Sidebar/AddUser";
import Maintenance from "./pages/Maintenance";
import Error404 from "./pages/Error404";
import ProtectedRoute from "./routes/ProtectedRoute";
import Shop from "./pages/Sidebar/Shop";
import AllShopsPage from "./pages/AllShopsPage.jsx";
import Purchase from "./pages/purchase/index.jsx";
import Supplier from "./pages/purchase/suppiler.jsx";
import AddPurchase from "./pages/purchase/addpurchase.jsx"

// Master routes
import MasterDashboard from "./pages/master/sidebar/MasterDashboard.jsx";
import TenantDashboard from "./pages/master/sidebar/UserDashboard.jsx";
import MasterProducts from "./pages/master/sidebar/Stock/MasterProducts.jsx";
import MasterPurchase from "./pages/master/sidebar/Stock/MasterPurchase.jsx";
import MasterAddStock from "./pages/master/sidebar/Stock/MasterAddStock.jsx";
import MasterMinQty from "./pages/master/sidebar/Stock/MasterMinQty.jsx";
import MasterSalesBill from "./pages/master/sidebar/MasterSalesBill.jsx";
import MasterOrders from "./pages/master/sidebar/MasterOrder.jsx";
import MasterAddCustomer from "./pages/master/sidebar/MasterAddCustomer.jsx";
import MasterExpense from "./pages/master/sidebar/MasterExpense.jsx";


//  Reports 
import SalesReports from "./pages/master/sidebar/Reports/SalesReports.jsx";
import TopSellingProducts from "./pages/master/sidebar/Reports/TopSellingProducts.jsx";
import LowStock from "./pages/master/sidebar/Reports/LowStock.jsx";
import ProductWiseSales from "./pages/master/sidebar/Reports/ProductWiseSales.jsx";
import InventoryReport from "./pages/master/sidebar/Reports/InventoryReport.jsx";
import RespectiveShopSales from "./pages/master/sidebar/Reports/RespectiveShopSales.jsx";



//Branch Reports

import BranchSalesBillWiseReport from "./pages/BranchReports/Sales/BillWise.jsx";
import BranchSalesItemWiseReport from "./pages/BranchReports/Sales/ItemWise.jsx";
import BranchPurchaseReport from "./pages/BranchReports/PurchaseReports.jsx";
import BranchStockReport from "./pages/BranchReports/StockReports.jsx";
import BranchExpenseReport from "./pages/BranchReports/ExpenseReports.jsx";
import BranchCollectionsReport from "./pages/BranchReports/collections/Collections.jsx";
import MasterBranchSalesBillWiseReports from "./pages/master/BranchReports/Sales/BillWise.jsx";
import MasterBranchSalesItemWiseReports from "./pages/master/BranchReports/Sales/ItemWise.jsx";
import MasterPurchaseBranchReports from "./pages/master/BranchReports/MasterPurchaseBranchReports.jsx";
import MasterStockBranchReports from "./pages/master/BranchReports/MasterStockBranchReports.jsx";
import MasterExpenseBranchReports from "./pages/master/BranchReports/MasterExpenseReports.jsx";
import MasterCollectionsBranchReports from "./pages/master/BranchReports/collections/MasterCollections.jsx";



export default function App() {

  // const [sessionExpired, setSessionExpired] = React.useState(false);


  // const handleSessionTimeout = () => {

  //   setSessionExpired(true);

  //   setTimeout(() => {

  //     localStorage.removeItem("token");
  //     localStorage.removeItem("user");

  //     window.location.href = "/";

  //   }, 2000);

  // };


  // useEffect(() => {

  //   const handleTokenExpired = () => {

  //     setSessionExpired(true);

  //     setTimeout(() => {

  //       localStorage.removeItem("token");
  //       localStorage.removeItem("user");

  //       window.location.href = "/";

  //     }, 2000);

  //   };

  //   window.addEventListener("tokenExpired", handleTokenExpired);

  //   return () => {
  //     window.removeEventListener("tokenExpired", handleTokenExpired);
  //   };

  // }, []);


  // useEffect(() => {

  //   // ❌ Disable right click
  //   const disableRightClick = (e) => {
  //     e.preventDefault();
  //   };

  //   // ❌ Disable middle click (open new tab)
  //   const disableMiddleClick = (e) => {
  //     if (e.button === 1) {
  //       e.preventDefault();
  //       e.stopPropagation();
  //     }
  //   };

  //   // ❌ Disable copy
  //   const disableCopy = (e) => {
  //     e.preventDefault();
  //   };

  //   // ❌ Disable paste
  //   const disablePaste = (e) => {
  //     e.preventDefault();
  //   };

  //   // ❌ Disable cut
  //   const disableCut = (e) => {
  //     e.preventDefault();
  //   };

  //   // ❌ Disable text selection
  //   const disableSelect = (e) => {
  //     e.preventDefault();
  //   };

  //   // ❌ Block devtools + view source + print
  //   const disableKeys = (e) => {

  //     // Print Screen
  //     if (e.key === "PrintScreen") {
  //       navigator.clipboard.writeText("");
  //       e.preventDefault();
  //     }

  //     // F12
  //     if (e.key === "F12") {
  //       e.preventDefault();
  //       return false;
  //     }

  //     // CTRL combinations
  //     if (
  //       (e.ctrlKey && e.shiftKey && ["I","J","C","K"].includes(e.key)) || // DevTools
  //       (e.ctrlKey && ["U","S","P","C","V","X","A"].includes(e.key)) // view source / copy paste
  //     ) {
  //       e.preventDefault();
  //       return false;
  //     }
  //   };

  //   document.addEventListener("contextmenu", disableRightClick);
  //   document.addEventListener("auxclick", disableMiddleClick);
  //   document.addEventListener("keydown", disableKeys);
  //   document.addEventListener("copy", disableCopy);
  //   document.addEventListener("paste", disablePaste);
  //   document.addEventListener("cut", disableCut);
  //   document.addEventListener("selectstart", disableSelect);

  //   return () => {
  //     document.removeEventListener("contextmenu", disableRightClick);
  //     document.removeEventListener("auxclick", disableMiddleClick);
  //     document.removeEventListener("keydown", disableKeys);
  //     document.removeEventListener("copy", disableCopy);
  //     document.removeEventListener("paste", disablePaste);
  //     document.removeEventListener("cut", disableCut);
  //     document.removeEventListener("selectstart", disableSelect);
  //   };

  // }, []);


  //     useEffect(() => {
  //     const TAB_KEY = "APP_SINGLE_TAB_ACTIVE";

  //     // If another tab already exists
  //     if (localStorage.getItem(TAB_KEY)) {
  //       alert("This application is already open in another tab.");

  //       // Optional: redirect or blank screen
  //       document.body.innerHTML = "<h2 style='text-align:center;margin-top:20%'>This app cannot be opened in multiple tabs.</h2>";
  //       return;
  //     }

  //     // Mark this tab as active
  //     localStorage.setItem(TAB_KEY, "true");

  //     // Remove lock when tab is closed
  //     const clearLock = () => {
  //       localStorage.removeItem(TAB_KEY);
  //     };

  //     window.addEventListener("beforeunload", clearLock);

  //     return () => {
  //       clearLock();
  //       window.removeEventListener("beforeunload", clearLock);
  //     };
  //   }, []);






  // useEffect(() => {
  //   // mark session active
  //   localStorage.setItem("isActiveSession", "true");

  //   const handleTabClose = () => {
  //     localStorage.removeItem("isActiveSession");
  //   };

  //   window.addEventListener("beforeunload", handleTabClose);

  //   return () => {
  //     window.removeEventListener("beforeunload", handleTabClose);
  //   };
  // }, []);




  return (
    <>
      {/* <SessionTimeout onTimeout={handleSessionTimeout} />

      {sessionExpired && (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="bg-white p-6 rounded shadow text-center">
        <h2 className="text-red-500 font-bold text-lg">
          Session Expired
        </h2>
        <p>Please login again...</p>
      </div>
    </div>
  )} */}

      <Routes>
        {/* Auth */}
        <Route path="/" element={<Login />} />

        {/* Protected layout */}
        <Route element={<MainLayout />}>
          {/* General routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={["megaadmin", "manager", "user"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock/products"
            element={
              <ProtectedRoute roles={["megaadmin", "manager", "user"]}>
                <Products />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock/add"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <AddStock />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock/min-qty"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <MinQty />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <SalesBill />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <Orders />
              </ProtectedRoute>
            }
          />

          <Route
            path="/stock/purchase"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <Purchase />
              </ProtectedRoute>
            }
          />


          <Route
            path="/stock/purchase/Add"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <AddPurchase />
              </ProtectedRoute>
            }
          />

          <Route
            path="stock/purchase/supplier"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <Supplier />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add-customer"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <AddCustomer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/expense"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                < Expense />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add-user"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <AddUser />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shops"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <Shop />
              </ProtectedRoute>
            }
          />
          <Route
            path="/all-shops"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <AllShopsPage />
              </ProtectedRoute>
            }
          />





          {/* Master routes */}
          <Route
            path="/master-dashboard"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <MasterDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user-dashboard"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <TenantDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock/master-products"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <MasterProducts />
              </ProtectedRoute>
            }
          />

          <Route
            path="/stock/master-purchase"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <MasterPurchase />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master/stock/add"
            element={
              <ProtectedRoute roles={["manager", "megaadmin"]}>
                <MasterAddStock />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master/stock/min-qty"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <MasterMinQty />
              </ProtectedRoute>
            }
          />
          {/* <Route
          path="/master-sales"
          element={
            <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
              <MasterSalesBill />
            </ProtectedRoute>
          }
        /> */}
          <Route
            path="/master-sales/:shopId?"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <MasterSalesBill />
              </ProtectedRoute>
            }
          />

          <Route
            path="/master-orders"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <MasterOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master-addcustomer"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <MasterAddCustomer />
              </ProtectedRoute>
            }
          />

          <Route
            path="/master-expense"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <MasterExpense />
              </ProtectedRoute>
            }
          />



          {/* ✅ Reports Routes */}
          <Route
            path="/reports/sales"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <SalesReports />
              </ProtectedRoute>
            }
          />


          {/* 👇 New route for respective shop sales bills */}
          <Route
            path="/reports/sales/shop/:shopname"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <RespectiveShopSales />
              </ProtectedRoute>
            }
          />




          <Route
            path="/reports/top-products"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <TopSellingProducts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/low-stock"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <LowStock />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/product-sales"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <ProductWiseSales />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/inventory"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <InventoryReport />
              </ProtectedRoute>
            }
          />




          {/* Branch Reports */}



          <Route
            path="/master/branch-reports/sales/bill-wise"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <MasterBranchSalesBillWiseReports />
              </ProtectedRoute>
            }
          />


          <Route
            path="/master/branch-reports/sales/item-wise"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <MasterBranchSalesItemWiseReports />
              </ProtectedRoute>
            }
          />

          <Route
            path="/master/branch-reports/purchase"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <MasterPurchaseBranchReports />
              </ProtectedRoute>
            }
          />

          <Route
            path="/master/branch-reports/stock"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <MasterStockBranchReports />
              </ProtectedRoute>
            }
          />

          <Route
            path="/master/branch-reports/expense"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <MasterExpenseBranchReports />
              </ProtectedRoute>
            }
          />

          <Route
            path="/master/branch-reports/collections"
            element={
              <ProtectedRoute roles={["megaadmin", "manager"]}>
                <MasterCollectionsBranchReports />
              </ProtectedRoute>
            }
          />






          <Route
            path="/branch-reports/sales/bill-wise"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <BranchSalesBillWiseReport />
              </ProtectedRoute>
            }
          />


          <Route
            path="/branch-reports/sales/item-wise"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <BranchSalesItemWiseReport />
              </ProtectedRoute>
            }
          />



          <Route
            path="/branch-reports/purchase"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <BranchPurchaseReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/branch-reports/stock"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <BranchStockReport />
              </ProtectedRoute>
            }
          />

          <Route
            path="/branch-reports/expense"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <BranchExpenseReport />
              </ProtectedRoute>
            }
          />

          <Route
            path="/branch-reports/collections"
            element={
              <ProtectedRoute roles={["manager", "user", "megaadmin"]}>
                <BranchCollectionsReport />
              </ProtectedRoute>
            }
          />



          {/* Maintenance */}
          <Route path="/maintenance" element={<Maintenance />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Error404 />} />


      </Routes>




      <ToastContainer position="top-right" autoClose={3000} />

    </>

  );
}
