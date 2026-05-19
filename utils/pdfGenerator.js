// server/utils/pdfGenerator.js
const puppeteer = require("puppeteer");

/**
 * Generate PDF buffer from HTML string
 * @param {string} html
 * @returns {Promise<Buffer>}
 */
async function generatePdf(html) {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "new", // required for newer Node versions
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    // Better rendering for tables
    await page.setViewport({
      width: 1200,
      height: 800,
      deviceScaleFactor: 1,
    });

    await page.setContent(html, {
      waitUntil: ["load", "domcontentloaded", "networkidle0"],
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "15mm",
        right: "10mm",
        bottom: "15mm",
        left: "10mm",
      },
    });

    return pdfBuffer;
  } catch (err) {
    console.error("❌ PDF generation error:", err);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  generatePdf,
};
