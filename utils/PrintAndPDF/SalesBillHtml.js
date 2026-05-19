// utils/PrintAndPDF/SalesBillHtml.js

const formatDate = (d) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

module.exports.buildSalesBillWiseHtml = ({
  shopname,
  periodLabel,
  bills = [],
  summary = {},
}) => {
  const rowsHtml = bills
    .map(
      (b, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>Counter ${b.counter ?? "-"}</td>
        <td>${b.billNo || "-"}</td>
        <td>${formatDate(b.date)}</td>
        <td>${b.customerName || "-"}</td>
        <td>${b.mobile || "-"}</td>
        <td class="r">${Number(b.netAmount || 0).toFixed(2)}</td>
      </tr>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bill Wise Sales Report</title>

  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 13px;
      padding: 20px;
      color: #000;
    }

    h2, h3, h4 {
      margin: 4px 0;
      text-align: center;
    }

    .header {
      text-align: center;
      margin-bottom: 10px;
    }

    .period {
      text-align: left;
      font-weight: bold;
      margin: 8px 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      table-layout: fixed;
    }

    th, td {
      border: 1px solid #000;
      padding: 6px;
      font-size: 12px;
      word-wrap: break-word;
    }

    th {
      background: #f0f0f0;
      font-weight: bold;
    }

    .r {
      text-align: right;
    }

    .summary {
      margin-top: 10px;
      text-align: right;
      font-size: 14px;
      font-weight: bold;
    }

    thead {
      display: table-header-group;
    }

    tr {
      page-break-inside: avoid;
    }
  </style>
</head>

<body>

  <!-- HEADER -->
  <div class="header">
    <h2>CSI Diocese Book Depot - ${shopname || "-"}</h2>
   
    <h3>Sales Bill Report</h3>
  </div>

  <!-- PERIOD -->
  <div class="period">
    Period: ${periodLabel || "All Period"}
  </div>

    <!-- SUMMARY -->
  <div class="summary">
    Total Bills: ${summary.totalBills || bills.length} &nbsp; | &nbsp;
    Total Amount: ₹${Number(summary.totalNetAmount || 0).toFixed(2)}
  </div>

  <!-- TABLE -->
  <table>
    <thead>
      <tr>
        <th style="width:5%">S.No</th>
        <th style="width:12%">Counter</th>
        <th style="width:14%">Bill No</th>
        <th style="width:12%">Date</th>
        <th style="width:20%">Customer</th>
        <th style="width:15%">Mobile</th>
        <th style="width:12%">Net Amount</th>
      </tr>
    </thead>

    <tbody>
      ${
        rowsHtml ||
        `<tr><td colspan="7" style="text-align:center">No records found</td></tr>`
      }
    </tbody>
  </table>



</body>
</html>
`;
};
