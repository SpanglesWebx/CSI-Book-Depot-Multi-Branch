module.exports = ({ shopname, periodLabel, data }) => {

  const formatDate = (d) => {
    const dt = new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yy = String(dt.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  const rows = (data.rows || []).map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${formatDate(r.date)}</td>
      <td class="r">${r.billCount}</td>
      <td class="r">${r.qty}</td>
      <td class="r">₹${r.totalSales.toFixed(2)}</td>
    </tr>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>

  /* ===== A4 PAGE ===== */
  @page {
    size: A4;
    margin: 10mm;
  }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    line-height: 1.3;
  }

  h2 {
    text-align: center;
    margin: 4px 0;
    font-size: 14px;
    font-weight: bold;
  }

  h3 {
    text-align: center;
    margin: 4px 0;
    font-size: 13px;
    font-weight: bold;
  }

  .hr {
    border-top: 2px solid #000;
    margin: 6px 0 12px 0;
  }

  /* ===== SUMMARY (NO BOX, CLEAN RIGHT ALIGN) ===== */
  .summary-line {
    text-align: right;
    font-weight: bold;
    font-size: 11px;
    margin: 8px 0 6px 0;
  }

  /* ===== TABLE ===== */
  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    display: table-header-group; /* repeat header */
  }

  th {
    border: 1px solid #000;
    padding: 5px;
    background: #f2f2f2;
    font-size: 12px;
    text-align: center;
  }

  td {
    border: 1px solid #000;
    padding: 5px;
    font-size: 11px;
  }

  tbody {
    font-size: 11px;
  }

  .r {
    text-align: right;
  }

  .c {
    text-align: center;
  }

  tr {
    page-break-inside: avoid;
  }

</style>
</head>

<body>

  <h2>CSI Diocese Book Depot - ${shopname}</h2>
  
  <h3>Item Wise Date Report — ${periodLabel}</h3>

  <!-- ✅ CLEAN SUMMARY (NO BOX) -->
  <div class="summary-line">
    Total Bills: ${data.summary?.totalBills || 0}
    &nbsp;&nbsp;&nbsp;
    Total Qty: ${data.summary?.totalQty || 0}
    &nbsp;&nbsp;&nbsp;
    Total Sales: ₹${(data.summary?.totalSales || 0).toFixed(2)}
  </div>

  <table>
    <thead>
      <tr>
        <th class="c">S.No</th>
        <th class="c">Date</th>
        <th class="c">Bills</th>
        <th class="c">Qty</th>
        <th class="c">Total Sales</th>
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