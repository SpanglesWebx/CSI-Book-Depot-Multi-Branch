const fs = require("fs-extra");
const path = require("path");
const mongoose = require("mongoose");

const { connectMasterDB } = require("../config/db");
const Shop = require("../models/Shop");
const { getTenantDB } = require("../config/tenantManager");
const getTenantModels = require("../models/tenantModels");

const BASE_BACKUP_DIR = path.join(__dirname, "../Backup");

/* 📅 DATE */
const getDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);

  const ist = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return ist.toISOString().split("T")[0];
};

const getRestoreFile = (type, name) => {
  const today = path.join(BASE_BACKUP_DIR, getDate(), type, `${name}.json`);
  const yesterday = path.join(BASE_BACKUP_DIR, getDate(-1), type, `${name}.json`);

  if (fs.existsSync(today)) return today;
  if (fs.existsSync(yesterday)) return yesterday;

  return null;
};


/* 🔥 MASTER RESTORE */
async function restoreMaster() {

  const dbName = mongoose.connection.name; // ✅ dynamic DB name

  const cols = await mongoose.connection.db.listCollections().toArray();

  let total = 0;

  for (const col of cols) {
    const count = await mongoose.connection.db.collection(col.name).countDocuments();
    total += count;
  }

  /* ================================
     🚨 FULL DB EMPTY
  ================================= */
  if (total === 0) {
    console.log(`🚨 ${dbName} EMPTY → FULL RESTORE`);

    for (const col of cols) {

      const file = getRestoreFile(dbName, col.name); // ✅ FIX

      if (!file) {
        console.log(`❌ Missing backup file → ${col.name}`);
        continue;
      }

      const data = await fs.readJson(file);

      await mongoose.connection.db.collection(col.name)
        .insertMany(data, { ordered: false });

      console.log(`♻️ Restored ${dbName}.${col.name} (${data.length})`);
    }

    return;
  }

  /* ================================
     ⚠️ COLLECTION LEVEL CHECK
  ================================= */
  for (const col of cols) {

    const count = await mongoose.connection.db.collection(col.name).countDocuments();

    if (count === 0) {

      console.log(`⚠️ EMPTY COLLECTION → ${dbName}.${col.name}`);

      const file = getRestoreFile(dbName, col.name); // ✅ FIX

      if (!file) {
        console.log(`❌ No backup found for ${col.name}`);
        continue;
      }

      const data = await fs.readJson(file);

      if (data.length > 0) {
        await mongoose.connection.db.collection(col.name)
          .insertMany(data, { ordered: false });

        console.log(`♻️ Restored ${dbName}.${col.name}`);
      }
    }
  }
}

/* 🔥 TENANT RESTORE */
async function restoreShop(shop) {
  const conn = await getTenantDB(shop.shopname, shop.tenantDbUri);
  const models = getTenantModels(conn);

  for (const [name, Model] of Object.entries(models)) {

    let count = 0;

    try {
      count = await Model.countDocuments();
    } catch (err) {
      console.log(`❌ COLLECTION MISSING → ${shop.shopname}.${name}`);
      count = 0;
    }

    /* ================================
       ⚠️ EMPTY OR MISSING
    ================================= */
    if (count === 0) {

      console.log(`⚠️ EMPTY / MISSING → ${shop.shopname}.${name}`);

      const file = getRestoreFile(shop.shopname, name);

      if (!file) {
        console.log(`❌ No backup file → ${shop.shopname}.${name}`);
        continue;
      }

      const data = await fs.readJson(file);

      if (data.length > 0) {
        await Model.insertMany(data, { ordered: false });
        console.log(`♻️ Restored ${shop.shopname}.${name} (${data.length})`);
      } else {
        console.log(`⚠️ Backup empty → ${shop.shopname}.${name}`);
      }
    }

    /* ================================
       ✅ HEALTHY COLLECTION
    ================================= */
    else {
      console.log(`✅ OK → ${shop.shopname}.${name} (${count})`);
    }
  }
}

/* 🚀 MAIN */
module.exports = async () => {
  await connectMasterDB();

  await restoreMaster();

  const shops = await Shop.find({ status: "active" }).lean();

  for (const shop of shops) {
    await restoreShop(shop);
  }

  console.log("✅ Restore Done");
};