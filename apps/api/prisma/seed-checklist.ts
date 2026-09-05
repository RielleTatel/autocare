/**
 * Seeds checklist v1.0 from the single authoring point in @autocare/scoring.
 * Idempotent: upserts by version label; re-running never duplicates rows.
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' prisma/seed-checklist.ts
 */
import { PrismaClient } from "@prisma/client";
import { seedConfig } from "@autocare/scoring";

export async function seedChecklist(prisma: PrismaClient): Promise<string> {
  const existing = await prisma.checklistVersion.findUnique({ where: { versionLabel: seedConfig.checklistVersion } });
  if (existing) return existing.id;

  return prisma.$transaction(async (tx) => {
    const version = await tx.checklistVersion.create({
      data: {
        versionLabel: seedConfig.checklistVersion,
        weightVersion: seedConfig.weightVersion,
        status: "PUBLISHED",
        isActive: true,
        publishedAt: new Date(),
      },
    });
    let catOrder = 0;
    for (const cat of seedConfig.categories) {
      const category = await tx.checklistCategory.create({
        data: {
          checklistVersionId: version.id,
          code: cat.code, label: cat.label, labelFil: cat.labelFil ?? null,
          weight: cat.weight, sortOrder: catOrder++,
        },
      });
      let ptOrder = 0;
      for (const p of cat.points) {
        await tx.checklistPoint.create({
          data: {
            categoryId: category.id,
            code: p.code, label: p.label, labelFil: p.labelFil ?? null,
            weightInCategory: p.weightInCategory,
            isSafetyCritical: p.isSafetyCritical,
            inputType: p.inputType,
            unit: p.unit ?? null,
            thresholdDirection: p.thresholds?.direction ?? null,
            thresholdGood: p.thresholds?.good ?? null,
            thresholdMonitor: p.thresholds?.monitor ?? null,
            thresholdAttention: p.thresholds?.attention ?? null,
            recommendation: p.recommendation,
            templates: p.templates ?? undefined,
            requiresPhotoOnAdverse: p.requiresPhotoOnAdverse ?? false,
            notApplicableWhen: p.notApplicableWhen ?? null,
            diagramZoneId: p.diagramZone ?? null,
            sortOrder: ptOrder++,
          },
        });
      }
    }
    return version.id;
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedChecklist(prisma)
    .then((id) => console.log(`checklist ${id} seeded (or already present)`))
    .finally(() => prisma.$disconnect());
}
