

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

// const { print } = require("pdf-to-printer");
// const fs = require("fs");




const { getPrinters, print: pdfPrint } = require("pdf-to-printer");
// const { print } = require("pdf-to-printer");
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
// ----------------------------
// ✅ DIRECT THERMAL PRINTER (TVS 3-inch) ENDPOINT
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
  cors: { origin: "http://localhost:2026", methods: ["GET", "POST"] },
});

// Make io available in requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// app.use(cors({ origin: "http://localhost:2026", credentials: true }));
app.use(cors({
  origin: true,
  credentials: true
}));

// app.use(express.json());


app.use(express.json({
  limit: "50mb"
}));

app.use(express.urlencoded({
  limit: "50mb",
  extended: true,
  parameterLimit: 50000
}));

// ----------------------------
// Master routes
// ----------------------------
app.use("/api/master/auth", require("./routes/masterAuthRoutes"));
app.use("/api/master/users", require("./middleware/masterAuth"), require("./routes/masterUser"));
app.use("/api/shops/public", require("./routes/shopPublicRoutes"));
app.use("/api/shops", require("./middleware/masterAuth"), require("./routes/shopRoutes"));

// ----------------------------
// Tenant routes
// ----------------------------
app.use("/api/tenant/auth", require("./routes/tenantAuthRoutes")); // public
app.use("/api/users", require("./middleware/masterAuth"), require("./routes/userRoutes"));
app.use("/api/tenant", authTenantOrMaster, require("./routes/tenantDataRoutes"));
// app.use("/api/orders", require("./middleware/tenantMiddleware"), require("./routes/orderRoutes"));
app.use("/api/products", require("./middleware/tenantAuth"), require("./routes/productRoutes"));
app.use("/api/customers", require("./middleware/tenantAuth"), require("./routes/customerRoutes"));
app.use("/api/sales", require("./middleware/tenantMiddleware"), require("./routes/salesBillRoutes"));
app.use("/api/categories", require("./middleware/tenantMiddleware"), require("./routes/categoryRoutes"));
app.use("/api/search-products", require("./middleware/tenantMiddleware"), require("./routes/ProductSearchRoutes.js"));
app.use("/api/expenses", require("./middleware/tenantMiddleware"), require("./routes/expenseRoutes.js"));

app.use("/api/branch-reports", require("./routes/branchReportsRoutes"));



const supplierRoutes = require("./routes/supplierRoutes");
app.use("/api/suppliers", supplierRoutes);

// const dashboardRoutes = require("./routes/dashboardRoutes");
app.use("/api", require("./routes/dashboardRoutes"));
app.use("/api", require("./routes/tenantDataRoutes"));





const MastersalesBillRoutes = require("./routes/MasterBill.js");
app.use("/api/tenant", MastersalesBillRoutes);


const purchaseRoutes = require("./routes/purchaseRoutes");
app.use("/api/purchases", purchaseRoutes);

// ----------------------------
// WebSocket connection
// ----------------------------
io.on("connection", (socket) => {
  console.log("⚡ Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});



// ✅ Import route files
const reportsRoutes = require("./routes/reports");

// ✅ Mount routes
app.use("/api", reportsRoutes);


const printAndPdfRoutes = require("./routes/printAndPdfRoutes");

app.use("/api", printAndPdfRoutes);

const masterPrintAndPdfRoutes = require("./routes/MasterPrintAndPdfRoutes.js");

app.use("/api", masterPrintAndPdfRoutes);


// Helper
function escape(v) {
  return String(v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


app.post("/api/print-bill", async (req, res) => {
  try {
    const { bill } = req.body;
    if (!bill) {
      return res.status(400).json({ success: false, message: "Missing bill data" });
    }

    // 🧾 Build printable HTML for the bill (use your same design)
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
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfPath = path.join(__dirname, "bill.pdf");
    await page.pdf({ path: pdfPath, width: "7.5cm", printBackground: true });
    await browser.close();

    // 🖨️ Print PDF via default printer
    await print(pdfPath);

    res.json({ success: true });
  } catch (err) {
    console.error("Print error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});




app.use((err, req, res, next) => {
  console.error("❌ Error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));






























