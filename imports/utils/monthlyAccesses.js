const monthParts = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year").value),
    month: Number(parts.find((part) => part.type === "month").value),
  };
};

const romeDay = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = (type) => Number(parts.find((part) => part.type === type).value);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day"), 12));
};

export const buildPeriodAccesses = (logs, period, now = new Date()) => {
  const today = romeDay(now);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  let start;
  let length;
  if (period === "year") {
    start = new Date(Date.UTC(year, 0, 1, 12));
    length = 12;
  } else if (period === "month") {
    start = new Date(Date.UTC(year, month, 1, 12));
    length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  } else {
    start = new Date(today);
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    length = 7;
  }
  const keyFor = (date) => date.toISOString().slice(0, period === "year" ? 7 : 10);
  const buckets = Array.from({ length }, (_, index) => {
    const date = new Date(start);
    if (period === "year") date.setUTCMonth(index);
    else date.setUTCDate(start.getUTCDate() + index);
    return {
      key: keyFor(date),
      label: new Intl.DateTimeFormat("it-IT", {
        timeZone: "UTC",
        ...(period === "year" ? { month: "short" } : period === "month" ? { day: "numeric" } : { weekday: "short", day: "numeric" }),
      }).format(date),
      count: 0,
    };
  });
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const log of logs) {
    if (!log.userId || log.action || !log.createdAt) continue;
    const date = new Date(log.createdAt);
    if (Number.isNaN(date.getTime()) || date > now) continue;
    const bucket = byKey.get(keyFor(romeDay(date)));
    if (bucket) bucket.count += 1;
  }
  return buckets;
};

export const buildMonthlyAccesses = (logs, now = new Date()) => {
  const current = monthParts(now);
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(current.year, current.month - 12 + index, 1, 12));
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", month: "short", year: "2-digit" }).format(date),
      count: 0,
    };
  });
  const byMonth = new Map(months.map((month) => [month.key, month]));
  for (const log of logs) {
    if (!log.userId || log.action || !log.createdAt) continue;
    const date = new Date(log.createdAt);
    if (Number.isNaN(date.getTime()) || date > now) continue;
    const { year, month } = monthParts(date);
    const bucket = byMonth.get(`${year}-${String(month).padStart(2, "0")}`);
    if (bucket) bucket.count += 1;
  }
  return months;
};
