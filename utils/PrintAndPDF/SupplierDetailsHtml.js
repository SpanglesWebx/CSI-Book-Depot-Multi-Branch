module.exports.buildSupplierBillsHtml = ({
  shopname,
  supplierName,
  periodLabel,
  rows = [],
}) => {
  const safeRows = Array.isArray(rows) ? rows : [];

  const billsHtml = safeRows
    .map((p, billIndex) => {
      const batchRows = (p.batches || [])
        .map(
          (b, idx) => `
          <tr>
            <td class="sn">${idx + 1}</td>
            <td>${b.code || "-"}</td>
            <td class="product">${b.name || "-"}</td>

            <td class="batch">${b.batchNo || "-"}</td>
            <td class="num">${Number(b.mrp || 0).toFixed(2)}</td>
            <td class="num">${Number(b.rate || 0).toFixed(2)}</td>
            <td class="num">${Number(b.gst || 0)}</td>
            <td class="num">${Number(b.qty || 0)}</td>
            <td class="num">${Number(b.value || 0).toFixed(2)}</td>
          </tr>
        `
        )
        .join("");

      return `
        <div class="bill">
          <div class="bill-header">
            <div><b>Order No:</b> ${p.orderNo || "-"}</div>
            <div><b>Invoice No:</b> ${p.invoiceNo || "-"}</div>
            <div><b>Date:</b> ${
              p.createdAt
                ? new Date(p.createdAt).toLocaleDateString("en-IN")
                : "-"
            }</div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="sn">S.No</th>
                <th>Product Code</th>
            <th class="product">Product Name</th>
                <th class="batch">Batch</th>
                <th class="num">MRP</th>
                <th class="num">Rate</th>
                <th class="num">GST%</th>
                <th class="num">Qty</th>
                <th class="num">Value</th>
              </tr>
            </thead>
            <tbody>
              ${batchRows || `
                <tr>
                  <td colspan="9" class="center">No items</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />

<style>
@page {
  size: A4;
  margin: 16mm;
}

body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11px;
  color: #000;
}

h1 {
  text-align: center;
  font-size: 16px;
  margin: 0;
}

h3 {
  text-align: center;
  font-size: 13px;
  margin: 4px 0 8px;
}

.period {
  text-align: center;
  font-size: 11px;
  font-weight: bold;
  margin-bottom: 12px;
}

.supplier {
  text-align: center;
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 14px;
}

.bill {
  margin-bottom: 18px;
  page-break-inside: avoid;
}

.bill-header {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: bold;
  margin-bottom: 6px;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

thead {
  display: table-header-group;
}

th {
  background: #f2f2f2;
  border: 1px solid #000;
  padding: 6px;
  font-size: 11px;
  text-align: center;
}

td {
  border: 1px solid #000;
  padding: 6px;
  vertical-align: middle;
}


.product {
  width: 15%;          /* 🔥 adjust: 25% / 30% as needed */
  text-align: left;
  word-wrap: break-word;
}

.batch {
  width: 12%;          /* 🔥 adjust: 25% / 30% as needed */
  text-align: left;
  word-wrap: break-word;
}


.sn {
  width: 4%;
  text-align: center;
}

.num {
  text-align: right;
}

.center {
  text-align: center;
}

tr {
  page-break-inside: avoid;
}
</style>
</head>

<body>

<h1>CSI Diocese Book Depot - ${shopname || ""}</h1>
<h3>Purchase – Supplier Bills Report</h3>
<div class="period">Date : ${periodLabel || ""}</div>
<div class="supplier">Supplier : ${supplierName || "-"}</div>

${billsHtml || `<p style="text-align:center">No bills found</p>`}

</body>
</html>
`;
};
