





/**
 * Atomic & multi-system safe bill number generator
 * Format: C<counter>B<YY>-<N>
 * Example: C1B25-101
 */
// const getNextBillNoUtil = async (Counter, shopId, counterNo) => {
//   const year = new Date().getFullYear().toString().slice(-2); // "25"

//   const counterKey = `salesbill:${shopId}:${counterNo}:${year}`;

//   const counter = await Counter.findOneAndUpdate(
//     { name: counterKey },
//     { $inc: { seq: 1 } },
//     { new: true, upsert: true }
//   );

//   return `C${counterNo}B${year}-${counter.seq}`;
// };

// module.exports = getNextBillNoUtil;



/**
 * Atomic bill number generator
 * Format: C<counterNo>B00001
 */

const getNextBillNoUtil = async (Counter, shopId, counterNo, session = null) => {

  const counterKey = `salesbill:${shopId}:${counterNo}`;

  const counter = await Counter.findOneAndUpdate(
    { name: counterKey },
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true,
      session
    }
  );

  const seq = counter.seq.toString().padStart(5, "0");

  return `C${counterNo}B${seq}`;
};

module.exports = getNextBillNoUtil;