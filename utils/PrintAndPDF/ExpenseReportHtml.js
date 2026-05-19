module.exports = ({ shopname, periodLabel, rows, summary }) => {
  const fmtDate = (d) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const bodyRows = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${fmtDate(r.date)}</td>
      <td>${r.receiptNo || "-"}</td>
      <td>${r.category || "-"}</td>
      <td>${r.reason || "-"}</td>
      <td class="r">₹${Number(r.amount || 0).toFixed(2)}</td>
      <td>${r.spendTo || "-"}</td>
    </tr>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial; font-size: 12px; }
  h2,h3 { text-align:center; margin:4px 0; }

  .summary {
    text-align:right;
    font-weight:bold;
    margin:8px 0;
  }

  hr { border:1px solid #000; }

  table {
    width:100%;
    border-collapse:collapse;
  }
  th, td {
    border:1px solid #000;
    padding:6px;
  }
  th { background:#f2f2f2; }
  .r { text-align:right; }

  footer {
    position: fixed;
    bottom: 10px;
    right: 20px;
    font-size: 10px;
  }
</style>
</head>

<body>

<h2>CSI Diocese Book Depot - ${shopname}</h2>

<h3>Expense Report — ${periodLabel}</h3>

<div class="summary">
  Total Expense: ₹${Number(summary.totalAmount || 0).toFixed(2)}
</div>

<hr />

<table>
<thead>
<tr>
  <th>S.No</th>
  <th>Date</th>
  <th>Receipt No</th>
  <th>Category</th>
  <th>Reason</th>
  <th>Amount</th>
  <th>Paid To</th>
</tr>
</thead>

<tbody>
${bodyRows}
</tbody>
</table>

<footer>
  Page <span class="pageNumber"></span> of <span class="totalPages"></span>
</footer>

</body>
</html>
`;
};
