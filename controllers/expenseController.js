// server/controllers/expenseController.js



const getNextExpenseReceiptNo = require("../utils/getNextExpenseReceiptNo");





const previewNextExpenseReceiptNo = async ({ Counter, shopId }) => {

  const counterKey = `expense:${shopId}`;

  const counter = await Counter.findOne({ name: counterKey }).lean();

  const nextSeq = (counter?.seq || 0) + 1;

  const seq = nextSeq.toString().padStart(5, "0");

  return `R${seq}`;
};


const getNextReceiptNo = async (req, res) => {
  try {
    const { Counter } = req.tenantModels;
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(400).json({ message: "Shop context missing" });
    }

    const nextReceiptNo = await previewNextExpenseReceiptNo({
      Counter,
      shopId,
    });

    const addedByName = req.user?.name || req.user?.username || "";

    res.json({ nextReceiptNo, addedByName });
  } catch (err) {
    console.error("getNextReceiptNo ERROR:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
};
/**
 * CREATE EXPENSE
 */
const createExpense = async (req, res) => {
  try {
    const { Expense, Counter } = req.tenantModels;
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(400).json({ message: "Shop context missing" });
    }

    let {
      date,
      reason,
      amount,
      refType,
      refNumber,
      addedByName,
          category,
      spendTo,
    } = req.body;

    if (!date) {
      return res.status(400).json({ message: "Date required" });
    }
    if (!amount) {
      return res.status(400).json({ message: "Amount required" });
    }

    // ensure refType is valid
    if (!["bill", "voucher"].includes(refType)) {
      refType = "bill";
    }

 

//     if (!receiptNo) {
//   receiptNo = await getNextExpenseReceiptNo({
//     Counter: req.tenantModels.Counter,
//     shopId,
//   });
// }


   const receiptNo = await getNextExpenseReceiptNo({
      Counter,
      shopId,
    });


    const created = await Expense.create({
      shop: shopId,
      date: new Date(date),
      receiptNo,
      reason: reason || "",
      amount: Number(amount),
      category: category || "",
      spendTo: spendTo || "",
      refType,
      refNumber: refNumber || "",
      addedByName: addedByName || req.user?.name || req.user?.username || "",
      addedByUserId: req.user?._id,
    });

    res.status(201).json({
      message: "Expense created",
      expense: created,
    });
  } catch (err) {
    console.error("createExpense ERROR:", err);
    res.status(500).json({ message: "Failed to create expense", error: err.message });
  }
};

/**
 * LIST EXPENSES with filters:
 * - search (receiptNo, reason, refNumber, addedByName)
 * - dateRange: all | today | week | month | custom
 *   - if custom: from, to
 * - type: all | bill | voucher
 */
const listExpenses = async (req, res) => {
  try {
    const { Expense } = req.tenantModels;
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(400).json({ message: "Shop context missing" });
    }

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const search = (req.query.search || "").trim();
    const dateRange = req.query.dateRange || "all"; // all, today, week, month, custom
    const type = req.query.type || "all"; // all, bill, voucher
    const from = req.query.from;
    const to = req.query.to;

    const query = { shop: shopId };          

    // search filter
    if (search) {
      query.$or = [
        { receiptNo: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } },
        { refNumber: { $regex: search, $options: "i" } },
        { addedByName: { $regex: search, $options: "i" } },
         { spendTo: { $regex: search, $options: "i" } },
      ];
    }

    // date filter
    if (dateRange !== "all") {
      const now = new Date();
      let start = null;
      let end = null;

      if (dateRange === "today") {
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
      } else if (dateRange === "week") {
        // last 7 days including today
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        start = new Date(now);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
      } else if (dateRange === "month") {
        // current month
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
      } else if (dateRange === "custom" && from && to) {
        start = new Date(from);
        start.setHours(0, 0, 0, 0);
        end = new Date(to);
        end.setHours(23, 59, 59, 999);
      }

      if (start && end) {
        query.date = { $gte: start, $lte: end };
      }
    }

    // bill / voucher filter
    if (type === "bill" || type === "voucher") {
      query.refType = type;
    }


    if (req.query.category) {
  query.category = req.query.category;
}


    const total = await Expense.countDocuments(query);

    const expenses = await Expense.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      expenses,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("listExpenses ERROR:", err);
    res.status(500).json({ message: "Failed to list expenses", error: err.message });
  }
};

module.exports = {
  getNextReceiptNo,
  createExpense,
  listExpenses,
};
