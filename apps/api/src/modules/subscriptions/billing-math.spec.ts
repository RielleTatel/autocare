import {
  toManila,
  manilaNow,
  addMonthsManila,
  proratedUpgradeCentavos,
  etfCentavos,
  remainingLockInMonths,
} from "./billing-math";

// Manila is a fixed UTC+08:00 offset (no DST — Ruling MANILA). A UTC instant of
// HH:00 where HH+8 < 24 always lands on the same calendar date in Manila, which
// keeps the fixtures below easy to reason about.
const manilaUtc = (iso: string) => new Date(iso);

describe("billing-math", () => {
  describe("toManila / manilaNow", () => {
    it("toManila shifts a UTC instant forward by 8 hours (wall-clock read via UTC getters)", () => {
      const utcMidnight = new Date("2026-06-15T00:00:00.000Z");
      const shifted = toManila(utcMidnight);
      expect(shifted.getUTCHours()).toBe(8);
      expect(shifted.getUTCDate()).toBe(15);
    });

    it("toManila rolls the calendar date forward when UTC time + 8h crosses midnight", () => {
      const lateUtc = new Date("2026-06-15T20:00:00.000Z"); // 04:00 next day in Manila
      const shifted = toManila(lateUtc);
      expect(shifted.getUTCDate()).toBe(16);
      expect(shifted.getUTCHours()).toBe(4);
    });

    it("manilaNow() returns toManila(new Date()) — a Date instance", () => {
      expect(manilaNow()).toBeInstanceOf(Date);
    });
  });

  describe("addMonthsManila — Jan-31 month-length edge", () => {
    it("Jan 31 2026 + 1 month -> Feb 28 2026 (2026 is not a leap year)", () => {
      const start = manilaUtc("2026-01-31T02:00:00.000Z"); // 2026-01-31T10:00+08:00
      const result = addMonthsManila(start, 1);
      const p = toManila(result);
      expect(p.getUTCFullYear()).toBe(2026);
      expect(p.getUTCMonth()).toBe(1); // February (0-indexed)
      expect(p.getUTCDate()).toBe(28);
      expect(p.getUTCHours()).toBe(10); // time-of-day preserved
    });

    it("Jan 31 2028 + 1 month -> Feb 29 2028 (2028 is a leap year)", () => {
      const start = manilaUtc("2028-01-31T02:00:00.000Z");
      const result = addMonthsManila(start, 1);
      const p = toManila(result);
      expect(p.getUTCFullYear()).toBe(2028);
      expect(p.getUTCMonth()).toBe(1);
      expect(p.getUTCDate()).toBe(29);
    });

    it("Jan 31 + 6 months -> Jul 31 (both 31-day months, no clamping needed)", () => {
      const start = manilaUtc("2026-01-31T02:00:00.000Z");
      const result = addMonthsManila(start, 6);
      const p = toManila(result);
      expect(p.getUTCMonth()).toBe(6); // July
      expect(p.getUTCDate()).toBe(31);
    });

    it("Mar 31 + 1 month -> Apr 30 (April only has 30 days)", () => {
      const start = manilaUtc("2026-03-31T02:00:00.000Z");
      const result = addMonthsManila(start, 1);
      const p = toManila(result);
      expect(p.getUTCMonth()).toBe(3); // April
      expect(p.getUTCDate()).toBe(30);
    });

    it("regular mid-month date is unaffected by clamping", () => {
      const start = manilaUtc("2026-05-15T02:00:00.000Z");
      const result = addMonthsManila(start, 1);
      const p = toManila(result);
      expect(p.getUTCMonth()).toBe(5); // June
      expect(p.getUTCDate()).toBe(15);
    });

    it("rolls the year forward across December", () => {
      const start = manilaUtc("2026-12-15T02:00:00.000Z");
      const result = addMonthsManila(start, 1);
      const p = toManila(result);
      expect(p.getUTCFullYear()).toBe(2027);
      expect(p.getUTCMonth()).toBe(0); // January
      expect(p.getUTCDate()).toBe(15);
    });

    it("n=0 returns the same instant", () => {
      const start = manilaUtc("2026-05-15T02:00:00.000Z");
      expect(addMonthsManila(start, 0).getTime()).toBe(start.getTime());
    });
  });

  describe("proratedUpgradeCentavos — round half up", () => {
    it("worked example: (149900 - 99900) * 15 / 30 = 25000, exact", () => {
      expect(proratedUpgradeCentavos(99900, 149900, 15, 30)).toBe(25000);
    });

    it("worked example: (109900 - 99900) * 7 / 30 = 2333.33... rounds down to 2333", () => {
      expect(proratedUpgradeCentavos(99900, 109900, 7, 30)).toBe(2333);
    });

    it("half-centavo rounds up: (100003 - 100000) * 1 / 6 = 0.5 -> 1", () => {
      expect(proratedUpgradeCentavos(100000, 100003, 1, 6)).toBe(1);
    });

    it("zero remaining days yields zero delta charge", () => {
      expect(proratedUpgradeCentavos(99900, 149900, 0, 30)).toBe(0);
    });

    it("full remaining period charges the full delta", () => {
      expect(proratedUpgradeCentavos(99900, 149900, 30, 30)).toBe(50000);
    });
  });

  describe("etfCentavos — remainingMonths * 50% of monthly fee, round half up", () => {
    it("worked example: 3 months * 50% of 99900 = 149850", () => {
      expect(etfCentavos(99900, 3)).toBe(149850);
    });

    it("half-centavo rounds up: 1 month * 50% of 100001 = 50000.5 -> 50001", () => {
      expect(etfCentavos(100001, 1)).toBe(50001);
    });

    it("zero remaining months yields zero ETF", () => {
      expect(etfCentavos(99900, 0)).toBe(0);
    });
  });

  describe("remainingLockInMonths — computed in Manila, ceilinged to whole months", () => {
    it("now exactly at lock-in end -> 0", () => {
      const end = manilaUtc("2026-04-30T02:00:00.000Z");
      expect(remainingLockInMonths(end, end)).toBe(0);
    });

    it("now after lock-in end -> 0", () => {
      const end = manilaUtc("2026-04-30T02:00:00.000Z");
      const now = manilaUtc("2026-05-01T02:00:00.000Z");
      expect(remainingLockInMonths(end, now)).toBe(0);
    });

    it("~2.5 months remaining (Feb 15 -> Apr 30) ceils to 3", () => {
      const end = manilaUtc("2026-04-30T02:00:00.000Z");
      const now = manilaUtc("2026-02-15T02:00:00.000Z");
      expect(remainingLockInMonths(end, now)).toBe(3);
    });

    it("exactly 2 whole months remaining (Feb 28 -> Apr 28) -> 2", () => {
      const end = manilaUtc("2026-04-28T02:00:00.000Z");
      const now = manilaUtc("2026-02-28T02:00:00.000Z");
      expect(remainingLockInMonths(end, now)).toBe(2);
    });

    it("one day short of a whole month still ceils up (Feb 28 -> Apr 27) -> 2", () => {
      const end = manilaUtc("2026-04-27T02:00:00.000Z");
      const now = manilaUtc("2026-02-28T02:00:00.000Z");
      expect(remainingLockInMonths(end, now)).toBe(2);
    });
  });
});
