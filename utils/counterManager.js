// // utils/counterManager.js
const fs = require("fs");

const COUNTER_FILE = "C:\\SpanglesWebx\\BookDepot\\Counter.txt";

function readCounterFile() {
  try {
    const txt = fs.readFileSync(COUNTER_FILE, "utf8");

    const result = { shopname: "", shopid: "", counters: {} };

    txt.split(/\r?\n/).forEach((line) => {
      line = line.trim();
      if (!line) return;

      const parts = line.split(/\s+/);

      parts.forEach((p) => {
        const [key, value] = p.split("=");

        if (!key || !value) return;

        if (key.toLowerCase() === "shopname") result.shopname = value.trim();
        else if (key.toLowerCase() === "shopid") result.shopid = value.trim();
        else if (key.toLowerCase().startsWith("counter")) {
          const no = key.replace("counter", "");
          result.counters[no] = value.trim().toUpperCase();
        }
      });
    });

    return result;

  } catch (err) {
    console.error("Counter file read error:", err.message);
    return null;
  }
}

// 🌟 REAL FUNCTION → GET COUNTER NUMBER
function getCounterNumber(shopname, mac) {
  const data = readCounterFile();
  if (!data) return null;

  if (data.shopname.trim().toLowerCase() !== shopname.trim().toLowerCase()) {
    return null;
  }

  const targetMac = mac.toUpperCase().replace(/:/g, "-");

  for (const [counterNo, allowedMac] of Object.entries(data.counters)) {
    if (allowedMac.toUpperCase() === targetMac) {
      return counterNo;
    }
  }

  return null;
}

module.exports = { getCounterNumber };

