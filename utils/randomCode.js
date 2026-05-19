const bwipjs = require("bwip-js");

/**
 * Generate a unique 13-digit EAN-13 style random code.
 * Ensures:
 * - First 12 digits = random number
 * - Last digit = checksum
 * - Uniqueness checked against all product batch randomCodes
 */
async function generateUniqueRandomCode(Product) {
  let codeExists = true;
  let finalCode = "";

  while (codeExists) {
    // Generate 12-digit base
    const base = Math.floor(100000000000 + Math.random() * 900000000000).toString();

    // Compute check digit (EAN-13 algorithm)
    const sum = base
      .split("")
      .reverse()
      .map(Number)
      .reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 3 : 1), 0);

    const checkDigit = (10 - (sum % 10)) % 10;

    finalCode = base + checkDigit;

    // Check uniqueness across all batches
    codeExists = await Product.findOne({ "batches.randomCode": finalCode });
  }

  return finalCode;
}

/**
 * Generate barcode PNG (Code128) base64 string
 */
async function generateBarcode(value) {
  try {
    const png = await bwipjs.toBuffer({
      bcid: "code128",   // Barcode type
      text: value,       // The text to encode
      scale: 2,
      height: 9,
      includetext: false,
      paddingwidth: 0,
      paddingheight: 0,
    });

    return `data:image/png;base64,${png.toString("base64")}`;
  } catch (err) {
    console.error("Barcode generation failed:", err);
    return null;
  }
}

module.exports = {
  generateUniqueRandomCode,
  generateBarcode,
};
