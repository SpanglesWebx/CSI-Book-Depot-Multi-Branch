/**
 * Expense View — Print / PDF HTML
 * - Single expense only (view mode)
 * - A4 layout
 * - Mirrors ExpenseViewModal (key–value rows)
 */

module.exports.buildExpenseViewHtml = ({
  shopname = "",
  periodLabel = "",
  expense = {},
}) => {
  const fmt = (v) => (v === undefined || v === null || v === "" ? "-" : v);

  const formatDate = (d) => {
    if (!d) return "-";
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return "-";
    const dd = String(x.getDate()).padStart(2, "0");
    const mm = String(x.getMonth() + 1).padStart(2, "0");
    const yy = x.getFullYear();
    return `${dd}/${mm}/${yy}`;
  };

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Expense View</title>

<style>
  @page {
    size: A4;
    margin: 16mm;
  }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #000;
  }

  h1 {
    text-align: center;
    font-size: 18px;
    margin: 0;
  }

  h3 {
    text-align: center;
    font-size: 14px;
    margin: 6px 0 10px;
  }

  .period {
    text-align: center;
    font-size: 12px;
    font-weight: bold;
    margin-bottom: 16px;
  }

  .card {
    border: 1px solid #000;
    border-radius: 6px;
    padding: 14px 16px;
  }

  .row {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid #ddd;
  }

  .row:last-child {
    border-bottom: none;
  }

  .key {
    width: 35%;
    font-weight: bold;
  }

  .value {
    width: 60%;
    text-align: right;
    word-break: break-word;
  }

  .amount {
    font-size: 14px;
    font-weight: bold;
  }

  .footer {
    margin-top: 24px;
    display: flex;
    justify-content: space-between;
    font-size: 11px;
  }
</style>
</head>

<body>

  <h1>CSI Diocese Book Depot - ${fmt(shopname)}</h1>
  <h3>Expense View Report</h3>
 

  <div class="card">

    <div class="row">
      <div class="key">Receipt No</div>
      <div class="value">${fmt(expense.receiptNo)}</div>
    </div>

    <div class="row">
      <div class="key">Date</div>
      <div class="value">${formatDate(expense.date)}</div>
    </div>

    <div class="row">
      <div class="key">Spend To</div>
      <div class="value">${fmt(expense.spendTo || expense.spendto)}</div>
    </div>

    <div class="row">
      <div class="key">Category</div>
      <div class="value">${fmt(expense.category)}</div>
    </div>

    <div class="row">
      <div class="key">Payment For / Reason</div>
      <div class="value">${fmt(expense.reason)}</div>
    </div>

    <div class="row">
      <div class="key">Reference Type</div>
      <div class="value" style="text-transform:capitalize">
        ${fmt(expense.refType)}
      </div>
    </div>

    <div class="row">
      <div class="key">${
        expense.refType === "voucher" ? "Voucher No" : "Bill No"
      }</div>
      <div class="value">${fmt(expense.refNumber)}</div>
    </div>

    <div class="row">
      <div class="key">Added By</div>
      <div class="value">${fmt(expense.addedByName)}</div>
    </div>

    <div class="row">
      <div class="key">Amount</div>
      <div class="value amount">
        ₹ ${Number(expense.amount || 0).toFixed(2)}
      </div>
    </div>

  </div>


</body>
</html>
`;
};
