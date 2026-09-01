import { describe, it, expect, vi } from "vitest";
import {
  isMonthlyGracePeriod,
  getGracePeriodEndIST,
  getMonthlyGracePeriodInfo,
  getISTDate,
} from "./gracePeriodUtils.js";
import { requirePaid } from "../middleware/requirePaid.js";

describe("Monthly Grace Period Utilities", () => {
  it("recognizes Day 1 of the month as active grace period (IST)", () => {
    // 2026-09-01 10:00:00 IST -> UTC 2026-09-01 04:30:00
    const day1IST = new Date("2026-09-01T04:30:00Z");
    expect(isMonthlyGracePeriod(day1IST)).toBe(true);

    const info = getMonthlyGracePeriodInfo(day1IST);
    expect(info.isGracePeriod).toBe(true);
    expect(info.dayOfMonth).toBe(1);
    expect(info.monthName).toBe("September");
    expect(info.year).toBe(2026);
    expect(info.remainingMs).toBeGreaterThan(0);
  });

  it("recognizes Day 2 of the month as active grace period (IST)", () => {
    // 2026-09-02 23:59:00 IST -> UTC 2026-09-02 18:29:00
    const day2IST = new Date("2026-09-02T18:29:00Z");
    expect(isMonthlyGracePeriod(day2IST)).toBe(true);

    const info = getMonthlyGracePeriodInfo(day2IST);
    expect(info.isGracePeriod).toBe(true);
    expect(info.dayOfMonth).toBe(2);
    expect(info.remainingMs).toBeGreaterThan(0);
  });

  it("recognizes Day 3 (00:00:00 IST) as expired grace period", () => {
    // 2026-09-03 00:00:00 IST -> UTC 2026-09-02 18:30:00
    const day3StartIST = new Date("2026-09-02T18:30:00Z");
    expect(isMonthlyGracePeriod(day3StartIST)).toBe(false);

    const info = getMonthlyGracePeriodInfo(day3StartIST);
    expect(info.isGracePeriod).toBe(false);
    expect(info.dayOfMonth).toBe(3);
    expect(info.remainingMs).toBe(0);
  });

  it("recognizes mid-month and end-of-month dates as expired grace period", () => {
    const day15 = new Date("2026-09-15T12:00:00+05:30");
    expect(isMonthlyGracePeriod(day15)).toBe(false);

    const day30 = new Date("2026-09-30T23:59:59+05:30");
    expect(isMonthlyGracePeriod(day30)).toBe(false);
  });

  it("computes exact gracePeriodEnd as 00:00:00 IST on 3rd of the month", () => {
    const date = new Date("2026-09-01T12:00:00+05:30");
    const end = getGracePeriodEndIST(date);

    // Converted to IST representation
    const endIST = getISTDate(end);
    expect(endIST.getFullYear()).toBe(2026);
    expect(endIST.getMonth()).toBe(8); // September (0-indexed 8)
    expect(endIST.getDate()).toBe(3);
    expect(endIST.getHours()).toBe(0);
    expect(endIST.getMinutes()).toBe(0);
    expect(endIST.getSeconds()).toBe(0);
  });
});

describe("requirePaid Middleware Integration", () => {
  it("allows admin, trainer, and viewer roles to bypass payment gate regardless of date", async () => {
    for (const role of ["admin", "admins", "trainer", "viewer"]) {
      const req = { user: { role, phone: "9876543210" } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await requirePaid(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    }
  });
});
