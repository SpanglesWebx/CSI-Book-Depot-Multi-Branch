module.exports = ({ shopname, periodLabel, data }) => {
  const rows = (data.items || [])
    .map(
      (it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${it.name}</td>
        <td class="r">${it.openingStock}</td>
        <td class="r">${it.qty}</td>
        <td class="r">${it.closingStock}</td>
        <td class="r">${it.totalSales.toFixed(2)}</td>
        <td class="r">${it.totalGst.toFixed(2)}</td>
        <td class="r">${it.netSale.toFixed(2)}</td>
      </tr>
    `
    )
    .join("");

  const summary = data.summary || {
    totalItemsSold: 0,
    totalSales: 0,
    totalGst: 0,
    totalNetSale: 0,
  };

  return `
<html>
<head>
<style>
  /* ===== A4 PAGE SETUP ===== */
  @page {
    size: A4;
    margin: 10mm;
  }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10px;
    line-height: 1.3;
    color: #000;
  }

  h2 {
    margin: 2px 0;
    text-align: center;
    font-size: 14px;
    font-weight: bold;
  }

  h3 {
    margin: 2px 0;
    text-align: center;
    font-size: 13.5px;
    font-weight: bold;
  }

  /* ===== SUMMARY STRIP ===== */
  .summary-bar {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin: 6px 0 4px 0;
    font-weight: bold;
    font-size: 13px;
  }

  .summary-bar span {
    white-space: nowrap;
  }

  /* ===== TABLE ===== */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4px;
    font-size: 12px; /* table-specific size */
  }

  thead {
    display: table-header-group;
  }

  tbody {
    font-size: 11px;
  }

  th, td {
    border: 1px solid #000;
    padding: 3px 4px;
    line-height: 1.2;
  }

  th {
    background: #f2f2f2;
    font-weight: bold;
    text-align: center;
  }

  td {
    vertical-align: middle;
  }

  .r {
    text-align: right;
  }

  tr {
    page-break-inside: avoid;
  }
</style>
</head>

<body>
  <h2>CSI Diocese Book Depot - ${shopname}</h2>

  <h3>ItemWise Sales Report — ${periodLabel}</h3>

  <!-- ===== TOP RIGHT SUMMARY (SINGLE LINE) ===== -->
  <div class="summary-bar">
    <span>Total Qty: ${summary.totalItemsSold}</span>
    <span>Total Sales: ₹${summary.totalSales.toFixed(2)}</span>
    <span>Total GST: ₹${summary.totalGst.toFixed(2)}</span>
    <span>Net Sale: ₹${summary.totalNetSale.toFixed(2)}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th>S.No</th>
        <th>Item</th>
        <th>Opening</th>
        <th>Sold Qty</th>
        <th>Closing</th>
        <th>Total Sales</th>
        <th>GST</th>
        <th>Net Sale</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>
`;
};