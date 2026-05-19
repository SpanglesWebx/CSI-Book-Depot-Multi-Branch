/**
 * Preview product code WITHOUT increment
 */
// const getNextProductCodePreview = async (Counter, shopId) => {
//   const year = new Date().getFullYear().toString().slice(-2);
//   const counterKey = `product:${shopId}:${year}`;

//   const counter = await Counter.findOne({ name: counterKey }).lean();

//   const nextSeq = (counter?.seq || 0) + 1;

//   return `P${year}-${nextSeq}`;
// };

// module.exports = getNextProductCodePreview;




const getNextProductCodePreview = async (Counter, shopId) => {

  const counterKey = `product:${shopId}`;

  const counter = await Counter.findOne({ name: counterKey }).lean();

  const nextSeq = (counter?.seq || 0) + 1;

  const formatted = nextSeq.toString().padStart(5, "0");

  return `P${formatted}`;
};

module.exports = getNextProductCodePreview;