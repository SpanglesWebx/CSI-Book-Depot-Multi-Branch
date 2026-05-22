// src/components/ViewOnlySaleModal.jsx
import React from "react";
import { FaMoneyBillWave, FaMobileAlt, FaExchangeAlt, FaCheckCircle, FaTimesCircle, FaEye } from "react-icons/fa";
import DeviceInfoModal from "../components/DeviceInfoModal";



export default function ViewOnlySaleModal({
  showModal,
  onClose,
  meta = {},
  rows = [],
  movements = [],
  totals = {},
  selectedShop = {},   // ← ADDED
  titlePrefix = "View Bill",
  paymentMethod = "cash",
  payment = { cash: 0, upi: 0 },
  loggedInUser,
  bill,
}) {

  console.log("SELECTED SHOP DEBUG ===>", selectedShop);

  if (!showModal) return null;

  /* ----------------------------- Helpers ----------------------------- */

  const fmt = (v) => Number(v || 0).toFixed(2);

  const [showDeviceModal, setShowDeviceModal] = React.useState(false);
  const [selectedBillForDevice, setSelectedBillForDevice] = React.useState(null);


  React.useEffect(() => {
    if (showDeviceModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [showDeviceModal]);


  const formatDate = (iso) => {
    if (!iso) return "";
    try {
      const d = typeof iso === "string" && iso.indexOf("T") === -1 &&
        /^\d{4}-\d{2}-\d{2}$/.test(iso)
        ? new Date(iso + "T00:00:00")
        : new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString("en-GB");
    } catch {
      return "";
    }
  };

  const computeRowValue = (r) => {
    const rate = Number(r.rate || 0);
    const qty = Number(r.qty || 0);
    if (r.value !== undefined && r.value !== null && r.value !== "") {
      const v = Number(r.value);
      if (!isNaN(v)) return v;
    }
    return +(rate * qty).toFixed(2);
  };

  const computeRowgstvalue = (r) => {
    const qty = Number(r.qty || 0);
    const rate = Number(r.rate || 0);
    const gst = Number(r.gst || 0);
    const isIncl = r.isInclusive === true;
    if (isIncl) return 0;
    const taxable = rate * qty;
    const gstValue = taxable * (gst / 100);
    return +gstValue.toFixed(2);
  };

  const computeGSTSummary = () => {
    const gstSummary = {};
    rows.forEach((r) => {
      const gstRate = Number(r.gst || 0);
      if (gstRate <= 0) return;
      const rate = Number(r.rate || 0);
      const qty = Number(r.qty || 0);
      if (qty <= 0 || rate <= 0) return;

      let taxable = 0;
      let gstAmt = 0;

      if (r.isInclusive === false) {
        taxable = +(rate * qty).toFixed(2);
        gstAmt = +(taxable * gstRate / 100).toFixed(2);
      } else {
        taxable = +(rate * qty / (1 + gstRate / 100)).toFixed(2);
        gstAmt = +((rate * qty) - taxable).toFixed(2);
      }

      gstSummary[gstRate] = (gstSummary[gstRate] || 0) + gstAmt;
    });

    return Object.keys(gstSummary)
      .map(Number)
      .sort((a, b) => a - b)
      .map((r) => [r, gstSummary[r]]);
  };

  const gstSummary = computeGSTSummary();
  const displayRows = rows;

  const getQtyMovementSummary = (row, movements = []) => {
    if (!Array.isArray(movements)) return null;

    const related = movements.filter(
      (m) => m.code === row.code && m.batch === row.batch
    );

    if (!related.length) return null;

    // Sold qty = earliest oldQty
    const soldQty = related
      .slice()
      .sort((a, b) => new Date(a.at) - new Date(b.at))[0]
      .oldQty;

    // Returns
    const returnQty = related
      .filter((m) => m.reason === "return" && m.deltaQty < 0)
      .reduce((s, m) => s + Math.abs(m.deltaQty), 0);

    // Manager increase
    const managerIncrease = related
      .filter((m) => m.reason === "edit-qty" && m.deltaQty > 0)
      .reduce((s, m) => s + m.deltaQty, 0);

    // Row / Bill cancel
    const cancelQty = related
      .filter(
        (m) =>
          (m.reason === "row-cancel" || m.reason === "bill-cancel") &&
          m.deltaQty < 0
      )
      .reduce((s, m) => s + Math.abs(m.deltaQty), 0);

    if (!returnQty && !managerIncrease && !cancelQty) return null;

    return {
      soldQty,
      returnQty,
      managerIncrease,
      cancelQty,
    };
  };





  const openBillPrintWindow = (meta, rows, totals, selectedShop) => {

    const fmt = (v) => Number(v || 0).toFixed(2);
    const formatDate = (iso) => new Date(iso).toLocaleDateString("en-GB");
    const formatTime = (iso) =>
      new Date(iso).toLocaleTimeString("en-US", { hour12: true });

    const itemsHtml = rows
      .map(
        (r) => `
      <div style="display:flex;font-size:10px;padding:1px 0;">
        <span style="flex:3;text-align:left;">${r.name}</span>
        <span style="flex:1;text-align:center;">${r.batch}</span>
        <span style="flex:1;text-align:right;">${fmt(r.mrp)}</span>
        <span style="flex:1;text-align:right;">${fmt(r.rate)}</span>
        <span style="flex:0.8;text-align:right;">${r.qty}</span>
        <span style="flex:1.2;text-align:right;">${fmt(r.value)}</span>
      </div>
    `
      )
      .join("");

    let totalGST = 0;
    const gstSummary = {};
    rows.forEach((r) => {
      const gstRate = Number(r.gst || 0);
      const qty = Number(r.qty || 0);
      const rate = Number(r.rate || 0);
      if (!gstRate || !qty || !rate) return;

      const inclusive = r.isInclusive !== false;
      const gross = rate * qty;
      const taxable = inclusive ? gross / (1 + gstRate / 100) : gross;
      const gstAmt = inclusive ? gross - taxable : taxable * (gstRate / 100);

      totalGST += gstAmt;
      gstSummary[gstRate] = (gstSummary[gstRate] || 0) + gstAmt;
    });

    const gstHtml = Object.keys(gstSummary)
      .map(
        (rate) => `
      <div style="display:flex;justify-content:space-between;font-size:10px;">
        <span>${rate}%</span>
        <span>${gstSummary[rate].toFixed(2)}</span>
      </div>
    `
      )
      .join("");

    const html = `
<html>
<head>
<meta charset="UTF-8" />
<style>
@page { size: 76mm auto; margin: 0; }
body { width: 76mm; font-family: Arial; margin: 0; padding: 2mm; color: #000; }
hr { border: 0.5px dashed #000; margin: 4px 0; }
</style>
</head>

<body>

  <div style="text-align:center;margin-bottom:6px;">
    <img src="/logo-icon.png" width="40" />
    <div style="font-weight:600;color:#006400;">CSI Diocese Book Depot</div>
    <div style="font-weight:600;color:#006400;">${selectedShop?.shopname || ""}</div>

    <div style="font-size:10px;">${selectedShop?.address || ""}</div>
    <div style="font-size:10px;">Phone: ${selectedShop?.contact || "N/A"}</div>
  </div>

  <div style="text-align:center;font-weight:700;font-size:12px;color:#006400;margin:4px 0;">
    BILL
  </div>

  <div style="display:flex;justify-content:space-between;font-size:10px;">
    <div>Bill No: ${meta.billNo}</div>
    <div>
      <div>Date: ${formatDate(meta.date)}</div>
      <div>Time: ${formatTime(meta.date)}</div>
    </div>
  </div>

  <hr />

  <div style="display:flex;font-size:10px;font-weight:700;color:#006400;">
    <span style="flex:3;">Product Name</span>
    <span style="flex:1;text-align:center;">Batch</span>
    <span style="flex:1;text-align:right;">MRP</span>
    <span style="flex:1;text-align:right;">Rate</span>
    <span style="flex:0.8;text-align:right;">Qty</span>
    <span style="flex:1.2;text-align:right;">Value</span>
  </div>

  <hr />

  ${itemsHtml}

  <hr />

  <div style="display:flex;font-size:10px;font-weight:700;">
    <span style="flex:3;text-align:center;">TOTAL</span>
    <span style="flex:1"></span>
    <span style="flex:1"></span>
    <span style="flex:1"></span>
    <span style="flex:0.8;text-align:right;">
      ${rows.reduce((a, c) => a + Number(c.qty), 0)}
    </span>
    <span style="flex:1.2;text-align:right;">
      ${rows.reduce((a, c) => a + Number(c.value), 0).toFixed(2)}
    </span>
  </div>

  <hr />

<!-- GST Header Row -->
<div style="display:flex;font-size:10px;font-weight:700;color:#006400;">
  <span style="flex:1;text-align:left;">GST%</span>
  <span style="flex:1;text-align:right;">GST Value</span>
  <span style="flex:1;text-align:right;">CGST</span>
  <span style="flex:1;text-align:right;">SGST</span>
  <span style="flex:1;text-align:right;">GST</span>
</div>
<hr />

<!-- GST Rate Rows (Dynamic) -->
${Object.keys(gstSummary)
        .map(rate => {
          const gstValue = gstSummary[rate];
          const cgst = gstValue / 2;
          const sgst = gstValue / 2;
          const total = gstValue;

          return `
      <div style="display:flex;font-size:10px;">
        <span style="flex:1;text-align:left;">${rate}%</span>
        <span style="flex:1;text-align:right;">${gstValue.toFixed(2)}</span>
        <span style="flex:1;text-align:right;">${cgst.toFixed(2)}</span>
        <span style="flex:1;text-align:right;">${sgst.toFixed(2)}</span>
        <span style="flex:1;text-align:right;">${total.toFixed(2)}</span>
      </div>
      
    `;
        })
        .join("")}

  <hr />

<!-- GST Total Row -->
<div style="display:flex;font-size:10px;font-weight:700;">
  <span style="flex:1;text-align:left;">Total</span>
  <span style="flex:1;text-align:right;">${totalGST.toFixed(2)}</span>
  <span style="flex:1;text-align:right;">${(totalGST / 2).toFixed(2)}</span>
  <span style="flex:1;text-align:right;">${(totalGST / 2).toFixed(2)}</span>
  <span style="flex:1;text-align:right;">${totalGST.toFixed(2)}</span>
</div>



  <hr />

  <div style="font-size:11px;font-weight:600;">
    <div style="display:flex;justify-content:space-between;">
      <span>Total Amount:</span><span>${fmt(totals.total)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span>Net Amount:</span><span>${fmt(totals.netAmount)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span>Cash Given:</span><span>${fmt(totals.cashGiven)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span>Balance:</span><span>${fmt(totals.balance)}</span>
    </div>
  </div>

  <hr />

  <div style="text-align:center;color:#006400;font-weight:700;margin-top:10px;">
    GOD IS OUR REFUGE AND STRENGTH
  </div>

  <script>
    window.onload = () => setTimeout(() => window.print(), 200);
  </script>

</body>
</html>
`;

    const win = window.open("", "_blank", "width=400,height=600");
    win.document.write(html);
    win.document.close();
  };

  /* ----------------------------- UI ----------------------------- */

  const viewBoxClass =
    "!w-[245px] !md:w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none transition duration-200 placeholder-gray-400";

  const viewBoxStyle = {
    display: "inline-block",
    minHeight: 32,
    lineHeight: "32px",
    padding: "0 0.5rem",
    background: "#fff",
  };

  return (
    <div className="modal fade-in" role="dialog" aria-modal="true">
      {/* <div className="modal-content slide-up large" style={{ maxWidth: 1400 }}> */}

      <div
        className="modal-content slide-up large"
        style={{
          maxWidth: 1400,
          overflowY: showDeviceModal ? "hidden" : "auto",
          maxHeight: "90vh",
        }}
      >


        {/* HEADER */}
        {/* <div className="modal-header">
          <h2>{titlePrefix}</h2>



          {["manager", "megaadmin"].includes(loggedInUser?.role) && (
            <button
              onClick={() => {
                setSelectedBillForDevice(bill);
                setShowDeviceModal(true);
              }}
              title="View Device Info"
              style={{
                border: "none",
                backgroundColor: "#00A76F",
                color: "#fff",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#007867")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#00A76F")
              }
            >
              <FaEye />
            </button>
          )}

       


          <button
            className="icon-close"
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 28,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div> */}


        <div className="modal-header" style={{ display: "flex", alignItems: "center" }}>
          <h2 style={{ flex: 1 }}>{titlePrefix}</h2>

          {/* RIGHT ACTIONS */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

            {/* 👁 DEVICE INFO (MANAGER / MEGAADMIN ONLY) */}
            {["manager", "megaadmin"].includes(loggedInUser?.role) && (
              <button
                onClick={() => {
                  setSelectedBillForDevice(bill);
                  setShowDeviceModal(true);
                }}
                title="View Device Info"
                style={{
                  border: "none",
                  backgroundColor: "#00A76F",
                  color: "#fff",
                  padding: "0.45rem 0.65rem",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  display: "flex",
                  alignItems: "center",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#007867")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#00A76F")
                }
              >
                <FaEye />
              </button>
            )}

            {/* ❌ CLOSE */}
            <button
              className="icon-close"
              onClick={onClose}
              aria-label="Close"
              style={{
                border: "none",
                background: "transparent",
                fontSize: 28,
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>




        <DeviceInfoModal
          show={showDeviceModal}
          onClose={() => setShowDeviceModal(false)}
          bill={selectedBillForDevice}
        />

        {/* BILL META */}
        <div className="bill-meta" style={{ padding: "0.75rem 1rem" }}>
          <div
            className="meta-row"
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#666" }}>Counter</span>
              <div
                className={viewBoxClass}
                style={{ ...viewBoxStyle, background: "#f8f8f8", width: "100px" }}
              >
                {meta.counter}
              </div>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#666" }}>Bill No</span>
              <div
                className={viewBoxClass}
                style={{ ...viewBoxStyle, background: "#f8f8f8", width: "300px" }}
              >
                {meta.billNo}
              </div>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#666" }}>Date</span>
              <div
                className={viewBoxClass}
                style={{ ...viewBoxStyle, width: 300 }}
              >
                {formatDate(meta.date)}
              </div>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 12, color: "#666" }}>Customer Name</span>
              <div className={viewBoxClass} style={viewBoxStyle}>
                {meta.customerName}
              </div>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#666" }}>Mobile</span>
              <div
                className={viewBoxClass}
                style={{ ...viewBoxStyle, width: 200 }}
              >
                {meta.mobile}
              </div>
            </label>
          </div>
        </div>

        {/* ITEMS TABLE */}
        <div style={{ padding: "0 1rem" }}>
          <table
            className="salesbill-table clean full-width"
            style={{
              tableLayout: "fixed",
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th style={{ width: "40px", padding: "0.5rem" }}>S.No</th>
                <th style={{ width: "132px", padding: "0.5rem" }}>Product Code</th>
                <th style={{ width: "190px", padding: "0.5rem" }}>Product Name</th>
                <th style={{ width: "180px", padding: "0.5rem" }}>Batch</th>
                <th style={{ width: "95px", textAlign: "center" }}>Status</th>
                <th style={{ width: "100px", padding: "0.5rem", textAlign: "right" }}>MRP</th>
                <th style={{ width: "90px", padding: "0.5rem", textAlign: "right" }}>Rate</th>
                <th style={{ width: "80px", padding: "0.5rem", textAlign: "right" }}>GST%</th>
                <th style={{ width: "150px", padding: "0.5rem", textAlign: "right" }}>Qty</th>
                <th style={{ width: "120px", padding: "0.5rem", textAlign: "right" }}>GST Value</th>
                <th style={{ width: "120px", padding: "0.5rem", textAlign: "right" }}>Amount</th>
              </tr>
            </thead>

            <tbody>
              {displayRows.length ? (
                displayRows.map((row, index) => (
                  <React.Fragment key={index}>
                    <tr style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                      <td style={{ padding: "0.5rem" }}>{index + 1}</td>
                      <td style={{ padding: "0.5rem" }}>{row.code}</td>
                      <td style={{ padding: "0.5rem" }}>{row.name}</td>
                      <td style={{ padding: "0.5rem" }}>{row.batch}</td>

                      {/* ⭐ NEW STATUS COLUMN */}
                      <td style={{ textAlign: "center" }}>
                        {row.status === "cancelled" ? (
                          <span style={{ color: "red", fontWeight: 600 }}>
                            {/* <FaTimesCircle
          style={{ marginRight: 4, verticalAlign: "left" }}
        /> */}
                            Cancelled
                          </span>
                        ) : (
                          <span style={{ color: "green", fontWeight: 600 }}>
                            {/* <FaCheckCircle
          style={{ marginRight: 4, verticalAlign: "middle" }}
        /> */}
                            Active
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.5rem", textAlign: "right" }}>{fmt(row.mrp)}</td>
                      <td style={{ padding: "0.5rem", textAlign: "right" }}>{fmt(row.rate)}</td>
                      <td style={{ padding: "0.5rem", textAlign: "right" }}>{Number(row.gst).toFixed(2)}</td>
                      {/* <td style={{ padding: "0.5rem", textAlign: "right" }}>{Number(row.qty).toFixed(2).replace(".00", "")}</td> */}


                      <td style={{ padding: "0.5rem", textAlign: "right" }}>
                        {Number(row.qty).toFixed(2).replace(".00", "")}

                        {(() => {
                          const info = getQtyMovementSummary(row, movements);
                          if (!info) return null;

                          return (
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#c62828",
                                fontWeight: 600,
                                marginTop: 2,
                              }}
                            >
                              ({info.soldQty} sold
                              {info.returnQty ? `, ${info.returnQty} return` : ""}
                              {info.cancelQty ? `, ${info.cancelQty} cancel` : ""}
                              {info.managerIncrease ? `, +${info.managerIncrease} mgr` : ""})
                            </div>
                          );
                        })()}
                      </td>



                      <td style={{ padding: "0.5rem", textAlign: "right" }}>{fmt(computeRowgstvalue(row))}</td>
                      <td style={{ padding: "0.5rem", textAlign: "right" }}>{fmt(computeRowValue(row))}</td>
                    </tr>
                    {row._stockError && (
                      <tr>
                        <td colSpan="10" style={{ padding: "0.25rem", color: "red" }}>
                          ❌ {row._stockError}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan="10" style={{ padding: "1rem", textAlign: "center" }}>
                    No items to display
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* SUMMARY */}
        <div
          className="totals-layout"
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "2rem",
            marginTop: "1.5rem",
            flexWrap: "wrap",
            padding: "1rem",
          }}
        >
          {/* GST LEFT */}
          <div
            className="totals-left"
            style={{
              flex: 1,
              minWidth: "220px",
              backgroundColor: "#f0f8f5",
              padding: "1rem",
              borderRadius: "0.75rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#007867" }}>
              Bill Summary
            </h3>

            <div style={{ display: "flex" }}>
              <span style={{ width: "150px" }}>CGST</span>
              <strong style={{ flex: 1, textAlign: "right" }}>{fmt(totals.cgst)}</strong>
            </div>

            <div style={{ display: "flex" }}>
              <span style={{ width: "150px" }}>SGST</span>
              <strong style={{ flex: 1, textAlign: "right" }}>{fmt(totals.sgst)}</strong>
            </div>

            <hr style={{ border: "0.5px solid #ddd" }} />



            {/* FIXED GST SUMMARY */}
            <div style={{ display: "flex" }}>
              <span style={{ width: "150px" }}>GST</span>
              <strong style={{ flex: 1, textAlign: "right" }}>
                {fmt(Number(totals.cgst || 0) + Number(totals.sgst || 0))}
              </strong>
            </div>

            {gstSummary.length ? (
              gstSummary.map(([rate, amt], idx) => (
                <div key={idx} style={{ display: "flex" }}>
                  <span style={{ width: "150px" }}>{rate.toFixed(2)}%</span>
                  <strong style={{ flex: 1, textAlign: "right" }}>{fmt(amt)}</strong>
                </div>
              ))
            ) : (
              <div style={{ display: "flex" }}>
                <span style={{ width: "150px" }}></span>
                {/* <span style={{ flex: 1, textAlign: "right" }}>No GST</span> */}
              </div>
            )}
          </div>

          {/* RIGHT TOTALS */}
          <div
            className="totals-right"
            style={{
              flex: 1,
              minWidth: "260px",
              backgroundColor: "#f9f9f9",
              padding: "1.2rem",
              borderRadius: "0.75rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              display: "grid",
              gridTemplateColumns: "160px 1fr",
              rowGap: "0.8rem",
            }}
          >
            <div>Total</div>
            <div style={{ textAlign: "right" }}>{fmt(totals.total)}</div>

            <div>Discount</div>
            <div style={{ textAlign: "right" }}>
              {totals.discountPercent ? `${totals.discountPercent}% ` : ""}
              {totals.discount ? `| ${fmt(totals.discount)}` : ""}
            </div>

            <div>Net Amount</div>
            <div style={{ textAlign: "right" }}>{fmt(totals.netAmount)}</div>

            <div>Cash Given</div>
            <div style={{ textAlign: "right" }}>{fmt(totals.cashGiven)}</div>

            <div>Balance</div>
            <div style={{ textAlign: "right" }}>{fmt(totals.balance)}</div>
          </div>


        </div>



        {/* ---------------- Payment Method (VIEW ONLY – TOGGLE STYLE) ---------------- */}
        <div
          className="mt-4 p-4 rounded-lg bg-[#eef8f3]
             transform transition-all duration-300
             animate-[fadeUp_0.4s_ease-out]
             hover:shadow-lg"
        >
          <div className="flex items-center justify-between gap-6">

            {/* LEFT */}
            <div className="flex flex-col gap-4">

              {/* HEADER */}
              <label className="font-semibold flex items-center gap-2 text-sm">
                <FaExchangeAlt className="text-green-700" />
                Payment Method
              </label>

              {/* TOGGLES */}
              <div className="flex gap-8">

                {/* ================= CASH ================= */}
                <div className="flex flex-col gap-2 w-40">

                  {/* CASH TOGGLE (VIEW ONLY) */}
                  <div className="flex bg-gray-100 rounded-full p-1">
                    <button
                      type="button"
                      disabled
                      className={`
                w-full px-4 py-1 text-sm rounded-full
                flex items-center justify-center gap-2
                ${paymentMethod === "cash" || paymentMethod === "mixed"
                          ? "bg-[#c8fad6] text-[#007867] shadow"
                          : "text-gray-700"
                        }
              `}
                    >
                      <FaMoneyBillWave />
                      Cash
                    </button>
                  </div>

                  {/* CASH AMOUNT */}
                  <input
                    type="number"
                    readOnly
                    disabled
                    value={payment?.cash ? payment.cash.toFixed(2) : ""}
                    placeholder="Cash Amount"
                    className="w-full p-2 rounded-md border text-sm text-right
                       bg-gray-100 cursor-not-allowed"
                  />

                  {/* CASH LABEL */}
                  <div className="text-xs text-gray-700 text-right">
                    Cash: ₹{Number(payment?.cash || 0).toFixed(2)}
                  </div>
                </div>

                {/* ================= UPI ================= */}
                <div className="flex flex-col gap-2 w-40">

                  {/* UPI TOGGLE (VIEW ONLY) */}
                  <div className="flex bg-gray-100 rounded-full p-1">
                    <button
                      type="button"
                      disabled
                      className={`
                w-full px-4 py-1 text-sm rounded-full
                flex items-center justify-center gap-2
                ${paymentMethod === "upi" || paymentMethod === "mixed"
                          ? "bg-[#c8fad6] text-[#007867] shadow"
                          : "text-gray-700"
                        }
              `}
                    >
                      <FaMobileAlt />
                      UPI
                    </button>
                  </div>

                  {/* UPI AMOUNT */}
                  <input
                    type="number"
                    readOnly
                    disabled
                    value={payment?.upi ? payment.upi.toFixed(2) : ""}
                    placeholder="UPI Amount"
                    className="w-full p-2 rounded-md border text-sm text-right
                       bg-gray-100 cursor-not-allowed"
                  />

                  {/* UPI LABEL */}
                  <div className="text-xs text-gray-700 text-right">
                    UPI: ₹{Number(payment?.upi || 0).toFixed(2)}
                  </div>
                </div>

              </div>
            </div>

            {/* RIGHT — PAYMENT STATUS (VIEW ONLY) */}
            <div className="flex items-center gap-2 text-sm">

              {payment?.cash > 0 && (
                <span className="text-green-700 font-semibold uppercase">
                  CASH
                </span>
              )}

              {payment?.cash > 0 && payment?.upi > 0 && (
                <span className="text-gray-400 font-semibold">|</span>
              )}

              {payment?.upi > 0 && (
                <span className="text-green-700 font-semibold uppercase">
                  UPI
                </span>
              )}

            </div>



          </div>
        </div>




        {/* ACTION BUTTONS */}
        <div
          className="modal-actions"
          style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "1rem" }}
        >
          <button
            className="secondary"
            onClick={onClose}
            style={{
              padding: "0.6rem 1rem",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: "#fff",
            }}
          >
            Close
          </button>

          <button
            className="primary"
            onClick={() =>
              openBillPrintWindow(meta, rows, totals, selectedShop)
            }
            style={{
              padding: "0.6rem 1rem",
              borderRadius: 6,
              background: "#007867",
              color: "#fff",
              border: "none",
            }}
          >
            Print
          </button>
        </div>

      </div>
    </div>
  );
}





