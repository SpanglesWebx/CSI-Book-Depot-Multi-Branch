// // src/routes/ProtectedRoute.jsx
// import { Navigate, useLocation } from "react-router-dom";
// import { useAuth } from "../context/AuthContext";
// import { useShop } from "../context/ShopContext";

// export default function ProtectedRoute({ children, roles }) {
//   const { user, loading } = useAuth();
//   const { selectedShop } = useShop();
//   const location = useLocation();

//   if (loading) return <div>Loading...</div>; // wait before redirect

//   // if (!user) return <Navigate to="/" replace />; // Not logged in

//   // // Role check
//   // if (roles && !roles.includes(user.role)) {
//   //   return <Navigate to="/" replace />;
//   // }


//   if (!user) return <Navigate to="/" />;
// if (roles && !roles.includes(user.role)) {
//   return <Navigate to="/" />;
// }


  

//   // Shop-specific route for master
//   if (user.type === "master") {
//     const shopRoutes = [
//       "/master-sales",
//       "/master-orders",
//       "/master-addcustomer",
//       "/master/stock/add",
//       "/master/stock/min-qty",
//       "/stock/master-products",
//       "/master-dashboard",
//       "/user-dashboard",
//     ];

//     const isShopRoute = shopRoutes.some(r => location.pathname.startsWith(r));

//     if (isShopRoute && !selectedShop) {
//       // return <Navigate to="/all-shops" replace />;
//       return <Navigate to="/all-shops" />;
//     }
//   }

//   return children;
// }







import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useShop } from "../context/ShopContext";

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const { selectedShop } = useShop();
  const location = useLocation();

  // ⏳ Wait until auth loads
  if (loading) return null;

  // 🚨 Not logged in → go login (NO BACK)
  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // 🚨 Role check
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // ✅ MASTER shop route protection
  if (user.type === "master") {
    const shopRoutes = [
      "/master-sales",
      "/master-orders",
      "/master-addcustomer",
      "/master/stock/add",
      "/master/stock/min-qty",
      "/stock/master-products",
      "/user-dashboard"
    ];

    const isShopRoute = shopRoutes.some((r) =>
      location.pathname.startsWith(r)
    );

    // 🚨 If trying shop route without selecting shop
    if (isShopRoute && !selectedShop) {
      return <Navigate to="/all-shops" replace />;
    }
  }

  return children;
}