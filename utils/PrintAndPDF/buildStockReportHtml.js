



// utils/StockPrintAndPDF/buildStockReportHtml.js

module.exports.buildStockReportHtml = ({
  shopname,
  mode,
  periodLabel,
  rows = [], // ✅ SAFETY DEFAULT (CRITICAL)
}) => {
  const isStock = mode === "stock";

  // ✅ HARD GUARD — NEVER TRUST INPUT
  const safeRows = Array.isArray(rows) ? rows : [];

  const tableHeader = isStock
    ? `
      <tr>
        <th class="sn">S.No</th>
        <th class="code">Product Code</th>
        <th class="name">Product Name</th>
        <th class="cat">Category</th>
        <th class="num">Opening</th>
        <th class="num">Purchase</th>
        <th class="num">Sold</th>
        <th class="num">Return</th>
        <th class="num">Closing</th>
      </tr>
    `
    : `
      <tr>
        <th class="sn">S.No</th>
        <th class="name">Category</th>
        <th class="num">Item Count</th>
        <th class="num">Total Qty</th>
        <th class="num">Stock Value</th>
      </tr>
    `;

  const tableRows = safeRows
    .map((r, i) =>
      isStock
        ? `
        <tr>
          <td class="sn">${i + 1}</td>
          <td class="code">${r.code || ""}</td>
          <td class="name">${r.name || ""}</td>
          <td class="cat">${r.category || ""}</td>
          <td class="num">${Number(r.openingStock || 0)}</td>
          <td class="num">${Number(r.purchaseQty || 0)}</td>
          <td class="num">${Number(r.sold || 0)}</td>
          <td class="num">${Number(r.returnQty || 0)}</td>
          <td class="num">${Number(r.closingStock || 0)}</td>
        </tr>
      `
        : `
        <tr>
          <td class="sn">${i + 1}</td>
          <td class="name">${r.category || ""}</td>
          <td class="num">${Number(r.itemCount || 0)}</td>
          <td class="num">${Number(r.totalQty || 0)}</td>
          <td class="num">${Number(r.value || 0)}</td>
        </tr>
      `
    )
    .join("");

  return `
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
@page {
  size: A4;
  margin: 16mm;
}

body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10.5px;
  color: #000;
}

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
}

.period {
  margin: 8px 0 10px;
  font-size: 11px;
  font-weight: bold;
  text-align: left;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

/* ---------- HEADER ---------- */
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
  white-space: normal;
  line-height: 1.3;
}

/* ---------- BODY ---------- */
td {
  font-size: 10.5px;
  padding: 6px 6px;
  border: 1px solid #bbb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

/* ---------- COLUMN WIDTHS ---------- */
.sn {
  width: 4%;
  text-align: center;
}

.code {
  width: 12%;
  text-align: left;
}

.name {
  width: 24%;
  text-align: left;
}

.cat {
  width: 14%;
  text-align: left;
}

.num {
  width: 9%;
  text-align: right;
}

/* ---------- PAGE SAFETY ---------- */
tr {
  page-break-inside: avoid;
}
    </style>
  </head>

  <body>
    <h1>CSI Diocese Book Depot - ${shopname || ""}</h1>

    <h3>Stock Reports - ${isStock ? "Product Wise" : "Category Wise"}</h3>

    <div class="period">Date : ${periodLabel || ""}</div>

    <table>
      <thead>${tableHeader}</thead>
      <tbody>
        ${
          tableRows ||
          `<tr><td colspan="${
            isStock ? 9 : 5
          }" style="text-align:center;padding:12px;">No records found</td></tr>`
        }
      </tbody>
    </table>
  </body>
  </html>
  `;
};
