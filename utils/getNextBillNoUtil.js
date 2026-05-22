
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