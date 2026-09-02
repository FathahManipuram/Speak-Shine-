/**
 * Monthly Grace Period Utility
 * 
 * Rules:
 * - In each month, the initial 2 days (1st and 2nd day of the calendar month in Asia/Kolkata IST)
 *   are a free upload grace period where all users can upload/record videos without payment.
 * - From Day 3 (00:00:00 IST on the 3rd) onwards, payment is strictly required.
 */

const TIMEZONE = "Asia/Kolkata";

/**
 * Returns a Date object representing the given time in Asia/Kolkata timezone components
 * @param {Date|string|number} dateInput 
 * @returns {Date}
 */
export function getISTDate(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return new Date(d.toLocaleString("en-US", { timeZone: TIMEZONE }));
}

/**
 * Checks if the given date is within the initial 2 days of the month in IST (Day 1 or Day 2)
 * @param {Date|string|number} [dateInput=new Date()]
 * @returns {boolean}
 */
export function isMonthlyGracePeriod(dateInput = new Date()) {
  const ist = getISTDate(dateInput);
  const day = ist.getDate();
  return day === 1 || day === 2;
}

/**
 * Calculates the exact end of the 2-day grace period for the given date's month:
 * Returns the timestamp corresponding to 00:00:00.000 IST on the 3rd of the month.
 * 
 * In UTC: (Year, Month, 3, 00:00:00 IST) - 5 hours 30 minutes.
 * 
 * @param {Date|string|number} [dateInput=new Date()]
 * @returns {Date}
 */
export function getGracePeriodEndIST(dateInput = new Date()) {
  const ist = getISTDate(dateInput);
  const year = ist.getFullYear();
  const month = ist.getMonth(); // 0-indexed
  // 3rd day at 00:00:00 IST is UTC: Date.UTC(year, month, 3, 0, 0, 0) minus 5.5 hours (19800000 ms)
  const utcMillis = Date.UTC(year, month, 3, 0, 0, 0) - (5.5 * 60 * 60 * 1000);
  return new Date(utcMillis);
}

/**
 * Returns comprehensive grace period info and countdown data
 * @param {Date|string|number} [dateInput=new Date()]
 * @returns {{
 *   isGracePeriod: boolean,
 *   dayOfMonth: number,
 *   gracePeriodEnd: string,
 *   gracePeriodEndTimestamp: number,
 *   remainingMs: number,
 *   monthName: string,
 *   monthNumber: number,
 *   year: number
 * }}
 */
export function getMonthlyGracePeriodInfo(dateInput = new Date()) {
  const rawDate = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const ist = getISTDate(rawDate);
  const dayOfMonth = ist.getDate();
  const isGracePeriod = dayOfMonth === 1 || dayOfMonth === 2;
  const gracePeriodEndDate = getGracePeriodEndIST(rawDate);
  const gracePeriodEndTimestamp = gracePeriodEndDate.getTime();
  const nowTimestamp = rawDate.getTime();
  const remainingMs = Math.max(0, gracePeriodEndTimestamp - nowTimestamp);

  const monthName = ist.toLocaleString("en-US", { month: "long", timeZone: TIMEZONE });
  const monthNumber = ist.getMonth() + 1;
  const year = ist.getFullYear();

  return {
    isGracePeriod,
    dayOfMonth,
    gracePeriodEnd: gracePeriodEndDate.toISOString(),
    gracePeriodEndTimestamp,
    remainingMs,
    monthName,
    monthNumber,
    year,
  };
}
