require("dotenv").config();
const fs = require("fs-extra");
const path = require("path");
const mongoose = require("mongoose");

const { connectMasterDB } = require("../config/db");
const Shop = require("../models/Shop");
const { getTenantDB } = require("../config/tenantManager");
const getTenantModels = require("../models/tenantModels");

const BACKUP_DIR = path.join(__dirname, "../Backup");


/* ------------ MASTER RESTORE ------------ */

async function restoreMasterDB() {

  console.log("🔄 Restoring MASTER DB...");

  const dbName = mongoose.connection.name;
  const masterDir = path.join(BACKUP_DIR, dbName);

  if (!(await fs.pathExists(masterDir))) {
    console.log("⚠️ No master backup folder found");
    return;
  }

  const files = await fs.readdir(masterDir);

  for (const file of files) {

    const collectionName = file.replace(".json", "");
    const filePath = path.join(masterDir, file);

    const records = await fs.readJson(filePath);

    console.log(`📥 Restoring master.${collectionName}: ${records.length}`);

    const collection = mongoose.connection.db.collection(collectionName);

    await collection.deleteMany({});

    if (records.length > 0) {
      await collection.insertMany(records);
    }

    console.log(`✅ master.${collectionName} restored`);
  }
}


/* ------------ TENANT RESTORE ------------ */

async function restoreShop(shop) {

  console.log("🔄 Restoring shop:", shop.shopname);

  const tenantConn = await getTenantDB(shop.shopname, process.env.TENANT_DB_URI);
  const models = getTenantModels(tenantConn);

  const shopDir = path.join(BACKUP_DIR, shop.shopname);

  for (const [modelName, Model] of Object.entries(models)) {

    const filePath = path.join(shopDir, `${modelName}.json`);

    if (!(await fs.pathExists(filePath))) {
      console.log(`⚠️ No backup for ${modelName}`);
      continue;
    }

    const json = await fs.readJson(filePath);

    if (!json.backups || json.backups.length === 0) {
      console.log(`⚠️ Empty backup for ${modelName}`);
      continue;
    }

    const latestBackup = json.backups[json.backups.length - 1];

    let records = latestBackup.records || [];

    console.log(`📥 Restoring ${modelName}: ${records.length}`);

    records = records.map(doc => {
      const { _id, ...rest } = doc;
      return rest;
    });

    await Model.deleteMany({});

    if (records.length > 0) {
      await Model.insertMany(records);
    }

    console.log(`✅ ${modelName} restored`);
  }
}


/* ------------ MAIN RESTORE ------------ */

async function runRestore() {

  try {

    console.log("🚀 Starting Restore...");

    await connectMasterDB();

    // Restore master DB first
    await restoreMasterDB();

    // Now read shops
    const shops = await Shop.find({ status: "active" }).lean();

    for (const shop of shops) {
      await restoreShop(shop);
    }

    console.log("🎉 Restore Completed");

  } catch (err) {

    console.error("❌ Restore failed:", err);

  }
}

runRestore();