import { availableSlots, CapacityInputs } from "./capacity-engine";

const base: CapacityInputs = {
  date: "2026-09-01",
  serviceType: { durationMin: 60, requiredSkills: ["OIL"] },
  operatingWindow: { open: "09:00", close: "12:00" },
  bays: [{ id: "bay1", capabilities: ["OIL", "TIRE"] }],
  blocks: [],
  shifts: [{ mechanicId: "m1", start: "09:00", end: "12:00", skills: ["OIL"] }],
  appointments: [],
  holds: [],
  walkInBufferPct: 0,
};

describe("availableSlots", () => {
  it("returns hourly slots across the window", () => {
    const s = availableSlots(base);
    expect(s.map((x) => x.start)).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("closed day yields no slots", () => {
    expect(availableSlots({ ...base, operatingWindow: null })).toEqual([]);
  });

  it("a whole-shop block removes overlapping slots", () => {
    const s = availableSlots({ ...base, blocks: [{ bayId: null, start: "10:00", end: "11:00" }] });
    expect(s.map((x) => x.start)).toEqual(["09:00", "11:00"]);
  });

  it("a bay without the capability is not usable", () => {
    expect(availableSlots({ ...base, bays: [{ id: "bay1", capabilities: ["TIRE"] }] })).toEqual([]);
  });

  it("no skilled mechanic on shift closes the slot even with a free bay", () => {
    expect(
      availableSlots({ ...base, shifts: [{ mechanicId: "m1", start: "09:00", end: "12:00", skills: ["TIRE"] }] }),
    ).toEqual([]);
  });

  it("an existing appointment excludes its slot on that bay", () => {
    const s = availableSlots({ ...base, appointments: [{ bayId: "bay1", start: "10:00", end: "11:00" }] });
    expect(s.map((x) => x.start)).toEqual(["09:00", "11:00"]);
  });

  it("a hold excludes its slot", () => {
    const s = availableSlots({ ...base, holds: [{ bayId: "bay1", start: "09:00", end: "10:00" }] });
    expect(s.map((x) => x.start)).toEqual(["10:00", "11:00"]);
  });

  it("one mechanic, two bays: concurrency capped at 1 per instant", () => {
    const s = availableSlots({
      ...base,
      bays: [
        { id: "bay1", capabilities: ["OIL"] },
        { id: "bay2", capabilities: ["OIL"] },
      ],
    });
    const byStart = new Map<string, number>();
    for (const x of s) byStart.set(x.start, (byStart.get(x.start) ?? 0) + 1);
    expect([...byStart.values()].every((n) => n === 1)).toBe(true);
    expect([...byStart.keys()].sort()).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("two mechanics, two bays: two concurrent slots per instant", () => {
    const s = availableSlots({
      ...base,
      bays: [
        { id: "bay1", capabilities: ["OIL"] },
        { id: "bay2", capabilities: ["OIL"] },
      ],
      shifts: [
        { mechanicId: "m1", start: "09:00", end: "12:00", skills: ["OIL"] },
        { mechanicId: "m2", start: "09:00", end: "12:00", skills: ["OIL"] },
      ],
    });
    const byStart = new Map<string, number>();
    for (const x of s) byStart.set(x.start, (byStart.get(x.start) ?? 0) + 1);
    expect([...byStart.values()].every((n) => n === 2)).toBe(true);
  });

  it("walk-in buffer withholds the last slots", () => {
    const s = availableSlots({ ...base, walkInBufferPct: 40 }); // ceil(3*0.4)=2 withheld
    expect(s.map((x) => x.start)).toEqual(["09:00"]);
  });

  it("a partial trailing slot that overflows the window is not offered", () => {
    const s = availableSlots({ ...base, operatingWindow: { open: "09:00", close: "11:30" } });
    expect(s.map((x) => x.start)).toEqual(["09:00", "10:00"]);
  });

  it("sorts by start then bayId", () => {
    const s = availableSlots({
      ...base,
      bays: [
        { id: "bayB", capabilities: ["OIL"] },
        { id: "bayA", capabilities: ["OIL"] },
      ],
      shifts: [
        { mechanicId: "m1", start: "09:00", end: "12:00", skills: ["OIL"] },
        { mechanicId: "m2", start: "09:00", end: "12:00", skills: ["OIL"] },
      ],
    });
    // first two entries share start "09:00" and must be ordered bayA before bayB
    expect(s[0]).toEqual({ start: "09:00", end: "10:00", bayId: "bayA" });
    expect(s[1]).toEqual({ start: "09:00", end: "10:00", bayId: "bayB" });
  });
});
