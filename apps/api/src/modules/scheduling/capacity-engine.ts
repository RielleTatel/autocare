/**
 * Pure capacity kernel (Architecture §7.7, FR-041). Computes bookable slots for ONE day from a
 * two-resource constraint: a slot needs a bay whose capabilities cover the service's required set
 * AND a qualified mechanic on shift who is not already committed at that instant.
 *
 * All times are `HH:mm` strings within the day plus a `YYYY-MM-DD` date. PH has no DST, so slot
 * arithmetic is plain minute math — no offset handling. The function is deliberately pure and
 * allocation-light so it can be unit-tested exhaustively and called per-day across a 30-day window
 * without touching the DB.
 */
export interface CapacityInputs {
  date: string; // YYYY-MM-DD (Asia/Manila)
  serviceType: { durationMin: number; requiredSkills: string[] };
  operatingWindow: { open: string; close: string } | null; // HH:mm; null = closed
  bays: Array<{ id: string; capabilities: string[] }>;
  blocks: Array<{ bayId: string | null; start: string; end: string }>; // HH:mm; bayId null = whole shop
  shifts: Array<{ mechanicId: string; start: string; end: string; skills: string[] }>; // HH:mm
  appointments: Array<{ bayId: string; start: string; end: string }>; // HH:mm
  holds: Array<{ bayId: string; start: string; end: string }>; // HH:mm
  walkInBufferPct: number; // 0..100
}

export interface Slot {
  start: string; // HH:mm
  end: string; // HH:mm
  bayId: string;
}

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const toHHMM = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
  aStart < bEnd && bStart < aEnd;

const covers = (have: string[], need: string[]): boolean => need.every((x) => have.includes(x));

export function availableSlots(i: CapacityInputs): Slot[] {
  if (!i.operatingWindow) return [];

  const windowStart = toMin(i.operatingWindow.open);
  const windowEnd = toMin(i.operatingWindow.close);
  const dur = i.serviceType.durationMin;
  const need = i.serviceType.requiredSkills;

  // Bays that can physically perform this service.
  const capableBays = i.bays.filter((b) => covers(b.capabilities, need));

  // Candidate (start, bay) pairs whose bay is free (no block / appointment / hold overlap) and
  // whose slot fits fully inside the operating window.
  type Candidate = { startMin: number; endMin: number; bayId: string };
  const candidatesByStart = new Map<number, Candidate[]>();

  for (let start = windowStart; start + dur <= windowEnd; start += dur) {
    const end = start + dur;
    for (const bay of capableBays) {
      const blocked = i.blocks.some(
        (bl) => (bl.bayId === null || bl.bayId === bay.id) && overlaps(start, end, toMin(bl.start), toMin(bl.end)),
      );
      if (blocked) continue;

      const taken =
        i.appointments.some((a) => a.bayId === bay.id && overlaps(start, end, toMin(a.start), toMin(a.end))) ||
        i.holds.some((h) => h.bayId === bay.id && overlaps(start, end, toMin(h.start), toMin(h.end)));
      if (taken) continue;

      const list = candidatesByStart.get(start) ?? [];
      list.push({ startMin: start, endMin: end, bayId: bay.id });
      candidatesByStart.set(start, list);
    }
  }

  // Mechanic constraint: at each start-time, the number of offered slots cannot exceed the number
  // of qualified mechanics whose shift fully covers the slot. Cap concurrency per instant.
  const surviving: Slot[] = [];
  for (const [start, cands] of candidatesByStart) {
    const end = start + dur;
    const qualifiedMechanics = i.shifts.filter(
      (s) => covers(s.skills, need) && toMin(s.start) <= start && end <= toMin(s.end),
    ).length;
    if (qualifiedMechanics === 0) continue;

    // Deterministic pick: sort candidate bays by id, keep at most `qualifiedMechanics` of them.
    const capped = cands.sort((a, b) => a.bayId.localeCompare(b.bayId)).slice(0, qualifiedMechanics);
    for (const c of capped) surviving.push({ start: toHHMM(c.startMin), end: toHHMM(c.endMin), bayId: c.bayId });
  }

  surviving.sort((a, b) => (a.start === b.start ? a.bayId.localeCompare(b.bayId) : a.start.localeCompare(b.start)));

  // Walk-in buffer: withhold the last ceil(N * pct/100) slots (latest-start first) from online
  // booking so counter/walk-in demand always has headroom.
  if (i.walkInBufferPct > 0 && surviving.length > 0) {
    const withhold = Math.ceil((surviving.length * i.walkInBufferPct) / 100);
    if (withhold >= surviving.length) return [];
    return surviving.slice(0, surviving.length - withhold);
  }

  return surviving;
}
