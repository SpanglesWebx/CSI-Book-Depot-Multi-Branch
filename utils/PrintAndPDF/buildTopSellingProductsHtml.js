// utils/PrintAndPDF/buildTopSellingProductsHtml.js

module.exports.buildTopSellingProductsHtml = ({
  shopname = "",
  periodLabel = "",
  rows = [],
}) => {
  // ---------- SAFETY ----------
  const safeRows = Array.isArray(rows) ? rows : [];

  const tableRows =
    safeRows.length > 0
      ? safeRows
          .map(
            (r, i) => `
        <tr>
          <td class="sn">${i + 1}</td>
          <td class="code">${r.code || ""}</td>
          <td class="name">${r.name || ""}</td>
          <td class="num">${Number(r.totalQty || 0)}</td>
          <td class="num">${Number(r.totalValue || 0).toFixed(2)}</td>
        </tr>
      `
          )
          .join("")
      : `
        <tr>
          <td colspan="5" class="no-data">No records found</td>
        </tr>
      `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />

  <style>
    /* ---------------- PAGE ---------------- */
    @page {
      size: A4;
      margin: 16mm;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10.5px;
      color: #000;
    }

    /* ---------------- HEADER ---------------- */
    h1 {
      font-size: 16px;
      margin: 0;
      text-align: center;
      letter-spacing: 0.5px;
    }

    h3 {
      font-size: 12px;
      margin: 4px 0 6px;
      text-align: center;
      font-weight: 700;
    }

    .period {
      margin: 8px 0 12px;
      font-size: 11px;
      font-weight: bold;
      text-align: left;
    }

    /* ---------------- TABLE ---------------- */
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    thead {
      display: table-header-group;
    }

    th {
      background: #f5f5f5;
      font-weight: 700;
      font-size: 11px;
      text-align: center;
      padding: 8px 6px;
      border: 1px solid #999;
      line-height: 1.3;
      white-space: normal;
    }

    td {
      font-size: 10.5px;
      padding: 6px 6px;
      border: 1px solid #bbb;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
    }

    /* ---------------- COLUMN WIDTHS ---------------- */
    .sn {
      width: 6%;
      text-align: center;
    }

    .code {
      width: 18%;
      text-align: left;
    }

    .name {
      width: 36%;
      text-align: left;
    }

    .num {
      width: 20%;
      text-align: right;
    }

    /* ---------------- EMPTY STATE ---------------- */
    .no-data {
      text-align: center;
      padding: 14px;
      font-size: 11px;
    }

    /* ---------------- PAGE SAFETY ---------------- */
    tr {
      page-break-inside: avoid;
    }
  </style>
</head>

<body>
  <h1>CSI Diocese Book Depot - ${shopname}</h1>

  <h3>Top Selling Products Report</h3>
  <div class="period">
  Period: ${periodLabel || "All Period"}
</div>
  
          
  <table>
    <thead>
      <tr>
        <th class="sn">S.No</th>
        <th class="code">Product Code</th>
        <th class="name">Product Name</th>
        <th class="num">Qty Sold</th>
        <th class="num">Total Value</th>
      </tr>
    </thead>

    <tbody>
      ${tableRows}
    </tbody>
  </table>
</body>
</html>
`;
};
