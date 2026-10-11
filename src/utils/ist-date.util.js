// All schedule dates in the platform are whole days in India time (IST, UTC+05:30).
// A date such as "2026-10-12" is stored as the UTC instant of 00:00 IST on that day.

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isValidIstDateString = (value) => {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

// "2026-10-12" -> 2026-10-11T18:30:00.000Z
export const istDateToUtc = (value) => {
  if (!isValidIstDateString(value)) {
    const error = new Error("Date must be in YYYY-MM-DD format");
    error.statusCode = 400;
    throw error;
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS);
};

// 2026-10-11T18:30:00.000Z -> "2026-10-12"
export const utcToIstDate = (date) => {
  if (!date) return null;
  return new Date(new Date(date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
};

export const getIstToday = (now = new Date()) => utcToIstDate(now);

export const addDaysToIstDate = (value, days) => utcToIstDate(new Date(istDateToUtc(value).getTime() + days * DAY_MS));

// The UTC range [start, end) that covers one IST calendar day.
export const getIstDayRange = (value = getIstToday()) => {
  const start = istDateToUtc(value);
  return { start, end: new Date(start.getTime() + DAY_MS) };
};

// 2026-10-11T18:30:00.000Z -> "12 Oct 2026"
export const formatIstDisplayDate = (date) =>
  date
    ? new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(new Date(date))
    : null;
