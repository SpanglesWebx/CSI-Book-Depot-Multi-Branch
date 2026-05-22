const os = require("os");
const systemMac = getSystemMac();
console.log("MAC From Backend:", systemMac);   

function getSystemMac() {
    // ⭐ NEW: SYSTEM COUNTER VALIDATION

  const interfaces = os.networkInterfaces();

  let preferred = null;

  for (let name in interfaces) {
    for (let iface of interfaces[name]) {
      if (
        !iface.internal &&
        iface.mac &&
        iface.mac !== "00:00:00:00:00:00"
      ) {
        const mac = iface.mac.toUpperCase().replace(/:/g, "-");

        // Prefer REAL WiFi / Ethernet instead of Microsoft Virtual Adapters
        if (
          name.toLowerCase().includes("wi-fi") ||
          name.toLowerCase().includes("wifi") ||
          name.toLowerCase().includes("wlan") ||
          name.toLowerCase().includes("ethernet")
        ) {
          return mac;
        }

        // fallback but store as last option
        preferred = mac;
      }
    }
  }

  return preferred;
}



module.exports = getSystemMac;

