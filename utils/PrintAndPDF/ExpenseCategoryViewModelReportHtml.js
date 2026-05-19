module.exports = ({ shopname, category, periodLabel, rows, summary }) => {
  const fmtDate = (d) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return `
<html>
<head>
<style>
  body { font-family: Arial; font-size: 12px; }
  h2,h3 { text-align:center; margin:4px 0; }

  .summary {
    text-align:right;
    font-weight:bold;
    margin:8px 0;
  }

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
    position:fixed;
    bottom:10px;
    right:20px;
    font-size:10px;
  }
</style>
</head>

<body>

<h2>CSI Diocese Book Depot - ${shopname}</h2>

<h3>Category Expense Details — ${category}</h3>
<h3>${periodLabel}</h3>

<div class="summary">
  Entries: ${summary.entries} &nbsp;&nbsp;
  Total: ₹${summary.totalAmount.toFixed(2)}
</div>

<table>
<thead>
<tr>
  <th>S.No</th>
  <th>Date</th>
  <th>Receipt No</th>
  <th>Reason</th>
  <th>Amount</th>
  <th>Paid To</th>
</tr>
</thead>

<tbody>
${rows.map((r, i) => `
<tr>
  <td>${i + 1}</td>
  <td>${fmtDate(r.date)}</td>
  <td>${r.receiptNo || "-"}</td>
  <td>${r.reason || "-"}</td>
  <td class="r">₹${Number(r.amount || 0).toFixed(2)}</td>
  <td>${r.spendTo || "-"}</td>
</tr>`).join("")}
</tbody>
</table>


</body>
</html>
`;
};
