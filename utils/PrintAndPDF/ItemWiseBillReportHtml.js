module.exports = ({ shopname, periodLabel, data }) => {
  const formatDate = (d) => {
    if (!d) return "-";
    const dt = new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  let sno = 1;

  const rows = (data.bills || [])
    .flatMap((bill) =>
      (bill.items || []).map(
        (it) => `
        <tr>
          <td class="c">${sno++}</td>
          <td class="c">Counter-${bill.counter || "-"}</td>
          <td class="c">${bill.billNo}</td>
          <td class="c">${formatDate(bill.date)}</td>
          <td>${bill.customerName || "-"}</td>
       
          <td>${it.name}</td>
          <td class="r">${it.qty}</td>
          <td class="r">${Number(it.rate || 0).toFixed(2)}</td>
          <td class="r">${it.gst || 0}%</td>
          <td class="r">${Number(it.gstAmount || 0).toFixed(2)}</td>
          <td class="r">${Number(it.value || 0).toFixed(2)}</td>
        </tr>
      `
      )
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #000;
    }

    h2, h3 {
      text-align: center;
      margin: 2px 0;
    }

    .meta {
      text-align: center;
      font-weight: bold;
      margin: 6px 0 10px 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }

    thead {
  display: table-header-group;
}

tfoot {
  display: table-footer-group;
}

    th, td {
      border: 1px solid #000;
      padding: 6px;
      vertical-align: middle;
    }

    th {
      background: #f2f2f2;
      font-weight: bold;
      text-align: center;
    }

    td.r { text-align: right; }
    td.c { text-align: center; }

    tr { page-break-inside: avoid; }
  </style>
</head>
<body>

  <h2>CSI Diocese Book Depot - ${shopname}</h2>

  <div class="meta">ItemWise Bill Report — ${periodLabel}</div>

  <table>
    <thead>
      <tr>
        <th>S.No</th>
        <th>Counter</th>
        <th>Bill No</th>
        <th>Date</th>
        <th>Customer</th>
        <th>Item Name</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>GST %</th>
        <th>GST Amt</th>
        <th>Amount</th>
      </tr>
    </thead>

    <tbody>
      ${rows || `<tr><td colspan="12" style="text-align:center">No data</td></tr>`}
    </tbody>
  </table>

</body>
</html>
`;
};
