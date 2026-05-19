

// utils/PrintAndPDF/buildCategoryProductsHtml.js
module.exports.buildCategoryProductsHtml = ({
  shopname,
  category,
  periodLabel,
  rows = [],
  totalQty = 0,        // ✅ from backend
  totalValue = 0,      // ✅ from backend
}) => {

  /* ---------------- TABLE ROWS ---------------- */
  const bodyRows = rows
    .map(
      (r, i) => `
      <tr>
        <td class="sn">${i + 1}</td>
        <td class="code">${r.code || ""}</td>
        <td class="name">${r.name || ""}</td>
        <td class="num">${r.qty || 0}</td>
        <td class="num">${r.value || 0}</td>
      </tr>
    `
    )
    .join("");

  /* ---------------- TOTAL ROW ---------------- */
  const totalRow = `
    <tr style="font-weight:bold; background:#f9f9f9;">
      <td colspan="3" style="text-align:right;">TOTAL</td>
      <td class="num">${totalQty}</td>
      <td class="num">${totalValue}</td>
    </tr>
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page {
      size: A4;
      margin: 14mm;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      color: #000;
    }

    h1 {
      font-size: 15px;
      margin: 0;
      text-align: center;
    }

    h2 {
      font-size: 12px;
      margin: 2px 0;
      text-align: center;
    }

    h3 {
      font-size: 11px;
      margin: 4px 0;
      text-align: center;
    }

    .meta {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin: 10px 0 6px;
    }

    .meta-left {
      font-size: 10.5px;
      font-weight: bold;
    }

    .meta-right {
      font-size: 10.5px;
      font-weight: bold;
      text-align: right;
      white-space: nowrap;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    thead {
      display: table-header-group;
    }

    th, td {
      border: 1px solid #000;
      padding: 4px 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
    }

    th {
      background: #f2f2f2;
      font-weight: bold;
      text-align: center;
    }

    .sn { width: 5%; text-align: center; }
    .code { width: 16%; text-align: left; }
    .name { width: 39%; text-align: left; }
    .num { width: 20%; text-align: right; }

    tr {
      page-break-inside: avoid;
    }
  </style>
</head>

<body>
  <h1>CSI Diocese Book Depot - ${shopname || ""}</h1>
  <h2></h2>
  <h3>Category Wise Stock Report</h3>

  <div class="meta">
    <div class="meta-left">
      Category: ${category || ""}
      <br />
      Date: ${periodLabel || ""}
    </div>

    <!-- ✅ TOP RIGHT TOTALS -->
    <div class="meta-right">
      Total Qty: ${totalQty} &nbsp;&nbsp; | &nbsp;&nbsp;
      Total Value: ${totalValue}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="sn">S.No</th>
        <th class="code">Product Code</th>
        <th class="name">Product Name</th>
        <th class="num">Qty</th>
        <th class="num">Stock Value</th>
      </tr>
    </thead>

    <tbody>
      ${bodyRows}
      ${totalRow}   <!-- ✅ ADDED -->
    </tbody>
  </table>
</body>
</html>
`;
};