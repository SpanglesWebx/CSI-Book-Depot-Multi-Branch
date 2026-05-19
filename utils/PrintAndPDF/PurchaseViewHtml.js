module.exports.buildPurchaseViewHtml = ({
  shopname,
  periodLabel,
  purchase,
}) => {
  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN") : "-";

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

    h2, h3 { 
      text-align: center; 
      margin: 4px 0; 
    }

    h2 {
      font-size: 16px;
    }

    h3 {
      font-size: 13px;
      font-weight: normal;
    }

    p {
      font-size: 11px;
      margin: 4px 0 8px 0;
    }

    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 10px; 
      font-size: 11px;
    }

    th, td { 
      border: 1px solid #000; 
      padding: 5px 6px; 
      vertical-align: middle;
    }

    th { 
      background: #eaeaea; 
      font-weight: bold;
      text-align: center;
    }

    .r { text-align: right; }

    thead { display: table-header-group; }

    tr { page-break-inside: avoid; }

  </style>
</head>
<body>

<h2>CSI Diocese Book Depot - ${shopname || ""}</h2>

<h3>Purchase Order — ${purchase.orderNo}</h3>
<p style="text-align:center">${periodLabel || ""}</p>

<table>

  <tr>
     <th>Supplier Id</th>
    <td>${purchase.supplierId}</td>
    <th>Supplier</th>
    <td>${purchase.supplierName}</td>
    <th>Mobile</th>
    <td>${purchase.supplierMobile || "-"}</td>
  </tr>
  <tr>
    <th>Invoice No</th>
    <td>${purchase.invoiceNo || "-"}</td>
    <th>Invoice Date</th>
    <td>${formatDate(purchase.invoiceDate)}</td>
      <th>Stocked Date</th>
    <td>${formatDate(purchase.stockedDate)}</td>
  </tr>

</table>

<table>
  <thead>
    <tr>
      <th>S.No</th>
           <th>Product Code</th>
    
      <th>Product Name</th>
      <th>Batch</th>
      <th>MRP</th>
      <th>Rate</th>
      <th>GST%</th>
      <th>Qty</th>
      <th class="r">Value</th>
    </tr>
  </thead>
  <tbody>
    ${(purchase.batches || [])
      .map(
        (b, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${b.code}</td>
        <td>${b.name}</td>
        <td>${b.batchNo}</td>
        <td>${b.mrp}</td>
        <td>${b.rate}</td>
        <td>${b.gst}</td>
        <td>${b.qty}</td>
        <td class="r">${Number(b.value || 0).toFixed(2)}</td>
      </tr>
    `
      )
      .join("")}
  </tbody>
</table>

</body>
</html>
`;
};