import React, { useEffect, useRef } from "react";

export default function CustomerViewModal({ customer, onClose }) {
  const ref = useRef(null);

  if (!customer) return null;

  // Fade + scale animation (Supplier standard)
  useEffect(() => {
    const el = ref.current;
    el.style.opacity = 0;
    el.style.transform = "scale(0.98)";
    requestAnimationFrame(() => {
      el.style.transition = "0.25s ease";
      el.style.opacity = 1;
      el.style.transform = "scale(1)";
    });
  }, []);

  /* ---- Standard View Modal Styles ---- */
  const container = {
    width: "100%",
    maxWidth: "600px",
    padding: "24px 28px",
  };

  const headerRow = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  };

  const title = {
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#222",
  };

  const closeBtn = {
    fontSize: "22px",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#777",
  };

  const row = {
    display: "flex",
    justifyContent: "space-between",
    padding: "14px 0",
    borderBottom: "1px solid #e6e6e6",
  };

  const keyStyle = {
    fontWeight: 600,
    color: "#444",
    width: "35%",
  };

  const valueStyle = {
    width: "60%",
    textAlign: "left",
    color: "#222",
    fontWeight: 500,
    wordBreak: "break-word",
  };

  const active =
    (customer.status ?? "active").toLowerCase() !== "inactive";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div ref={ref} style={container} className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div style={headerRow}>
          <h2 style={title}>Customer Details</h2>
          <button style={closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Key–Value Rows */}
        <div>
          <div style={row}>
            <span style={keyStyle}>Name</span>
            <span style={valueStyle}>{customer.name || "-"}</span>
          </div>

          <div style={row}>
            <span style={keyStyle}>Mobile</span>
            <span style={valueStyle}>{customer.mobile || "-"}</span>
          </div>

          <div style={row}>
            <span style={keyStyle}>Address</span>
            <span style={valueStyle}>{customer.address || "-"}</span>
          </div>

          <div style={row}>
            <span style={keyStyle}>Status</span>
            <span
              style={{
                ...valueStyle,
                color: active ? "#16a34a" : "#dc2626",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              {active ? "ACTIVE" : "INACTIVE"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
