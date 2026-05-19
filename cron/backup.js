const fs = require("fs-extra");
const path = require("path");
const mongoose = require("mongoose");

const { connectMasterDB } = require("../config/db");
const Shop = require("../models/Shop");
const { getTenantDB } = require("../config/tenantManager");
const getTenantModels = require("../models/tenantModels");

const BASE_BACKUP_DIR = path.join(__dirname, "../Backup");

/* 📅 DATE */
const getDateFolder = () => {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return ist.toISOString().split("T")[0];
};

/* 📁 CREATE FOLDER */
const getTodayDir = () => {
  const dir = path.join(BASE_BACKUP_DIR, getDateFolder());
  fs.ensureDirSync(dir);
  return dir;
};

/* 🔥 MASTER BACKUP */
async function backupMasterDB(dir) {

  const dbName = mongoose.connection.name; // 🔥 dynamic
  const masterDir = path.join(dir, dbName);

  await fs.ensureDir(masterDir);

  const cols = await mongoose.connection.db.listCollections().toArray();

  for (const col of cols) {
    const data = await mongoose.connection.db.collection(col.name).find({}).toArray();

    await fs.writeJson(
      path.join(masterDir, `${col.name}.json`),
      data
    );

    console.log(`✅ ${dbName}.${col.name}`);
  }
}

/* 🔥 TENANT BACKUP */
async function backupShop(shop, dir) {
  const conn = await getTenantDB(shop.shopname, shop.tenantDbUri);
  const models = getTenantModels(conn);

  const shopDir = path.join(dir, shop.shopname);
  await fs.ensureDir(shopDir);

  for (const [name, Model] of Object.entries(models)) {
    const data = await Model.find({}).lean();
    await fs.writeJson(path.join(shopDir, `${name}.json`), data);
    console.log(`✅ ${shop.shopname}.${name}`);
  }
}

/* 🚀 MAIN */
module.exports = async () => {
  await connectMasterDB();

  const dir = getTodayDir();
  const shops = await Shop.find().lean();

  await backupMasterDB(dir);

  for (const shop of shops) {
    await backupShop(shop, dir);
  }

  console.log("🎉 Backup Done");
};