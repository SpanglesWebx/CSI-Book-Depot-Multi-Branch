//server/server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http"); // ✅ Needed for socket.io
const { Server } = require("socket.io");
const { connectMasterDB } = require("./config/db");
const masterAuth = require("./middleware/masterAuth");
const startBackupCron = require("./cron/backupCron");
const authTenantOrMaster = require("./middleware/authTenantOrMaster");

const { getPrinters, print: pdfPrint } = require("pdf-to-printer");
const fs = require("fs-extra");
const puppeteer = require("puppeteer");
const path = require("path");

const { v4: uuidv4 } = require("uuid");

const os = require("os");
const router = express.Router();
const Bill = require("./models/SalesBill.js");

// ----------------------------
// TVS Printer Direct Print (ESC/POS)
// ----------------------------
const escpos = require("escpos");
escpos.USB = require("escpos-usb");

dotenv.config();
connectMasterDB();

startBackupCron();
require("./cron/stockReset")();
require("./cron/openingSnapshot")();
require("./cron/closingSnapshot")();

const app = express();
const server = http.createServer(app); // wrap express app

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-shopname"]
  }
});

// Make io available in requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// CORS configuration
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-shopname"]
}));

// 🚫 Disable cache for APIs
app.use("/api", (req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use(express.json({
  limit: "50mb"
}));

app.use(express.urlencoded({
  limit: "50mb",
  extended: true,
  parameterLimit: 50000
}));

// =============================================
// ✅ ROOT ROUTE - Fixes 404 error on domain
// =============================================
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CSI Book Depot API Server is running",
    status: "active",
    serverTime: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    availableEndpoints: {
      master: "/api/master/*",
      tenant: "/api/tenant/*",
      products: "/api/products",
      sales: "/api/sales",
      reports: "/api/reports",
      health: "/health"
    }
  });
});

// ✅ Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memoryUsage: process.memoryUsage(),
    nodeVersion: process.version
  });
});

// =============================================
// Master routes
// =============================================
app.use("/api/master/auth", require("./routes/masterAuthRoutes"));
app.use("/api/master/users", require("./middleware/masterAuth"), require("./routes/masterUser"));
app.use("/api/shops/public", require("./routes/shopPublicRoutes"));
app.use("/api/shops", require("./middleware/masterAuth"), require("./routes/shopRoutes"));

// =============================================
// Tenant routes
// =============================================
app.use("/api/tenant/auth", require("./routes/tenantAuthRoutes")); // public
app.use("/api/users", require("./middleware/masterAuth"), require("./routes/userRoutes"));
app.use("/api/tenant", authTenantOrMaster, require("./routes/tenantDataRoutes"));
app.use("/api/products", require("./middleware/tenantAuth"), require("./routes/productRoutes"));
app.use("/api/customers", require("./middleware/tenantAuth"), require("./routes/customerRoutes"));
app.use("/api/sales", require("./middleware/tenantMiddleware"), require("./routes/salesBillRoutes"));
app.use("/api/categories", require("./middleware/tenantMiddleware"), require("./routes/categoryRoutes"));
app.use("/api/search-products", require("./middleware/tenantMiddleware"), require("./routes/ProductSearchRoutes.js"));
app.use("/api/expenses", require("./middleware/tenantMiddleware"), require("./routes/expenseRoutes.js"));
app.use("/api/branch-reports", require("./routes/branchReportsRoutes"));

const supplierRoutes = require("./routes/supplierRoutes");
app.use("/api/suppliers", supplierRoutes);

app.use("/api", require("./routes/dashboardRoutes"));
app.use("/api", require("./routes/tenantDataRoutes"));

const MastersalesBillRoutes = require("./routes/MasterBill.js");
app.use("/api/tenant", MastersalesBillRoutes);

const purchaseRoutes = require("./routes/purchaseRoutes");
app.use("/api/purchases", purchaseRoutes);

// =============================================
// WebSocket connection
// =============================================
io.on("connection", (socket) => {
  console.log("⚡ Client connected:", socket.id);
  
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// ✅ Import route files
const reportsRoutes = require("./routes/reports");
app.use("/api", reportsRoutes);

const printAndPdfRoutes = require("./routes/printAndPdfRoutes");
app.use("/api", printAndPdfRoutes);

const masterPrintAndPdfRoutes = require("./routes/MasterPrintAndPdfRoutes.js");
app.use("/api", masterPrintAndPdfRoutes);

// Helper function
function escape(v) {
  return String(v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// =============================================
// Print bill endpoint (fixed)
// =============================================
app.post("/api/print-bill", async (req, res) => {
  let pdfPath = null;
  let browser = null;
  
  try {
    const { bill } = req.body;
    if (!bill) {
      return res.status(400).json({ success: false, message: "Missing bill data" });
    }

    // 🧾 Build printable HTML for the bill
    const html = `
      <html>
      <head>
        <style>
          @page { size: 7.5cm auto; margin: 0; }
          body {
            width: 7.5cm;
            font-family: Arial, sans-serif;
            font-size: 10px;
            margin: 0;
            padding: 5px;
            color: #000;
            text-align: center;
          }
          .logo {
            width: 40px;
            margin: 0 auto 4px;
          }
          hr {
            border: 0.5px dashed #000;
            margin: 4px 0;
          }
          .header, .footer {
            text-align: center;
            color: #006400;
            font-weight: bold;
          }
          .table {
            width: 90%;
            margin: 0 auto;
            text-align: left;
          }
          .row {
            display: flex;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <img src="file://${path.join(__dirname, "public/logo-icon.png")}" class="logo" />
        <div class="header">CSI Diocese Book Depot</div>
        <div class="header">${bill.shopName || "Main Branch"}</div>
        <div>${bill.shopAddress || ""}</div>
        <div>Ph: ${bill.shopPhone || "N/A"}</div>
        <hr>
        <div class="row"><span>Bill No:</span><span>${bill.billNo || "-"}</span></div>
        <div class="row"><span>Date:</span><span>${bill.date}</span></div>
        <hr>
        <div class="table">
          <div class="row" style="font-weight: bold;">
            <span>Product</span>
            <span>Qty</span>
            <span>Rate</span>
            <span>Value</span>
          </div>
          ${(bill.items || [])
        .map(
          (it) => `
              <div class="row">
                <span>${it.name?.substring(0, 10)}</span>
                <span>${it.qty}</span>
                <span>${Number(it.rate).toFixed(2)}</span>
                <span>${Number(it.value).toFixed(2)}</span>
              </div>`
        )
        .join("")}
        </div>
        <hr>
        <div class="row"><span>Total:</span><span>₹${Number(bill.total).toFixed(2)}</span></div>
        <div class="row"><span>Net:</span><span>₹${Number(bill.netAmount).toFixed(2)}</span></div>
        <div class="row"><span>Paid:</span><span>₹${Number(bill.cashGiven).toFixed(2)}</span></div>
        <div class="row"><span>Balance:</span><span>₹${Number(bill.balance).toFixed(2)}</span></div>
        <hr>
        <div class="footer">GOD IS OUR REFUGE AND STRENGTH</div>
      </body>
      </html>
    `;

    // 🧩 Generate PDF using Puppeteer
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for hosting environments
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, "temp");
    await fs.ensureDir(tempDir);
    
    pdfPath = path.join(tempDir, `bill_${Date.now()}.pdf`);
    await page.pdf({ path: pdfPath, width: "7.5cm", printBackground: true });
    await browser.close();
    browser = null;

    // 🖨️ Print PDF via default printer
    await pdfPrint(pdfPath);

    // Clean up temp file
    if (pdfPath && await fs.pathExists(pdfPath)) {
      await fs.unlink(pdfPath);
    }

    res.json({ success: true, message: "Bill printed successfully" });
  } catch (err) {
    console.error("Print error:", err);
    
    // Clean up browser if still open
    if (browser) {
      await browser.close().catch(console.error);
    }
    
    // Clean up temp file if it exists
    if (pdfPath && await fs.pathExists(pdfPath)) {
      await fs.unlink(pdfPath).catch(console.error);
    }
    
    res.status(500).json({ success: false, error: err.message });
  }
});

// =============================================
// 404 handler for undefined routes
// =============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    requestedUrl: req.url,
    method: req.method,
    availableAt: "/"
  });
});

// =============================================
// Global error handler
// =============================================
app.use((err, req, res, next) => {
  console.error("❌ Error:", err);
  res.status(500).json({ 
    success: false,
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// =============================================
// Server listening on all interfaces
// =============================================
const PORT = process.env.PORT || 3000; // Changed default to 3000, but will use env PORT

// Bind to all network interfaces (0.0.0.0) for hosting compatibility
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🌐 Access at: https://csibookdepotnode4.zozweb.in or http://localhost:${PORT}`);
  // console.log(`🌐 Access at: http://localhost:${PORT}`); //Changed for development
  console.log(`✅ Health check: /health`);
  console.log(`📡 WebSocket ready`);
});