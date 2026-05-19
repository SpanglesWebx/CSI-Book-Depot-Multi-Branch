const path = require("path");
const os = require("os");
const fs = require("fs-extra");
const print = require("pdf-to-printer");

const { generatePdf } = require("../utils/pdfGenerator");

// HTML builders
const buildCounterHtml = require("../utils/PrintAndPDF/CollectionCounterReportHtml");
const buildUserHtml = require("../utils/PrintAndPDF/CollectionUserReportHtml");
const buildStatementHtml = require("../utils/PrintAndPDF/CollectionStatementReportHtml");

// Optional: set printer name from env
const PRINTER = process.env.PRINTER || undefined;

/* ============================================================
   🔐 MASTER ACCESS GUARD (helper)
============================================================ */
function ensureMaster(req, res) {
  if (req.authType !== "master") {
    res.status(403).json({ message: "Master access only" });
    return false;
  }
  return true;
}

/* ============================================================
   📄 COUNTER REPORT
============================================================ */
exports.printCollectionsCounter = async (req, res) => {
  try {
    if (!ensureMaster(req, res)) return;

    const html = buildCounterHtml(req.body);
    const pdf = await generatePdf(html);

    const filePath = path.join(
      os.tmpdir(),
      `collections-counter-${Date.now()}.pdf`
    );

    await fs.writeFile(filePath, pdf);
    await print(filePath, PRINTER ? { printer: PRINTER } : undefined);
    await fs.remove(filePath);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ printCollectionsCounter error:", err);
    res.status(500).json({ message: "Failed to print counter report" });
  }
};

exports.pdfCollectionsCounter = async (req, res) => {
  try {
    if (!ensureMaster(req, res)) return;

    const html = buildCounterHtml(req.body);
    const pdf = await generatePdf(html);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=collections-counter.pdf"
    );
    res.end(pdf);
  } catch (err) {
    console.error("❌ pdfCollectionsCounter error:", err);
    res.status(500).json({ message: "Failed to generate counter PDF" });
  }
};

/* ============================================================
   👤 USER REPORT
============================================================ */
exports.printCollectionsUser = async (req, res) => {
  try {
    if (!ensureMaster(req, res)) return;

    const html = buildUserHtml(req.body);
    const pdf = await generatePdf(html);

    const filePath = path.join(
      os.tmpdir(),
      `collections-user-${Date.now()}.pdf`
    );

    await fs.writeFile(filePath, pdf);
    await print(filePath, PRINTER ? { printer: PRINTER } : undefined);
    await fs.remove(filePath);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ printCollectionsUser error:", err);
    res.status(500).json({ message: "Failed to print user report" });
  }
};

exports.pdfCollectionsUser = async (req, res) => {
  try {
    if (!ensureMaster(req, res)) return;

    const html = buildUserHtml(req.body);
    const pdf = await generatePdf(html);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=collections-user.pdf"
    );
    res.end(pdf);
  } catch (err) {
    console.error("❌ pdfCollectionsUser error:", err);
    res.status(500).json({ message: "Failed to generate user PDF" });
  }
};

/* ============================================================
   📊 STATEMENT REPORT
============================================================ */
exports.printCollectionsStatement = async (req, res) => {
  try {
    if (!ensureMaster(req, res)) return;

    const html = buildStatementHtml(req.body);
    const pdf = await generatePdf(html);

    const filePath = path.join(
      os.tmpdir(),
      `collections-statement-${Date.now()}.pdf`
    );

    await fs.writeFile(filePath, pdf);
    await print(filePath, PRINTER ? { printer: PRINTER } : undefined);
    await fs.remove(filePath);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ printCollectionsStatement error:", err);
    res.status(500).json({ message: "Failed to print statement report" });
  }
};

exports.pdfCollectionsStatement = async (req, res) => {
  try {
    if (!ensureMaster(req, res)) return;

    const html = buildStatementHtml(req.body);
    const pdf = await generatePdf(html);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=collections-statement.pdf"
    );
    res.end(pdf);
  } catch (err) {
    console.error("❌ pdfCollectionsStatement error:", err);
    res.status(500).json({ message: "Failed to generate statement PDF" });
  }
};
