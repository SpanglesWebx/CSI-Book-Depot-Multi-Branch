


const fs = require("fs-extra");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const { connectMasterDB } = require("../config/db");
const Shop = require("../models/Shop");
const { getTenantDB } = require("../config/tenantManager");
const getTenantModels = require("../models/tenantModels");

const BASE_BACKUP_DIR = path.join(__dirname, "../");



function getBackupFolderName() {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();

  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  const ampm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12 || 12;
  hours = String(hours).padStart(2, "0");

  return `Backup(${day}-${month}-${year}_${hours}-${minutes}-${seconds}_${ampm})`;
}




/* ---------------- MASTER DB BACKUP ---------------- */

async function backupMasterDB(backupRoot) {

  console.log("📦 Backing up MASTER DB...");

  // get database name from connection
  const dbName = mongoose.connection.name;

  console.log("Connected Master DB:", dbName);

  const masterDir = path.join(backupRoot, dbName);

  await fs.ensureDir(masterDir);

  const collections = await mongoose.connection.db
    .listCollections()
    .toArray();

  for (const col of collections) {

    const collectionName = col.name;

    const data = await mongoose.connection.db
      .collection(collectionName)
      .find({})
      .toArray();

    const filePath = path.join(masterDir, `${collectionName}.json`);

    await fs.writeJson(filePath, data, { spaces: 2 });

    console.log(`   ✅ ${collectionName}: ${data.length} records`);
  }

  console.log("✅ Master DB backup completed");
}
async function backupShop(shop, backupRoot) {
  console.log(`📦 Backing up shop: ${shop.shopname}`);

  const tenantConn = await getTenantDB(shop.shopname, shop.tenantDbUri);

  const models = getTenantModels(tenantConn);

  const shopDir = path.join(backupRoot, shop.shopname);

  await fs.ensureDir(shopDir);

  for (const [modelName, Model] of Object.entries(models)) {
    console.log("Checking model:", modelName);


    const data = await Model.find({}).lean();

    const filePath = path.join(shopDir, `${modelName}.json`);
    console.log(`${modelName} documents:`, data.length);

    await fs.writeJson(filePath, data, { spaces: 2 });

    console.log(`   ✅ ${modelName}: ${data.length} records`);
  }
}

async function runBackup() {
  try {
    console.log("🚀 Starting Tenant Backup...");

    await connectMasterDB();

    const shops = await Shop.find({ status: "active" }).lean();

    console.log("🏪 Active shops:", shops.map(s => s.shopname));

    // 🔹 Remove previous backups
    const files = await fs.readdir(BASE_BACKUP_DIR);

    for (const file of files) {
      if (file.startsWith("Backup(")) {
        await fs.remove(path.join(BASE_BACKUP_DIR, file));
      }
    }

    console.log("🗑 Old backups removed");

    // 🔹 Create new backup folder
    const backupFolderName = getBackupFolderName();

    const backupRoot = path.join(BASE_BACKUP_DIR, backupFolderName);

    await fs.ensureDir(backupRoot);

    console.log("📂 Backup folder:", backupFolderName);
    // 🔹 Backup master DB
    await backupMasterDB(backupRoot);

    // 🔹 Backup each tenant
    for (const shop of shops) {
      await backupShop(shop, backupRoot);
    }

    console.log("🎉 ALL SHOP DATABASES BACKED UP");

  } catch (err) {
    console.error("❌ Backup failed:", err);
  }
}

module.exports = runBackup;