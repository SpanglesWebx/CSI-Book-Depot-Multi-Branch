// routes/branchReportsRoutes.js
const express = require("express");
const router = express.Router();

const authTenantOrMaster = require("../middleware/authTenantOrMaster")

const tenantAuth = require("../middleware/tenantAuth");
const tenantMiddleware = require("../middleware/tenantMiddleware");
const { getBranchSalesBills, 
        getItemwiseSalesReport,  
        getItemwiseBillReport, 
        getDateWiseReport,
        getCollectionsCounterReport,
     getCollectionsUserReport,
    getCollectionStatementReport,
    getUsersList,
    getStockReport,
    getStockcategorywiseReport,
    getpurchaseregisterwiseReport,
    getpurchasenameregisterReport,
    getPurchaseGstReport,
      getSupplierBillsByPeriod,
    getExpenseReport,
      getExpenseCategoryReport,
      getCategoryProductsReport,
      getExpenseCategoryDetails,
} = require("../controllers/branchReportsController");

// Apply tenant auth + tenant DB loader
router.use(tenantAuth, tenantMiddleware);

// GET /api/branch-reports/salesbills
router.get("/salesbills", getBranchSalesBills);

router.get("/itemwise/sales",getItemwiseSalesReport);

router.get("/itemwise/bills",getItemwiseBillReport);
// DATE WISE REPORT
router.get("/datewise", getDateWiseReport);


// COUNTER WISE COLLECTION REPORT
router.get("/collections/counter", getCollectionsCounterReport);

// USER WISE COLLECTION REPORT
router.get("/collections/user", getCollectionsUserReport);

router.get("/collections/users/list", getUsersList);

// COLLECTION STATEMENT REPORT
router.get("/collections/statement", getCollectionStatementReport);



// STOCK REPORT
router.get("/stock", getStockReport);

router.get("/stock/categorywise", getStockcategorywiseReport);

router.get( "/stock/category/products",getCategoryProductsReport);



// PURCHASE REPORT

router.get("/purchase/registerwise", getpurchaseregisterwiseReport);


router.get("/purchase/nameregister", getpurchasenameregisterReport);

router.get("/purchase/gstreport", getPurchaseGstReport);


router.get(
  "/purchase/supplier/:supplierName",
  getSupplierBillsByPeriod
);


// Expense reports
router.get("/expense",  getExpenseReport);

// Expense category reports
router.get(
  "/expense/categoryreports",getExpenseCategoryReport
);

router.get(
  "/expense/category/details",getExpenseCategoryDetails
);





// router.get(
//   "/itemwise/export",
//   authTenantOrMaster,
//   tenantMiddleware,
//   (req, res) => {
//     const { mode } = req.query;

//     if (mode === "bill") return getItemwiseBillReport(req, res);
//     if (mode === "sales") return getItemwiseSalesReport(req, res);
//     if (mode === "datewise") return getDateWiseReport(req, res);

//     return res.status(400).json({ message: "Invalid itemwise mode" });
//   }
// );


// export for both tenant + master
router.get(
  "/itemwise/export",
  authTenantOrMaster,
  tenantMiddleware,
  (req, res) => {
    const { mode } = req.query;
    if (mode === "bill") return getItemwiseBillReport(req, res);
    if (mode === "sales") return getItemwiseSalesReport(req, res);
    if (mode === "datewise") return getDateWiseReport(req, res);
    res.status(400).json({ message: "Invalid itemwise mode" });
  }
);



module.exports = router;
