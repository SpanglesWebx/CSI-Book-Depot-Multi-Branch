/**
 * Atomic product code generator
 * Format: PYY-N
 * Example: P25-101
 */
// const getNextProductCodeUtil = async (Counter, shopId) => {
//   const year = new Date().getFullYear().toString().slice(-2); // "25"

//   const counterKey = `product:${shopId}:${year}`;

//   const counter = await Counter.findOneAndUpdate(
//     { name: counterKey },
//     { $inc: { seq: 1 } },
//     { new: true, upsert: true }
//   );

//   return `P${year}-${counter.seq}`;
// };

// module.exports = getNextProductCodeUtil;



const getNextProductCodeUtil = async (Counter, shopId) => {

  const counterKey = `product:${shopId}`;

  const counter = await Counter.findOneAndUpdate(
    { name: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seq = counter.seq.toString().padStart(5, "0");

  return `P${seq}`;
};

module.exports = getNextProductCodeUtil;