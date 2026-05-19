
//controllers/printAndPdfController.js
const puppeteer = require("puppeteer");
const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const pdfPrint = require("pdf-to-printer");
const { print } = require("pdf-to-printer"); 
const Product = require("../models/Product"); // ✅ IMPORT MODEL
const { buildStockReportHtml } = require(
  "../utils/PrintAndPDF/buildStockReportHtml"
);

const { buildCategoryProductsHtml } = require(
  "../utils/PrintAndPDF/buildCategoryProductsHtml"
);

const PRINTER = process.env.PRINTER;

exports.printStockReport = async (req, res) => {
  try {
    const { shopname, mode, periodLabel, rows } = req.body;

    const html = buildStockReportHtml({
      shopname,
      mode,
      periodLabel,
      rows,
    });

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    const tempFile = path.join(os.tmpdir(), `stock-${Date.now()}.pdf`);
    await fs.writeFile(tempFile, pdfBuffer);

    // ✅ CORRECT PRINT CALL
    await print(tempFile, {
      printer: PRINTER,
      copies: 1,
    });

    await fs.remove(tempFile);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ PRINT ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};


exports.downloadStockReportPdf = async (req, res) => {
  try {
    const { shopname, mode, periodLabel, rows } = req.body;

    const html = buildStockReportHtml({
      shopname,
      mode,
      periodLabel,
      rows,
    });

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Stock_Report_${new Date().toLocaleDateString("en-IN")}.pdf`
    );
    res.end(pdfBuffer);
  } catch (err) {
    console.error("❌ PDF ERROR:", err);
    res.status(500).json({ success: false });
  }
};



// ---------------------------------------------
// PRINT CATEGORY PRODUCTS
// ---------------------------------------------
exports.printCategoryProducts = async (req, res) => {
  try {
    const Product =
      req.tenantModels?.Product || require("../models/Product");

    const { shopname, category, periodLabel } = req.body;

    // ----------------------------------
    // FETCH PRODUCTS (UPDATED)
    // ----------------------------------
    const products = await Product.find({
      category,
      status: "active",
    })
      .select("code name batches totalQty")
      .lean();

    // ----------------------------------
    // BUILD ROWS + TOTALS (UPDATED)
    // ----------------------------------
    let totalQty = 0;
    let totalValue = 0;

    const rows = products.map((p) => {
      const qty = Number(p.totalQty || 0);

      const batches = (p.batches || []).filter(
        (b) => b.status === "active"
      );

      let remainingQty = qty;
      let productValue = 0;

      // FIFO VALUE
      for (const b of batches) {
        if (remainingQty <= 0) break;

        const batchQty = Number(b.qty || 0);
        const price = Number(b.salePrice || b.mrp || 0);

        if (batchQty <= 0 || price <= 0) continue;

        const usedQty = Math.min(batchQty, remainingQty);
        productValue += usedQty * price;
        remainingQty -= usedQty;
      }

      totalQty += qty;
      totalValue += productValue;

      return {
        code: p.code,
        name: p.name,
        qty,
        value: productValue,
      };
    });

    // ----------------------------------
    // BUILD HTML (UPDATED)
    // ----------------------------------
    const html = buildCategoryProductsHtml({
      shopname,
      category,
      periodLabel,
      rows,
      totalQty,
      totalValue,
    });

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    const tempFile = path.join(os.tmpdir(), `category-${Date.now()}.pdf`);
    await fs.writeFile(tempFile, pdfBuffer);

    await print(tempFile, {
      printer: PRINTER,
      copies: 1,
    });

    await fs.remove(tempFile);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ CATEGORY PRINT ERROR", err);
    res.status(500).json({ success: false });
  }
};



// ---------------------------------------------
// DOWNLOAD CATEGORY PRODUCTS PDF
// ---------------------------------------------
exports.downloadCategoryProductsPdf = async (req, res) => {
  try {
    const Product =
      req.tenantModels?.Product || require("../models/Product");

    const { shopname, category, periodLabel } = req.body;

    // ----------------------------------
    // FETCH PRODUCTS (UPDATED)
    // ----------------------------------
    const products = await Product.find({
      category,
      status: "active",
    })
      .select("code name batches totalQty")
      .lean();

    // ----------------------------------
    // BUILD ROWS + TOTALS (UPDATED)
    // ----------------------------------
    let totalQty = 0;
    let totalValue = 0;

    const rows = products.map((p) => {
      const qty = Number(p.totalQty || 0);

      const batches = (p.batches || []).filter(
        (b) => b.status === "active"
      );

      let remainingQty = qty;
      let productValue = 0;

      // FIFO VALUE
      for (const b of batches) {
        if (remainingQty <= 0) break;

        const batchQty = Number(b.qty || 0);
        const price = Number(b.salePrice || b.mrp || 0);

        if (batchQty <= 0 || price <= 0) continue;

        const usedQty = Math.min(batchQty, remainingQty);
        productValue += usedQty * price;
        remainingQty -= usedQty;
      }

      totalQty += qty;
      totalValue += productValue;

      return {
        code: p.code,
        name: p.name,
        qty,
        value: productValue,
      };
    });

    // ----------------------------------
    // BUILD HTML (UPDATED)
    // ----------------------------------
    const html = buildCategoryProductsHtml({
      shopname,
      category,
      periodLabel,
      rows,
      totalQty,
      totalValue,
    });

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${category}_Stock.pdf`
    );
    res.end(pdf);
  } catch (err) {
    console.error("❌ CATEGORY PDF ERROR", err);
    res.status(500).json({ success: false });
  }
};





/* ===============================
   Purchase
================================ */

const {
  buildPurchaseRegisterHtml,
} = require("../utils/PrintAndPDF/buildPurchaseRegisterHtml");
const {
  buildPurchaseNameRegisterHtml,
} = require("../utils/PrintAndPDF/buildPurchaseNameRegisterHtml");
const {
  buildPurchaseGstHtml,
} = require("../utils/PrintAndPDF/buildPurchaseGstHtml");


async function generatePdf(html) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
  });

  await browser.close();
  return pdf;
}

/* ================= PURCHASE REGISTER ================= */

exports.printPurchaseRegister = async (req, res) => {
  const pdf = await generatePdf(
    buildPurchaseRegisterHtml(req.body)
  );

  const file = path.join(os.tmpdir(), `purchase-${Date.now()}.pdf`);
  await fs.writeFile(file, pdf);
  await print(file, { printer: PRINTER });
  await fs.remove(file);

  res.json({ success: true });
};

exports.downloadPurchaseRegisterPdf = async (req, res) => {
  const pdf = await generatePdf(
    buildPurchaseRegisterHtml(req.body)
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=Purchase_Register.pdf"
  );
  res.end(pdf);
};




const { buildPurchaseViewHtml } = require(
  "../utils/PrintAndPDF/PurchaseViewHtml"
);

exports.printPurchaseView = async (req, res) => {
  try {
    const pdf = await generatePdf(
      buildPurchaseViewHtml(req.body)
    );

    const file = path.join(os.tmpdir(), `purchase-${Date.now()}.pdf`);
    await fs.writeFile(file, pdf);

    await print(file);
    await fs.remove(file);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Purchase view print error:", err);
    res.status(500).json({ message: "Print failed" });
  }
};

exports.downloadPurchaseViewPdf = async (req, res) => {
  try {
    const pdf = await generatePdf(
      buildPurchaseViewHtml(req.body)
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Purchase_View.pdf"
    );
    res.end(pdf);
  } catch (err) {
    console.error("❌ Purchase view PDF error:", err);
    res.status(500).json({ message: "PDF failed" });
  }
};


/* ================= SUPPLIER ================= */

exports.printPurchaseSupplier = async (req, res) => {
  const pdf = await generatePdf(
    buildPurchaseNameRegisterHtml(req.body)
  );

  const file = path.join(os.tmpdir(), `supplier-${Date.now()}.pdf`);
  await fs.writeFile(file, pdf);
  await print(file, { printer: PRINTER });
  await fs.remove(file);

  res.json({ success: true });
};

exports.downloadPurchaseSupplierPdf = async (req, res) => {
  const pdf = await generatePdf(
    buildPurchaseNameRegisterHtml(req.body)
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=Supplier_Report.pdf"
  );
  res.end(pdf);
};

/* ================= GST ================= */

exports.printPurchaseGst = async (req, res) => {
  const pdf = await generatePdf(
    buildPurchaseGstHtml(req.body)
  );

  const file = path.join(os.tmpdir(), `gst-${Date.now()}.pdf`);
  await fs.writeFile(file, pdf);
  await print(file, { printer: PRINTER });
  await fs.remove(file);

  res.json({ success: true });
};

exports.downloadPurchaseGstPdf = async (req, res) => {
  const pdf = await generatePdf(
    buildPurchaseGstHtml(req.body)
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=GST_Report.pdf"
  );
  res.end(pdf);
};




const { buildSupplierBillsHtml } = require(
  "../utils/PrintAndPDF/SupplierDetailsHtml"
);

exports.printSupplierBills = async (req, res) => {
  const pdf = await generatePdf(
    buildSupplierBillsHtml(req.body)
  );

  const file = path.join(os.tmpdir(), `supplier-${Date.now()}.pdf`);
  await fs.writeFile(file, pdf);
  await print(file, { printer: PRINTER });
  await fs.remove(file);

  res.json({ success: true });
};

exports.downloadSupplierBillsPdf = async (req, res) => {
  const pdf = await generatePdf(
    buildSupplierBillsHtml(req.body)
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=Supplier_Bills.pdf"
  );
  res.end(pdf);
};



//Sales Bill

const { buildSalesBillWiseHtml } = require(
  "../utils/PrintAndPDF/SalesBillHtml"
);


exports.printSalesBillWise = async (req, res) => {
  try {
    const html = buildSalesBillWiseHtml(req.body);

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    const tempFile = path.join(os.tmpdir(), `billwise-${Date.now()}.pdf`);
    await fs.writeFile(tempFile, pdfBuffer);

    await print(tempFile, {
      printer: PRINTER,
      copies: 1,
    });

    await fs.remove(tempFile);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Sales Bill Print Error:", err);
    res.status(500).json({ message: "Failed to print billwise sales" });
  }
};


exports.pdfSalesBillWise = async (req, res) => {
  try {
    const html = buildSalesBillWiseHtml(req.body);

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=BillWiseSales.pdf"
    );

    res.end(pdfBuffer);
  } catch (err) {
    console.error("❌ Sales Bill PDF Error:", err);
    res.status(500).json({ message: "Failed to generate billwise PDF" });
  }
};







const htmlPdf = require("html-pdf");

const buildItemWiseBillHtml = require("../utils/PrintAndPDF/ItemWiseBillReportHtml");
const buildItemWiseSalesHtml = require("../utils/PrintAndPDF/ItemWiseSalesReportHtml");
const buildItemWiseDateHtml = require("../utils/PrintAndPDF/ItemWiseDateReportHtml");

const getHtmlByMode = (mode, payload) => {
  if (mode === "bill") return buildItemWiseBillHtml(payload);
  if (mode === "sales") return buildItemWiseSalesHtml(payload);
  if (mode === "datewise") return buildItemWiseDateHtml(payload);
  throw new Error("Invalid ItemWise mode");
};

/* ---------------- PRINT ---------------- */
exports.printItemWiseReport = (req, res) => {
  const html = getHtmlByMode(req.body.mode, req.body);
  res.send(html);
};

/* ---------------- PDF ---------------- */
exports.pdfItemWiseReport = (req, res) => {
  const html = getHtmlByMode(req.body.mode, req.body);

  htmlPdf.create(html, { format: "A4", border: "10mm" })
    .toBuffer((err, buffer) => {
      if (err) return res.status(500).send(err.message);

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=ItemWise.pdf"
      });

      res.send(buffer);
    });
};




//Expense Report 

const expenseHtml = require("../utils/PrintAndPDF/ExpenseReportHtml");
const categoryHtml = require("../utils/PrintAndPDF/ExpenseCategoryReportHtml");

exports.printExpenseReport = (req, res) => {
  res.send(expenseHtml(req.body));
};

exports.pdfExpenseReport = (req, res) => {
  const html = expenseHtml(req.body);
  htmlPdf.create(html).toBuffer((err, buf) => {
    res.set({ "Content-Type": "application/pdf" });
    res.send(buf);
  });
};

exports.printExpenseCategory = (req, res) => {
  res.send(categoryHtml(req.body));
};

exports.pdfExpenseCategory = (req, res) => {
  const html = categoryHtml(req.body);
  htmlPdf.create(html).toBuffer((err, buf) => {
    res.set({ "Content-Type": "application/pdf" });
    res.send(buf);
  });
};


const {
  buildExpenseViewHtml,
} = require("../utils/PrintAndPDF/ExpenseViewHtml");



/**
 * POST /expense/view/print
 * BODY: { shopname, periodLabel, expense }
 */
exports.printExpenseViewReport = async (req, res) => {
  try {
    const { shopname, periodLabel, expense } = req.body;

    if (!expense) {
      return res.status(400).json({ message: "Expense data missing" });
    }

    const pdf = await generatePdf(
      buildExpenseViewHtml({
        shopname,
        periodLabel,
        expense,
      })
    );

    const file = path.join(
      os.tmpdir(),
      `expense-view-${Date.now()}.pdf`
    );

    await fs.writeFile(file, pdf);
    await print(file, { printer: PRINTER });
    await fs.remove(file);

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Expense view print error:", err);
    return res.status(500).json({
      message: "Failed to print expense view",
      error: err.message,
    });
  }
};


/**
 * POST /expense/view/pdf
 * BODY: { shopname, periodLabel, expense }
 */
exports.pdfExpenseViewReport = async (req, res) => {
  try {
    const { shopname, periodLabel, expense } = req.body;

    if (!expense) {
      return res.status(400).json({ message: "Expense data missing" });
    }

    const pdf = await generatePdf(
      buildExpenseViewHtml({
        shopname,
        periodLabel,
        expense,
      })
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Expense_${expense.receiptNo || "View"}.pdf`
    );

    return res.end(pdf);
  } catch (err) {
    console.error("❌ Expense view PDF error:", err);
    return res.status(500).json({
      message: "Failed to generate expense view PDF",
      error: err.message,
    });
  }
};




const buildExpenseCategoryViewHtml = require(
  "../utils/PrintAndPDF/ExpenseCategoryViewModelReportHtml"
);

exports.printExpenseCategoryDetails = (req, res) => {
  const html = buildExpenseCategoryViewHtml(req.body);
  res.send(html);
};

exports.pdfExpenseCategoryDetails = (req, res) => {
  const html = buildExpenseCategoryViewHtml(req.body);

  htmlPdf.create(html, { format: "A4" }).toBuffer((err, buffer) => {
    if (err) return res.status(500).send(err.message);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=Category_Expense.pdf",
    });

    res.send(buffer);
  });
};






async function generatePdf(html) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "domcontentloaded" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
  });

  await browser.close();
  return pdfBuffer;
}



const buildCounterHtml = require("../utils/PrintAndPDF/CollectionCounterReportHtml");

exports.printCollectionsCounter = async (req, res) => {
  const html = buildCounterHtml(req.body);
  const pdf = await generatePdf(html);

  const file = path.join(os.tmpdir(), `collections-counter-${Date.now()}.pdf`);
  await fs.writeFile(file, pdf);
  await print(file, { printer: PRINTER });
  await fs.remove(file);

  res.json({ success: true });
};

exports.pdfCollectionsCounter = async (req, res) => {
  const html = buildCounterHtml(req.body);
  const pdf = await generatePdf(html);

  res.setHeader("Content-Type", "application/pdf");
  res.end(pdf);
};



const buildUserHtml = require("../utils/PrintAndPDF/CollectionUserReportHtml");

exports.printCollectionsUser = async (req, res) => {
  const html = buildUserHtml(req.body);
  const pdf = await generatePdf(html);

  const file = path.join(os.tmpdir(), `collections-user-${Date.now()}.pdf`);
  await fs.writeFile(file, pdf);
  await print(file, { printer: PRINTER });
  await fs.remove(file);

  res.json({ success: true });
};

exports.pdfCollectionsUser = async (req, res) => {
  const html = buildUserHtml(req.body);
  const pdf = await generatePdf(html);

  res.setHeader("Content-Type", "application/pdf");
  res.end(pdf);
};





const buildStatementHtml = require("../utils/PrintAndPDF/CollectionStatementReportHtml");

exports.printCollectionsStatement = async (req, res) => {
  const html = buildStatementHtml(req.body);
  const pdf = await generatePdf(html);

  const file = path.join(os.tmpdir(), `collections-statement-${Date.now()}.pdf`);
  await fs.writeFile(file, pdf);
  await print(file, { printer: PRINTER });
  await fs.remove(file);

  res.json({ success: true });
};

exports.pdfCollectionsStatement = async (req, res) => {
  const html = buildStatementHtml(req.body);
  const pdf = await generatePdf(html);

  res.setHeader("Content-Type", "application/pdf");
  res.end(pdf);
};



