


// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();


export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [masterToken, setMasterToken] = useState(null);
  const [tenantToken, setTenantToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Restore auth state from localStorage
  // useEffect(() => {
  //   const storedUser = localStorage.getItem("user");
  //   const storedMasterToken = localStorage.getItem("masterToken");
  //   const storedTenantToken = localStorage.getItem("tenantToken");

  //   if (storedUser) setUser(JSON.parse(storedUser));
  //   if (storedMasterToken) setMasterToken(storedMasterToken);
  //   if (storedTenantToken) setTenantToken(storedTenantToken);

  //   setLoading(false);
  // }, []);



  // useEffect(() => {
  //   const isActiveSession = localStorage.getItem("isActiveSession");

  //   const storedUser = localStorage.getItem("user");
  //   const storedMasterToken = localStorage.getItem("masterToken");
  //   const storedTenantToken = localStorage.getItem("tenantToken");

  //   if (!isActiveSession) {
  //     // ❌ previous session ended → force logout
  //     localStorage.removeItem("user");
  //     localStorage.removeItem("masterToken");
  //     localStorage.removeItem("tenantToken");
  //     localStorage.removeItem("selectedShop");

  //     setUser(null);
  //   } else {
  //     // ✅ normal restore
  //     if (storedUser) setUser(JSON.parse(storedUser));
  //     if (storedMasterToken) setMasterToken(storedMasterToken);
  //     if (storedTenantToken) setTenantToken(storedTenantToken);
  //   }

  //   setLoading(false);
  // }, []);



useEffect(() => {
  const lastUnload = localStorage.getItem("lastUnloadTime");

  // ⏱️ check time difference
  const isTabClose =
    lastUnload && Date.now() - Number(lastUnload) > 2000;

  if (isTabClose) {
    // 🔥 logout
    localStorage.removeItem("user");
    localStorage.removeItem("masterToken");
    localStorage.removeItem("tenantToken");
    localStorage.removeItem("selectedShop");

    setUser(null);
    setMasterToken(null);
    setTenantToken(null);

    setLoading(false);
    return;
  }

  // ✅ normal restore (refresh case)
  const storedUser = localStorage.getItem("user");
  const storedMasterToken = localStorage.getItem("masterToken");
  const storedTenantToken = localStorage.getItem("tenantToken");

  if (storedUser) setUser(JSON.parse(storedUser));
  if (storedMasterToken) setMasterToken(storedMasterToken);
  if (storedTenantToken) setTenantToken(storedTenantToken);

  setLoading(false);
}, []);


  const login = (userData, token) => {
    localStorage.setItem("user", JSON.stringify(userData));
    if (userData.type === "master") {
      localStorage.setItem("masterToken", token);
      setMasterToken(token);
    } else {
      localStorage.setItem("tenantToken", token);
      setTenantToken(token);
    }
    setUser(userData);
  };

  // ✅ Fixed logout: clear all shop data and set global flag
  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("masterToken");
    localStorage.removeItem("tenantToken");
    localStorage.removeItem("selectedShop"); // clear last shop
    localStorage.setItem("exitShop", "true"); // mark for global nav next load

    setUser(null);
    setMasterToken(null);
    setTenantToken(null);
  };

  useEffect(() => {
    const handleAutoLogout = () => {
      logout();
      navigate("/");
    };

    window.addEventListener("autoLogout", handleAutoLogout);

    return () => {
      window.removeEventListener("autoLogout", handleAutoLogout);
    };
  }, []);






  // ✅ SET SESSION FLAG IMMEDIATELY (runs before React effects)
  if (!localStorage.getItem("isActiveSession")) {
    localStorage.setItem("isActiveSession", "true");
  }

  // useEffect(() => {
  //   const handleUnload = () => {
  //     localStorage.removeItem("isActiveSession");
  //   };

  //   window.addEventListener("beforeunload", handleUnload);

  //   return () => {
  //     window.removeEventListener("beforeunload", handleUnload);
  //   };
  // }, []);



  // useEffect(() => {
  //   const handleUnload = () => {
  //     // ✅ ONLY mark session ended
  //     localStorage.removeItem("isActiveSession");



  //     // ✅ notify other tabs
  //     localStorage.setItem("logout", Date.now());
  //   };

  //   window.addEventListener("beforeunload", handleUnload);

  //   return () => {
  //     window.removeEventListener("beforeunload", handleUnload);
  //   };
  // }, []);



useEffect(() => {
  const handleUnload = () => {
    // mark time when leaving
    localStorage.setItem("lastUnloadTime", Date.now());
  };

  window.addEventListener("beforeunload", handleUnload);

  return () => {
    window.removeEventListener("beforeunload", handleUnload);
  };
}, []);






  useEffect(() => {
    const syncLogout = (e) => {
      if (e.key === "logout") {
        // ✅ clear state
        setUser(null);
        setMasterToken(null);
        setTenantToken(null);

        // ✅ redirect to login
        navigate("/");
      }
    };

    window.addEventListener("storage", syncLogout);

    return () => {
      window.removeEventListener("storage", syncLogout);
    };
  }, []);

  const getToken = () => (user?.type === "master" ? masterToken : tenantToken);
  const getMasterToken = () => masterToken;
  const getTenantToken = () => tenantToken;

  return (
    <AuthContext.Provider
      value={{
        user,
        masterToken,
        tenantToken,
        getToken,
        getMasterToken,
        getTenantToken,
        login,
        logout,
        loading,
      }}
    >
      {!loading && children} {/* Render children only after auth restored */}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);


