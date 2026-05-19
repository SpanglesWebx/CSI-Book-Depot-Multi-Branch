
module.exports = ({ shopname, periodLabel, data }) => {


  const counterRows = Array.isArray(data.counterRows) ? data.counterRows : [];
const userRows = Array.isArray(data.userRows) ? data.userRows : [];
  const summary = data.summary || {
    cash: 0,
    upi: 0,
    total: 0,
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>

    @page {
      size: A4;
      margin: 20mm;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #000;
      line-height: 1.4;
    }

    h2 {
      text-align: center;
      margin: 0;
      font-size: 18px;
    }

    h3 {
      text-align: center;
      margin: 2px 0;
      font-size: 14px;
      font-weight: normal;
    }

    h4 {
      text-align: center;
      margin: 2px 0 10px 0;
      font-size: 12px;
      font-weight: normal;
    }

    .section-title {
      margin-top: 20px;
      margin-bottom: 6px;
      font-weight: bold;
      font-size: 13px;
      border-bottom: 1px solid #000;
      padding-bottom: 2px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 11px;
    }

    th, td {
      border: 1px solid #000;
      padding: 5px 6px;
    }

    th {
      background: #eaeaea;
      font-weight: bold;
      text-align: center;
    }

    td {
      vertical-align: middle;
    }

    .r {
      text-align: right;
    }

    .c {
      text-align: center;
    }

    thead {
      display: table-header-group;
    }

    tr {
      page-break-inside: avoid;
    }

    .summary-table td {
      font-weight: bold;
      font-size: 12px;
    }

    .summary-table th {
      background: #dcdcdc;
    }

  </style>
</head>
<body>

  <!-- HEADER -->
  <h2>CSI Diocese Book Depot</h2>
  <h3>${shopname || ""}</h3>
  <h3>Collection Statement</h3>
  <h4>${periodLabel}</h4>

  <!-- COUNTER WISE TABLE -->
  <div class="section-title">Counter-wise Collection</div>

  <table>
    <thead>
      <tr>
        <th>S.No</th>
        <th>Counter</th>
        <th class="r">Bills</th>
        <th class="r">Qty</th>
        <th class="r">Cash</th>
        <th class="r">UPI</th>
        <th class="r">Total</th>
      </tr>
    </thead>
    <tbody>
      ${
        counterRows.length === 0
          ? `<tr><td colspan="7" class="c">No records found</td></tr>`
          : counterRows.map((r, i) => `
            <tr>
              <td class="c">${i + 1}</td>
              <td>Counter - ${r._id}</td>
              <td class="r">${Number(r.totalBills || 0)}</td>
              <td class="r">${Number(r.totalQty || 0)}</td>
              <td class="r">${Number(r.paymentCash || 0).toFixed(2)}</td>
              <td class="r">${Number(r.paymentUpi || 0).toFixed(2)}</td>
              <td class="r">${Number(r.total || 0).toFixed(2)}</td>
            </tr>
          `).join("")
      }
    </tbody>
  </table>

  <!-- USER WISE TABLE -->
  <div class="section-title">User-wise Collection</div>

  <table>
    <thead>
      <tr>
        <th>S.No</th>
        <th>User</th>
        <th class="r">Bills</th>
        <th class="r">Qty</th>
        <th class="r">Cash</th>
        <th class="r">UPI</th>
        <th class="r">Total</th>
      </tr>
    </thead>
    <tbody>
      ${
        userRows.length === 0
          ? `<tr><td colspan="7" class="c">No records found</td></tr>`
          : userRows.map((r, i) => `
            <tr>
              <td class="c">${i + 1}</td>
              <td>${r.name || r._id}</td>
              <td class="r">${Number(r.totalBills || 0)}</td>
              <td class="r">${Number(r.totalQty || 0)}</td>
              <td class="r">${Number(r.paymentCash || 0).toFixed(2)}</td>
              <td class="r">${Number(r.paymentUpi || 0).toFixed(2)}</td>
              <td class="r">${Number(r.total || 0).toFixed(2)}</td>
            </tr>
          `).join("")
      }
    </tbody>
  </table>

  <!-- SUMMARY TABLE -->
  <div class="section-title">Collection Summary</div>

  <table class="summary-table">
    <thead>
      <tr>
        <th>Payment Mode</th>
        <th class="r">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Cash</td>
        <td class="r">₹ ${Number(summary.cash || 0).toFixed(2)}</td>
      </tr>
      <tr>
        <td>UPI</td>
        <td class="r">₹ ${Number(summary.upi || 0).toFixed(2)}</td>
      </tr>
      <tr>
        <td>Total</td>
        <td class="r">₹ ${Number(summary.total || 0).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

</body>
</html>
`;
};







