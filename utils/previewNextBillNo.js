// /**
//  * Preview next bill number WITHOUT increment
//  */
// const previewNextBillNo = async (Counter, shopId, counterNo) => {
//   const year = new Date().getFullYear().toString().slice(-2);

//   const counterKey = `salesbill:${shopId}:${counterNo}:${year}`;

//   const counter = await Counter.findOne({ name: counterKey }).lean();

//   const nextSeq = (counter?.seq || 0) + 1;

//   return `C${counterNo}B${year}-${nextSeq}`;
// };

// module.exports = previewNextBillNo;



/**
 * Preview next bill number without increment
 */

const previewNextBillNo = async (Counter, shopId, counterNo) => {

  const counterKey = `salesbill:${shopId}:${counterNo}`;

  const counter = await Counter.findOne({ name: counterKey }).lean();

  const nextSeq = (counter?.seq || 0) + 1;

  const seq = nextSeq.toString().padStart(5, "0");

  return `C${counterNo}B${seq}`;
};

module.exports = previewNextBillNo;