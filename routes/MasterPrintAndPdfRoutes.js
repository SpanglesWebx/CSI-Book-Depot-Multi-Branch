const express = require("express");
const router = express.Router();

const {
  printCollectionsCounter,
  pdfCollectionsCounter,
  printCollectionsUser,
  pdfCollectionsUser,
  printCollectionsStatement,
  pdfCollectionsStatement,
} = require("../controllers/MasterprintAndPdfController");

const authTenantOrMaster = require("../middleware/authTenantOrMaster");

// 🔐 MASTER ONLY
router.use(authTenantOrMaster);

// ================= COLLECTIONS (MASTER) =================
router.post("/master/collections/counter/print", printCollectionsCounter);
router.post("/master/collections/counter/pdf", pdfCollectionsCounter);

router.post("/master/collections/user/print", printCollectionsUser);
router.post("/master/collections/user/pdf", pdfCollectionsUser);

router.post("/master/collections/statement/print", printCollectionsStatement);
router.post("/master/collections/statement/pdf", pdfCollectionsStatement);

module.exports = router;
