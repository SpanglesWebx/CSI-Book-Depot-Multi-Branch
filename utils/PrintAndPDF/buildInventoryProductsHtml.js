// utils/PrintAndPDF/buildInventoryProductsHtml.js

module.exports.buildInventoryProductsHtml = ({
  shopname,
  periodLabel,
  rows = [],
}) => {
  // Safety guard
  const safeRows = Array.isArray(rows) ? rows : [];

  const tableRows = safeRows
    .map((r, i) => {
      const qty = Number(r.qty || 0);
      const rate = Number(r.rate || 0);
      const total = Number(r.totalValue || qty * rate);

      return `
        <tr>
          <td class="sn">${i + 1}</td>
          <td class="code">${r.code || ""}</td>
          <td class="name">${r.name || ""}</td>
          <td class="num">${qty}</td>
          <td class="num">${rate.toFixed(2)}</td>
          <td class="num">${total.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
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

    /* -------- TABLE HEADER (REPEATS EVERY PAGE) -------- */
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

    td {
      font-size: 10.5px;
      padding: 6px 6px;
      border: 1px solid #bbb;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
    }

    /* -------- COLUMN WIDTHS -------- */
    .sn {
      width: 4%;
      text-align: center;
    }

    .code {
      width: 14%;
      text-align: left;
    }

    .name {
      width: 30%;
      text-align: left;
    }

    .num {
      width: 10%;
      text-align: right;
    }

    /* -------- PAGE BREAK SAFETY -------- */
    tr {
      page-break-inside: avoid;
    }
  </style>
</head>

<body>
  <h1>CSI Diocese Book Depot - ${shopname || ""}</h1>
  <h3>Stock Value Report</h3>
  <div class="period">
  Period: ${periodLabel || "All Period"}
</div>



  <table>
    <thead>
      <tr>
        <th class="sn">S.No</th>
        <th class="code">Product Code</th>
        <th class="name">Product Name</th>
        <th class="num">Qty</th>
        <th class="num">Rate</th>
        <th class="num">Total Value</th>
      </tr>
    </thead>

    <tbody>
      ${
        tableRows ||
        `<tr>
          <td colspan="6" style="text-align:center;padding:12px;">
            No records found
          </td>
        </tr>`
      }
    </tbody>
  </table>
</body>
</html>
`;
};
