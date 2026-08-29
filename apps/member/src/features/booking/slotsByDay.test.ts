import { groupByManilaDay, partOfDay } from "./slotsByDay";
import type { Slot } from "./bookingApi";

const slot = (start: string): Slot => ({
  start, end: start, bayId: "bay1", serviceTypeId: "st1",
});

describe("groupByManilaDay", () => {
  it("splits a flat multi-day list into one entry per day", () => {
    const out = groupByManilaDay([
      slot("2026-08-29T09:00:00+08:00"),
      slot("2026-08-29T10:00:00+08:00"),
      slot("2026-08-30T09:00:00+08:00"),
    ]);
    expect(out.map((d) => d.date)).toEqual(["2026-08-29", "2026-08-30"]);
    expect(out[0].slots).toHaveLength(2);
    expect(out[1].slots).toHaveLength(1);
  });

  it("keeps days in chronological order regardless of input order", () => {
    const out = groupByManilaDay([
      slot("2026-09-02T09:00:00+08:00"),
      slot("2026-08-29T09:00:00+08:00"),
    ]);
    expect(out.map((d) => d.date)).toEqual(["2026-08-29", "2026-09-02"]);
  });

  it("files a late-evening slot under its Manila day, not the UTC one", () => {
    // 23:00 on the 29th in Manila is still the 15th hour of the 29th UTC-8.
    const out = groupByManilaDay([slot("2026-08-29T23:00:00+08:00")]);
    expect(out[0].date).toBe("2026-08-29");
  });

  it("returns nothing for no slots", () => {
    expect(groupByManilaDay([])).toEqual([]);
  });
});

describe("partOfDay", () => {
  it("splits the working day into morning, afternoon and evening", () => {
    expect(partOfDay("2026-08-29T09:00:00+08:00")).toBe("MORNING");
    expect(partOfDay("2026-08-29T11:59:00+08:00")).toBe("MORNING");
    expect(partOfDay("2026-08-29T12:00:00+08:00")).toBe("AFTERNOON");
    expect(partOfDay("2026-08-29T16:59:00+08:00")).toBe("AFTERNOON");
    expect(partOfDay("2026-08-29T17:00:00+08:00")).toBe("EVENING");
    expect(partOfDay("2026-08-29T22:00:00+08:00")).toBe("EVENING");
  });
});
