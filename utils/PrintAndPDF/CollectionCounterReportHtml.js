module.exports = ({ shopname, periodLabel, data = {} }) => {
  const rows = Array.isArray(data.rows) ? data.rows : [];

  const grandTotal = rows.reduce(
    (sum, r) => sum + Number(r.total || 0),
    0
  );

  return `
<!DOCTYPE html>
<html>
<head>
  <style>

    @page {
      size: A4;
      margin: 18mm;
    }

    body { 
      font-family: Arial, Helvetica, sans-serif; 
      font-size: 11px; 
      margin: 0;
      color: #000;
    }

    h2 { text-align:center; margin:0; font-size:16px; }
    h3 { text-align:center; margin:2px 0; font-size:13px; font-weight:normal; }
    h4 { text-align:center; margin:2px 0 8px 0; font-size:11px; font-weight:normal; }

    table { 
      width:100%; 
      border-collapse:collapse; 
      margin-top:10px; 
      font-size:11px;
      page-break-inside:auto;
    }

    th,td { 
      border:1px solid #000; 
      padding:5px 6px; 
    }

    th { 
      background:#eaeaea; 
      font-weight:bold; 
      text-align:center;
    }

    .r { text-align:right; }

    /* ✅ IMPORTANT: TABLE HEADER REPEAT FIX */
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
<h3>Counter Collection Report</h3>
<h4>${periodLabel}</h4>

<div style="text-align:right;font-weight:bold;margin:6px 0;">
  Total Collection: ₹${grandTotal.toFixed(2)}
</div>

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
${rows.map((r, i) => `
<tr>
  <td>${i + 1}</td>
  <td>Counter - ${r.counter}</td>
  <td class="r">${r.totalBills || 0}</td>
  <td class="r">${r.totalQty || 0}</td>
  <td class="r">${Number(r.paymentCash || 0).toFixed(2)}</td>
  <td class="r">${Number(r.paymentUpi || 0).toFixed(2)}</td>
  <td class="r">${Number(r.total || 0).toFixed(2)}</td>
</tr>
`).join("")}
</tbody>
</table>

</body>
</html>
`;
};