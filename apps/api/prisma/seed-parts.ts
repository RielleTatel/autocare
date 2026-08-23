/**
 * Seeds a starter parts catalogue (~40 common PH-market SKUs). Idempotent:
 * upserts by SKU so re-running never duplicates. Prices in centavos.
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' prisma/seed-parts.ts
 */
import { PrismaClient } from "@prisma/client";

type PartSeed = { sku: string; name: string; category: string; cost: number; price: number; stock: number; reorder: number };

// cost/price are pesos in the source table; multiply to centavos on write.
const PARTS: PartSeed[] = [
  // Engine oils
  { sku: "OIL-5W30-1L", name: "Fully Synthetic 5W-30 Engine Oil (1L)", category: "OIL", cost: 320, price: 520, stock: 60, reorder: 20 },
  { sku: "OIL-10W40-1L", name: "Semi-Synthetic 10W-40 Engine Oil (1L)", category: "OIL", cost: 240, price: 420, stock: 80, reorder: 24 },
  { sku: "OIL-0W20-1L", name: "Fully Synthetic 0W-20 Engine Oil (1L)", category: "OIL", cost: 360, price: 580, stock: 40, reorder: 16 },
  { sku: "OIL-15W40-4L", name: "Diesel 15W-40 Engine Oil (4L)", category: "OIL", cost: 900, price: 1450, stock: 30, reorder: 10 },
  { sku: "ATF-DEXRON-1L", name: "Dexron VI ATF (1L)", category: "FLUID", cost: 280, price: 480, stock: 35, reorder: 12 },
  { sku: "COOLANT-1L", name: "Long-Life Coolant Concentrate (1L)", category: "FLUID", cost: 180, price: 320, stock: 50, reorder: 15 },
  { sku: "BRAKEFLUID-DOT4", name: "DOT 4 Brake Fluid (500ml)", category: "FLUID", cost: 150, price: 280, stock: 45, reorder: 15 },
  { sku: "PS-FLUID-1L", name: "Power Steering Fluid (1L)", category: "FLUID", cost: 160, price: 300, stock: 25, reorder: 10 },
  { sku: "WASHER-2L", name: "Windshield Washer Fluid (2L)", category: "FLUID", cost: 90, price: 180, stock: 40, reorder: 12 },
  // Filters
  { sku: "FIL-OIL-STD", name: "Oil Filter (standard spin-on)", category: "FILTER", cost: 120, price: 250, stock: 90, reorder: 30 },
  { sku: "FIL-OIL-CART", name: "Oil Filter (cartridge)", category: "FILTER", cost: 160, price: 320, stock: 50, reorder: 18 },
  { sku: "FIL-AIR-STD", name: "Engine Air Filter", category: "FILTER", cost: 220, price: 420, stock: 55, reorder: 18 },
  { sku: "FIL-CABIN", name: "Cabin / A/C Filter", category: "FILTER", cost: 260, price: 480, stock: 48, reorder: 16 },
  { sku: "FIL-FUEL", name: "Fuel Filter", category: "FILTER", cost: 340, price: 620, stock: 30, reorder: 10 },
  // Brakes
  { sku: "BRK-PAD-FR-STD", name: "Front Brake Pad Set (standard)", category: "BRAKE", cost: 850, price: 1550, stock: 40, reorder: 12 },
  { sku: "BRK-PAD-RR-STD", name: "Rear Brake Pad Set (standard)", category: "BRAKE", cost: 780, price: 1450, stock: 36, reorder: 12 },
  { sku: "BRK-PAD-FR-CER", name: "Front Brake Pad Set (ceramic)", category: "BRAKE", cost: 1400, price: 2500, stock: 20, reorder: 8 },
  { sku: "BRK-DISC-FR", name: "Front Brake Disc (each)", category: "BRAKE", cost: 1600, price: 2800, stock: 16, reorder: 6 },
  { sku: "BRK-SHOE-RR", name: "Rear Brake Shoe Set", category: "BRAKE", cost: 620, price: 1150, stock: 24, reorder: 8 },
  // Batteries & electrical
  { sku: "BAT-NS40", name: "Battery NS40 (maintenance-free)", category: "BATTERY", cost: 2600, price: 3900, stock: 18, reorder: 6 },
  { sku: "BAT-NS60", name: "Battery NS60 (maintenance-free)", category: "BATTERY", cost: 3200, price: 4700, stock: 15, reorder: 6 },
  { sku: "BAT-3SM", name: "Battery 3SM / N70 (deep cycle)", category: "BATTERY", cost: 4800, price: 6800, stock: 10, reorder: 4 },
  { sku: "BULB-H4", name: "Headlight Bulb H4 (halogen)", category: "ELECTRICAL", cost: 120, price: 260, stock: 60, reorder: 20 },
  { sku: "BULB-LED-H4", name: "Headlight Bulb H4 (LED)", category: "ELECTRICAL", cost: 650, price: 1200, stock: 24, reorder: 8 },
  { sku: "BULB-STOP", name: "Stop Lamp Bulb (12V 21W)", category: "ELECTRICAL", cost: 45, price: 120, stock: 100, reorder: 30 },
  { sku: "WIPER-20", name: 'Wiper Blade 20"', category: "ELECTRICAL", cost: 180, price: 350, stock: 50, reorder: 16 },
  { sku: "WIPER-24", name: 'Wiper Blade 24"', category: "ELECTRICAL", cost: 200, price: 390, stock: 45, reorder: 16 },
  // Ignition & engine
  { sku: "SPARK-STD", name: "Spark Plug (standard, each)", category: "IGNITION", cost: 120, price: 240, stock: 120, reorder: 40 },
  { sku: "SPARK-IRID", name: "Spark Plug (iridium, each)", category: "IGNITION", cost: 420, price: 720, stock: 48, reorder: 16 },
  { sku: "BELT-DRIVE", name: "Serpentine / Drive Belt", category: "ENGINE", cost: 680, price: 1200, stock: 22, reorder: 8 },
  { sku: "BELT-TIMING-KIT", name: "Timing Belt Kit", category: "ENGINE", cost: 2800, price: 4600, stock: 8, reorder: 3 },
  { sku: "MOUNT-ENGINE", name: "Engine Mount", category: "ENGINE", cost: 1200, price: 2100, stock: 12, reorder: 4 },
  // Suspension & steering
  { sku: "SHOCK-FR", name: "Front Shock Absorber (each)", category: "SUSPENSION", cost: 1500, price: 2600, stock: 16, reorder: 6 },
  { sku: "SHOCK-RR", name: "Rear Shock Absorber (each)", category: "SUSPENSION", cost: 1350, price: 2350, stock: 16, reorder: 6 },
  { sku: "BALLJOINT", name: "Ball Joint", category: "SUSPENSION", cost: 480, price: 900, stock: 20, reorder: 8 },
  { sku: "TIEROD-END", name: "Tie Rod End", category: "STEERING", cost: 420, price: 820, stock: 22, reorder: 8 },
  { sku: "BUSHING-STAB", name: "Stabilizer Bushing (pair)", category: "SUSPENSION", cost: 220, price: 450, stock: 30, reorder: 10 },
  // Tyres & misc
  { sku: "TIRE-185-65-15", name: "Tyre 185/65 R15", category: "TIRE", cost: 2400, price: 3600, stock: 24, reorder: 8 },
  { sku: "TIRE-195-55-16", name: "Tyre 195/55 R16", category: "TIRE", cost: 2900, price: 4200, stock: 20, reorder: 8 },
  { sku: "TIRE-205-55-16", name: "Tyre 205/55 R16", category: "TIRE", cost: 3200, price: 4600, stock: 18, reorder: 6 },
  { sku: "VALVE-STEM", name: "Tyre Valve Stem", category: "TIRE", cost: 20, price: 60, stock: 200, reorder: 50 },
];

export async function seedParts(prisma: PrismaClient): Promise<number> {
  for (const p of PARTS) {
    await prisma.part.upsert({
      where: { sku: p.sku },
      update: { name: p.name, category: p.category, costCentavos: BigInt(p.cost * 100), priceCentavos: BigInt(p.price * 100), reorderLevel: p.reorder },
      create: {
        sku: p.sku, name: p.name, category: p.category,
        costCentavos: BigInt(p.cost * 100), priceCentavos: BigInt(p.price * 100),
        stockQty: p.stock, reorderLevel: p.reorder,
      },
    });
  }
  return PARTS.length;
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedParts(prisma)
    .then((n) => console.log(`seeded ${n} parts`))
    .finally(() => prisma.$disconnect());
}
