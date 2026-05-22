

 //routes/PrintAndPdfRoutes.js
const express = require("express");
const router = express.Router();

const {
  // ================= STOCK =================
  printStockReport,
  downloadStockReportPdf,
  printCategoryProducts,
  downloadCategoryProductsPdf,

  // ================= PURCHASE =================
  printPurchaseRegister,
  downloadPurchaseRegisterPdf,
  printPurchaseView,
  downloadPurchaseViewPdf,
  printPurchaseSupplier,
  downloadPurchaseSupplierPdf,
  printPurchaseGst,
  downloadPurchaseGstPdf,
  printSupplierBills,
  downloadSupplierBillsPdf,

  // ================= SALES =================
  printSalesBillWise,
  pdfSalesBillWise,

  // ================= ITEMWISE =================
  printItemWiseReport,
  // pdfItemWiseReport,

  // ================= EXPENSE =================
  printExpenseReport,
  pdfExpenseReport,
  printExpenseViewReport,
  pdfExpenseViewReport,
  printExpenseCategory,
  pdfExpenseCategory,
  printExpenseCategoryDetails,
  pdfExpenseCategoryDetails,

  // ================= COLLECTIONS =================
  printCollectionsCounter,
  pdfCollectionsCounter,
  printCollectionsUser,
  pdfCollectionsUser,
  printCollectionsStatement,
  pdfCollectionsStatement

} = require("../controllers/printAndPdfController");

// const authTenantOrMaster = require("../middleware/authTenantOrMaster");
const tenantMiddleware = require("../middleware/tenantMiddleware");

// 🔐 SECURITY FIRST
router.use( tenantMiddleware);

// ================= STOCK =================
router.post("/stock/print", printStockReport);
router.post("/stock/pdf", downloadStockReportPdf);

router.post("/category-products/print", printCategoryProducts);
router.post("/category-products/pdf", downloadCategoryProductsPdf);



// ================= PURCHASE =================
router.post("/purchase/register/print", printPurchaseRegister);
router.post("/purchase/register/pdf", downloadPurchaseRegisterPdf);

router.post("/purchase/view/print", printPurchaseView);
router.post("/purchase/view/pdf", downloadPurchaseViewPdf);


router.post("/purchase/supplier/print", printPurchaseSupplier);
router.post("/purchase/supplier/pdf", downloadPurchaseSupplierPdf);

router.post("/purchase/gst/print", printPurchaseGst);
router.post("/purchase/gst/pdf", downloadPurchaseGstPdf);

router.post("/purchase/supplier-bills/print", printSupplierBills);
router.post("/purchase/supplier-bills/pdf", downloadSupplierBillsPdf);


// ================= SALES =================
router.post("/sales/billwise/print", printSalesBillWise);
router.post("/sales/billwise/pdf", pdfSalesBillWise);

// ================= ITEMWISE =================
router.post("/itemwise/print", printItemWiseReport);
// router.post("/itemwise/pdf", pdfItemWiseReport);

// ================= EXPENSE =================
router.post("/expense/print", printExpenseReport);
// router.post("/expense/pdf", pdfExpenseReport);

router.post("/expense/view/print", printExpenseViewReport);
router.post("/expense/view/pdf", pdfExpenseViewReport);


router.post("/expense/category/print", printExpenseCategory);
// router.post("/expense/category/pdf", pdfExpenseCategory);

router.post("/expense/category/details/print", printExpenseCategoryDetails);
// router.post("/expense/category/details/pdf", pdfExpenseCategoryDetails);

// ================= COLLECTIONS =================
router.post("/collections/counter/print", printCollectionsCounter);
router.post("/collections/counter/pdf", pdfCollectionsCounter);

router.post("/collections/user/print", printCollectionsUser);
router.post("/collections/user/pdf", pdfCollectionsUser);

router.post("/collections/statement/print", printCollectionsStatement);
router.post("/collections/statement/pdf", pdfCollectionsStatement);

module.exports = router;
