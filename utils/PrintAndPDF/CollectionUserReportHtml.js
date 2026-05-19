


module.exports = ({ shopname, periodLabel, data }) => {

  const rows = Array.isArray(data.rows) ? data.rows : [];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>User Collection Report</title>

  <style>

    @page {
      size: A4;
      margin: 18mm;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #000;
      margin: 0;
    }

    h2 {
      margin: 0;
      font-size: 16px;
      text-align: center;
    }

    h3 {
      margin: 2px 0;
      font-size: 13px;
      font-weight: normal;
      text-align: center;
    }

    h4 {
      margin: 2px 0 8px 0;
      font-size: 11px;
      font-weight: normal;
      text-align: center;
    }

    .report-title {
      font-weight: bold;
      margin-top: 4px;
      font-size: 13px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 11px;
      page-break-inside: auto;
    }

    th, td {
      border: 1px solid #000;
      padding: 5px 6px;
      vertical-align: middle;
    }

    th {
      background-color: #eaeaea;
      font-weight: bold;
      text-align: center;
    }

    .r {
      text-align: right;
    }

    .c {
      text-align: center;
    }

    /* ✅ TABLE HEADER REPEAT */
    thead {
      display: table-header-group;
    }

    tfoot {
      display: table-row-group;
    }

    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }

  </style>
</head>

<body>

  <h2>CSI Diocese Book Depot</h2>
  <h3>${shopname || ""}</h3>
  <h3 class="report-title">User Collection Report</h3>
  <h4>${periodLabel}</h4>

  <table>
    <thead>
      <tr>
        <th class="c" style="width:5%;">S.No</th>
        <th style="width:18%;">User</th>
        <th style="width:12%;">Counter</th>
        <th class="r" style="width:10%;">Bills</th>
        <th class="r" style="width:10%;">Qty</th>
        <th class="r" style="width:15%;">Cash</th>
        <th class="r" style="width:15%;">UPI</th>
        <th class="r" style="width:15%;">Total</th>
      </tr>
    </thead>

    <tbody>
      ${
        rows.length === 0
          ? `
            <tr>
              <td colspan="8" class="c">No records found</td>
            </tr>
          `
          : rows
              .map(
                (r, i) => `
            <tr>
              <td class="c">${i + 1}</td>
              <td>${r.user || "-"}</td>
              <td>${r.counter ?? "-"}</td>
              <td class="r">${Number(r.bills || r.totalBills || 0)}</td>
              <td class="r">${Number(r.totalQty || 0)}</td>
              <td class="r">${Number(r.paymentCash || 0).toFixed(2)}</td>
              <td class="r">${Number(r.paymentUpi || 0).toFixed(2)}</td>
              <td class="r">${Number(r.total || 0).toFixed(2)}</td>
            </tr>
          `
              )
              .join("")
      }
    </tbody>
  </table>

</body>
</html>
`;
};