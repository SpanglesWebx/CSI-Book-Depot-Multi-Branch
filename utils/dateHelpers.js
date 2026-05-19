// utils/dateHelpers.js

/**
 * getDateRange(period)
 * 
 * Allowed periods: "today", "day", "week", "month", "year"
 * Returns: { start: Date, end: Date }
 * 
.
 */

exports.getDateRange = function (period = "today") {
  const now = new Date();

  // --- TODAY (default) ---
  if (period === "today" || period === "day") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  // --- WEEK ---
  if (period === "week") {
    const dayOfWeek = now.getDay(); // Sunday = 0
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  // --- MONTH ---
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return { start, end };
  }

  // --- YEAR ---
  if (period === "year") {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    return { start, end };
  }

  // Unknown fallback → Today
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};
