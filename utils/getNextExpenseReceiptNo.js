async function getNextExpenseReceiptNo({ Counter, shopId, session = null }) {

  const counterKey = `expense:${shopId}`;

  const counter = await Counter.findOneAndUpdate(
    { name: counterKey },
    {
      $inc: { seq: 1 },
      $setOnInsert: { name: counterKey }
    },
    {
      new: true,
      upsert: true,
      session
    }
  );

  const seq = counter.seq.toString().padStart(5, "0");

  return `R${seq}`;
}

module.exports = getNextExpenseReceiptNo;