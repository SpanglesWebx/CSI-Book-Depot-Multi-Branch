module.exports = ({ shopname, periodLabel, rows, summary }) => `
<html>
<head>
<style>
  body { font-family: Arial; font-size:12px }
  h2,h3 { text-align:center; }
  table { width:100%; border-collapse:collapse }
  th,td { border:1px solid #000; padding:6px }
  th { background:#eee }
  .r { text-align:right }
  .summary { text-align:right; font-weight:bold; margin:8px 0 }
</style>
</head>

<body>
<h2>CSI Diocese Book Depot - ${shopname}</h2>

<h3>Category Expense Report — ${periodLabel}</h3>

<div class="summary">
  Entries: ${summary.entries} &nbsp;&nbsp;
  Total: ₹${summary.totalAmount.toFixed(2)}
</div>

<table>
<thead>
<tr>
  <th>S.No</th>
  <th>Category</th>
  <th>Entries</th>
  <th>Total Amount</th>
</tr>
</thead>

<tbody>
${rows.map((r,i)=>`
<tr>
  <td>${i+1}</td>
  <td>${r.category}</td>
  <td class="r">${r.entries}</td>
  <td class="r">₹${r.totalAmount.toFixed(2)}</td>
</tr>`).join("")}
</tbody>
</table>

</body>
</html>
`;
