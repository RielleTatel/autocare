/**
 * Seeds local-dev scheduling/booking reference data: operating hours, service
 * types, bays, and a rolling 30-day window of mechanic shifts. Without these
 * the capacity engine (capacity-engine.ts) has nothing to compute against and
 * every /scheduling/slots call returns an empty array.
 * Idempotent: upserts by unique keys, safe to re-run.
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' prisma/seed-scheduling.ts
 */
import { PrismaClient, Weekday } from "@prisma/client";

const prisma = new PrismaClient();

const WEEKDAYS: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const SERVICE_TYPES = [
  { code: "OIL_CHANGE", name: "Oil Change", standardDurationMin: 45, requiredSkills: ["GENERAL"], priceCentavos: 85000n, intervalDays: 180, intervalKm: 5000 },
  { code: "TIRE_ROTATION", name: "Tire Rotation", standardDurationMin: 30, requiredSkills: ["GENERAL"], priceCentavos: 45000n, intervalDays: 180, intervalKm: 10000 },
  { code: "BRAKE_SERVICE", name: "Brake Service", standardDurationMin: 90, requiredSkills: ["BRAKES"], priceCentavos: 180000n, intervalDays: null, intervalKm: 20000 },
  { code: "AC_SERVICE", name: "A/C Service", standardDurationMin: 60, requiredSkills: ["AC"], priceCentavos: 150000n, intervalDays: 365, intervalKm: null },
  { code: "FULL_INSPECTION", name: "Full Inspection", standardDurationMin: 60, requiredSkills: ["GENERAL"], priceCentavos: 60000n, intervalDays: 365, intervalKm: 15000 },
];

const BAYS = [
  { name: "Bay 1", capabilities: ["GENERAL", "BRAKES", "AC"] },
  { name: "Bay 2", capabilities: ["GENERAL", "BRAKES"] },
];

const MECHANIC_SKILLS = ["GENERAL", "BRAKES", "AC"];
const SHIFT_WINDOW_DAYS = 30;

function manilaDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

async function main() {
  // ---- Operating hours: 09:00-18:00 every day, replacing any bad rows (e.g. close < open) ----
  for (const weekday of WEEKDAYS) {
    await prisma.operatingHours.upsert({
      where: { weekday },
      update: { openTime: "09:00", closeTime: "18:00", walkInBufferPct: 10 },
      create: { weekday, openTime: "09:00", closeTime: "18:00", walkInBufferPct: 10 },
    });
  }
  console.log(`Operating hours: ${WEEKDAYS.length} days set to 09:00-18:00`);

  // ---- Service types ----
  for (const st of SERVICE_TYPES) {
    await prisma.serviceType.upsert({
      where: { code: st.code },
      update: { name: st.name, standardDurationMin: st.standardDurationMin, requiredSkills: st.requiredSkills, priceCentavos: st.priceCentavos, intervalDays: st.intervalDays, intervalKm: st.intervalKm, isActive: true },
      create: st,
    });
  }
  console.log(`Service types: ${SERVICE_TYPES.length} upserted`);

  // ---- Bays ----
  const bays = [];
  for (const b of BAYS) {
    const bay = await prisma.serviceBay.upsert({
      where: { name: b.name },
      update: { capabilities: b.capabilities, isActive: true },
      create: b,
    });
    bays.push(bay);
  }
  console.log(`Bays: ${bays.length} upserted`);

  // ---- Mechanic user (placeholder — no real Firebase account needed for shift assignment) ----
  const mechanic = await prisma.user.upsert({
    where: { firebaseUid: "seed-mechanic-1" },
    update: { role: "MECHANIC", isCertifiedTechnician: true },
    create: {
      firebaseUid: "seed-mechanic-1",
      email: "seed.mechanic@autocare.dev",
      name: "Seed Mechanic",
      role: "MECHANIC",
      isCertifiedTechnician: true,
    },
  });
  console.log(`Mechanic user: ${mechanic.email}`);

  // ---- Shifts: rolling window, one mechanic covering the full operating window every day ----
  const today = new Date();
  let shiftCount = 0;
  for (let i = 0; i < SHIFT_WINDOW_DAYS; i++) {
    const date = manilaDateStr(new Date(today.getTime() + i * 86_400_000));
    const existing = await prisma.staffShift.findFirst({ where: { userId: mechanic.id, date } });
    if (existing) continue;
    await prisma.staffShift.create({
      data: { userId: mechanic.id, date, startTime: "09:00", endTime: "18:00", skills: MECHANIC_SKILLS },
    });
    shiftCount++;
  }
  console.log(`Shifts: ${shiftCount} created for the next ${SHIFT_WINDOW_DAYS} days`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
