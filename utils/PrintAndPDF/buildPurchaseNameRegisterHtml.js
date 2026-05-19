



module.exports.buildPurchaseNameRegisterHtml = ({
  shopname,
  periodLabel,
  rows = [],
}) => {
  const safeRows = Array.isArray(rows) ? rows : [];

  const body = safeRows
    .map(
      (r, i) => `
<tr>
<td class="sn">${i + 1}</td>
<td class="text">${r.supplierName}</td>
<td class="num">${r.bills}</td>
<td class="num">${r.noOfProducts}</td>
<td class="num">${r.totalQty}</td>
<td class="num">${r.amount.toFixed(2)}</td>
<td class="num">${r.tax.toFixed(2)}</td>
<td class="num">${r.grandTotal.toFixed(2)}</td>
</tr>`
    )
    .join("");

  return `
<html>
<head>
<style>
@page { size:A4; margin:12mm; }

body { 
  font-family:Arial, Helvetica, sans-serif; 
  font-size:11px; 
  line-height:1.3;
}

h1 { 
  text-align:center; 
  font-size:14px; 
  margin:0; 
  font-weight:bold;
}

h3 { 
  text-align:center; 
  font-size:13px; 
  margin:4px 0 6px; 
  font-weight:bold;
}

.period { 
  font-size:11px; 
  font-weight:bold; 
  margin:8px 0 10px; 
}

table {
  width:100%;
  border-collapse:collapse;
  table-layout:fixed;
}

thead { 
  display:table-header-group; 
}

th {
  background:#eee;
  border:1px solid #000;
  padding:5px 6px;
  text-align:center;
  font-size:12px;
}

td {
  border:1px solid #000;
  padding:5px 6px;
  font-size:11px;
  vertical-align:middle;
}

.sn { width:4%; text-align:center; }
.text { text-align:left; }
.num { text-align:right; }

tbody {
  font-size:11px;
}

tr {
  page-break-inside: avoid;
}
</style>
</head>

<body>
<h1>CSI Diocese Book Depot - ${shopname || ""}</h1>
<h3>Supplier Wise Purchase Report</h3>
<div class="period">Date : ${periodLabel || ""}</div>

<table>
<thead>
<tr>
<th class="sn">S.No</th>
<th>Supplier</th>
<th>Bills</th>
<th>Products</th>
<th>Qty</th>
<th>Amount</th>
<th>Tax</th>
<th>Grand Total</th>
</tr>
</thead>
<tbody>
${body || `<tr><td colspan="8" style="text-align:center">No data</td></tr>`}
</tbody>
</table>

</body>
</html>
`;
};