// src/context/StockContext.jsx
import React, { createContext, useState } from "react";

export const StockContext = createContext({
  refreshFlag: false,
  triggerRefresh: () => {},
});

export const StockProvider = ({ children }) => {
  const [refreshFlag, setRefreshFlag] = useState(false);
  const triggerRefresh = () => setRefreshFlag((s) => !s);

  return (
    <StockContext.Provider value={{ refreshFlag, triggerRefresh }}>
      {children}
    </StockContext.Provider>
  );
};
