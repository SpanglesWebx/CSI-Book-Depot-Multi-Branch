





//utils/PrintAndPDF/buildPurchaseRegisterHtml.js
module.exports.buildPurchaseRegisterHtml = ({
  shopname,
  periodLabel,
  rows = [],
  summary = {},
}) => {
  const safeRows = Array.isArray(rows) ? rows : [];

  const bodyRows = safeRows
    .map(
      (r, i) => `
      <tr>
        <td class="sn">${i + 1}</td>
        <td class="text">${r.orderNo || "-"}</td>
        <td class="text">${r.invoiceNo || "-"}</td>
        <td class="text">${r.supplierName || "-"}</td>
        <td class="num">${r.noOfItems || 0}</td>
        <td class="num">${r.totalQty || 0}</td>
        <td class="num">${Number(r.amount || 0).toFixed(2)}</td>
        <td class="num">${Number(r.tax || 0).toFixed(2)}</td>
        <td class="num">${Number(r.groundTotal || 0).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
@page { size:A4; margin:16mm; }

body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10.5px;
  color: #000;
}

h1 {
  text-align:center;
  font-size:16px;
  margin:0;
}

h3 {
  text-align:center;
  font-size:12px;
  margin:4px 0 6px;
}

.period {
  font-size:11px;
  font-weight:bold;
  margin:8px 0 10px;
}

.summary {
  text-align:right;
  font-size:11px;
  margin-bottom:6px;
}

table {
  width:100%;
  border-collapse:collapse;
  table-layout:fixed;
}

thead { display:table-header-group; }

th {
  background:#f2f2f2;
  border:1px solid #000;
  padding:7px 6px;
  font-size:11px;
  text-align:center;
}

td {
  border:1px solid #000;
  padding:6px 6px;
  vertical-align:middle;
}

.sn { width:4%; text-align:center; }
.text { text-align:left; }
.num { text-align:right; }

tr { page-break-inside:avoid; }
</style>
</head>

<body>
<h1>CSI Diocese Book Depot - ${shopname || ""}</h1>
<h3>Purchase Register</h3>
<div class="period">Date : ${periodLabel || ""}</div>

<div class="summary">
  <b>Total Qty:</b> ${summary.totalQty || 0}
  &nbsp;&nbsp;
  <b>Grand Total:</b> ₹${Number(summary.grandTotal || 0).toFixed(2)}
</div>

<table>
<thead>
<tr>
<th class="sn">S.No</th>
<th>Order No</th>
<th>Invoice No</th>
<th>Supplier</th>
<th>Items</th>
<th>Qty</th>
<th>Amount</th>
<th>Tax</th>
<th>Grand Total</th>
</tr>
</thead>
<tbody>
${bodyRows || `<tr><td colspan="9" style="text-align:center">No data</td></tr>`}
</tbody>
</table>

</body>
</html>
`;
};
