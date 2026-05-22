
const previewNextBillNo = async (Counter, shopId, counterNo) => {

  const counterKey = `salesbill:${shopId}:${counterNo}`;

  const counter = await Counter.findOne({ name: counterKey }).lean();

  const nextSeq = (counter?.seq || 0) + 1;

  const seq = nextSeq.toString().padStart(5, "0");

  return `C${counterNo}B${seq}`;
};

module.exports = previewNextBillNo;