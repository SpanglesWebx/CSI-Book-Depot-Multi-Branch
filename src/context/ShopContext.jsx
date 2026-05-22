// src/context/ShopContext.jsx
import { createContext, useContext, useState, useEffect } from "react";

export const ShopContext = createContext();

export const ShopProvider = ({ children }) => {
  const [selectedShop, setSelectedShop] = useState(null);
  const [tenantData, setTenantData] = useState(null);
  const [loadingTenantData, setLoadingTenantData] = useState(false);

  // ✅ Restore shop context from localStorage
  useEffect(() => {
    const exitFlag = localStorage.getItem("exitShop");
    const currentUser = JSON.parse(localStorage.getItem("user"));

    // Don’t restore shop if user exited or logged out
    if (exitFlag === "true" || !currentUser) {
      setSelectedShop(null);
      return;
    }

    // Restore previously selected shop
    const storedShop = localStorage.getItem("selectedShop");
    if (storedShop) {
      try {
        setSelectedShop(JSON.parse(storedShop));
      } catch (err) {
        console.warn("⚠️ Failed to parse selectedShop from localStorage:", err);
      }
    }
  }, []);

  // ✅ Keep shop in sync with localStorage
  useEffect(() => {
    if (selectedShop) {
      localStorage.setItem("selectedShop", JSON.stringify(selectedShop));
      localStorage.removeItem("exitShop"); // clear exit flag once shop selected
    }
  }, [selectedShop]);

  return (
    <ShopContext.Provider
      value={{
        selectedShop,
        setSelectedShop,
        tenantData,
        setTenantData,
        loadingTenantData,
        setLoadingTenantData,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => useContext(ShopContext);
