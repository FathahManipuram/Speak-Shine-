/**
 * Monthly Grace Period Utility (Frontend)
 *
 * Rules:
 * - In each month, the initial 2 days (1st and 2nd day of the calendar month in Asia/Kolkata IST)
 *   are a free upload grace period where all users can upload/record videos without payment.
 * - From Day 3 (00:00:00 IST on the 3rd) onwards, payment is strictly required.
 */

const TIMEZONE = "Asia/Kolkata";

/**
 * Returns a Date object representing the given time converted to Asia/Kolkata timezone
 * @param {Date|string|number} [dateInput=new Date()]
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
 * Calculates the exact end of the 2-day grace period for the given date's month (00:00:00 IST on 3rd)
 * @param {Date|string|number} [dateInput=new Date()]
 * @returns {Date}
 */
export function getGracePeriodEndIST(dateInput = new Date()) {
  const ist = getISTDate(dateInput);
  const year = ist.getFullYear();
  const month = ist.getMonth();
  // 3rd day at 00:00:00 IST = UTC minus 5.5 hours
  const utcMillis = Date.UTC(year, month, 3, 0, 0, 0) - (5.5 * 60 * 60 * 1000);
  return new Date(utcMillis);
}

/**
 * Format remaining milliseconds into structured units
 * @param {number} ms
 */
export function formatRemainingTime(ms) {
  if (ms <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isExpired: true,
      formatted: "00:00:00",
      label: "Grace period ended",
    };
  }

  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const pad = (n) => String(n).padStart(2, "0");
  const formatted = days > 0
    ? `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  let label = "";
  if (days > 0) {
    label = `${days} day${days > 1 ? "s" : ""} ${hours} hr${hours !== 1 ? "s" : ""} remaining`;
  } else if (hours > 0) {
    label = `${hours} hr${hours !== 1 ? "s" : ""} ${minutes} min${minutes !== 1 ? "s" : ""} remaining`;
  } else {
    label = `${minutes} min${minutes !== 1 ? "s" : ""} ${seconds} sec${seconds !== 1 ? "s" : ""} remaining`;
  }

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds: totalSecs,
    isExpired: false,
    formatted,
    label,
  };
}

/**
 * Returns comprehensive grace period info and live countdown data
 * @param {Date|string|number} [dateInput=new Date()]
 */
export function getMonthlyGracePeriodStatus(dateInput = new Date()) {
  const rawDate = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const ist = getISTDate(rawDate);
  const dayOfMonth = ist.getDate();
  const isGracePeriod = dayOfMonth === 1 || dayOfMonth === 2;
  const gracePeriodEndDate = getGracePeriodEndIST(rawDate);
  const remainingMs = Math.max(0, gracePeriodEndDate.getTime() - rawDate.getTime());
  const countdown = formatRemainingTime(remainingMs);

  const monthName = ist.toLocaleString("en-US", { month: "long", timeZone: TIMEZONE });
  const monthNumber = ist.getMonth() + 1;
  const year = ist.getFullYear();

  return {
    isGracePeriod,
    dayOfMonth,
    gracePeriodEnd: gracePeriodEndDate.toISOString(),
    gracePeriodEndTimestamp: gracePeriodEndDate.getTime(),
    remainingMs,
    monthName,
    monthNumber,
    year,
    countdown,
  };
}
