import { Injectable } from "@nestjs/common";
import type { ChecklistDraftPatch, PreviewScoreInput } from "@autocare/contracts";
import { computeVHS } from "@autocare/scoring";
import { DomainError } from "../../common/errors/domain-error";
import { AuditService } from "../../common/audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { AbilityUser } from "../../common/policies/ability.factory";
import { LoadedChecklist, toChecklistConfig } from "./config-mapper";

const STAFF_ROLES = new Set(["MECHANIC", "ADVISOR", "ADMIN"]);

@Injectable()
export class ChecklistsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private assertStaff(u: AbilityUser): void {
    if (!STAFF_ROLES.has(u.role)) throw new DomainError("FORBIDDEN_ROLE", "staff only", 403);
  }
  private assertAdmin(u: AbilityUser): void {
    if (u.role !== "ADMIN") throw new DomainError("FORBIDDEN_ROLE", "admin only", 403);
  }

  private loadFull(id: string): Promise<LoadedChecklist> {
    return this.prisma.checklistVersion.findUniqueOrThrow({
      where: { id },
      include: { categories: { include: { points: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } },
    });
  }

  private present(v: LoadedChecklist) {
    const config = toChecklistConfig(v);
    return {
      id: v.id,
      versionLabel: v.versionLabel,
      weightVersion: v.weightVersion,
      status: v.status,
      isActive: v.isActive,
      publishedAt: v.publishedAt,
      categories: config.categories,
    };
  }

  async getActive(u: AbilityUser) {
    this.assertStaff(u);
    const v = await this.prisma.checklistVersion.findFirst({ where: { isActive: true } });
    if (!v) throw new DomainError("CHECKLIST_INVALID", "no active checklist", 404);
    return this.present(await this.loadFull(v.id));
  }

  async list(u: AbilityUser) {
    this.assertAdmin(u);
    return this.prisma.checklistVersion.findMany({ orderBy: { createdAt: "desc" } });
  }

  async get(u: AbilityUser, id: string) {
    this.assertAdmin(u);
    return this.present(await this.loadFull(id));
  }

  /** Clone the active version into a fresh DRAFT with the next version label. */
  async createDraft(u: AbilityUser) {
    this.assertAdmin(u);
    const active = await this.prisma.checklistVersion.findFirst({ where: { isActive: true } });
    if (!active) throw new DomainError("CHECKLIST_INVALID", "no active checklist to clone", 409);
    const source = await this.loadFull(active.id);
    const label = await this.nextVersionLabel(source.versionLabel);

    const draft = await this.prisma.$transaction(async (tx) => {
      const v = await tx.checklistVersion.create({
        data: { versionLabel: label, weightVersion: source.weightVersion, status: "DRAFT", isActive: false },
      });
      for (const cat of source.categories) {
        const c = await tx.checklistCategory.create({
          data: {
            checklistVersionId: v.id, code: cat.code, label: cat.label, labelFil: cat.labelFil,
            weight: cat.weight, sortOrder: cat.sortOrder,
          },
        });
        for (const p of cat.points) {
          await tx.checklistPoint.create({
            data: {
              categoryId: c.id, code: p.code, label: p.label, labelFil: p.labelFil,
              weightInCategory: p.weightInCategory, isSafetyCritical: p.isSafetyCritical,
              inputType: p.inputType, unit: p.unit,
              thresholdDirection: p.thresholdDirection, thresholdGood: p.thresholdGood,
              thresholdMonitor: p.thresholdMonitor, thresholdAttention: p.thresholdAttention,
              recommendation: p.recommendation, templates: p.templates ?? undefined,
              requiresPhotoOnAdverse: p.requiresPhotoOnAdverse, notApplicableWhen: p.notApplicableWhen,
              sortOrder: p.sortOrder,
            },
          });
        }
      }
      return v;
    });
    await this.audit.record(u.id, "CHECKLIST_DRAFT_CREATED", "ChecklistVersion", draft.id, null, { versionLabel: label, clonedFrom: source.versionLabel });
    return draft;
  }

  /** Wholesale replace a draft's categories/points. Drafts only (FR-101). */
  async patchDraft(u: AbilityUser, id: string, dto: ChecklistDraftPatch) {
    this.assertAdmin(u);
    const v = await this.prisma.checklistVersion.findUniqueOrThrow({ where: { id } });
    if (v.status !== "DRAFT") throw new DomainError("CHECKLIST_IMMUTABLE", "published checklist versions are immutable", 409);

    await this.prisma.$transaction(async (tx) => {
      await tx.checklistPoint.deleteMany({ where: { category: { checklistVersionId: id } } });
      await tx.checklistCategory.deleteMany({ where: { checklistVersionId: id } });
      let catOrder = 0;
      for (const cat of dto.categories) {
        const c = await tx.checklistCategory.create({
          data: {
            checklistVersionId: id, code: cat.code, label: cat.label, labelFil: cat.labelFil ?? null,
            weight: cat.weight, sortOrder: catOrder++,
          },
        });
        let ptOrder = 0;
        for (const p of cat.points) {
          await tx.checklistPoint.create({
            data: {
              categoryId: c.id, code: p.code, label: p.label, labelFil: p.labelFil ?? null,
              weightInCategory: p.weightInCategory, isSafetyCritical: p.isSafetyCritical,
              inputType: p.inputType, unit: p.unit ?? null,
              thresholdDirection: p.thresholds?.direction ?? null,
              thresholdGood: p.thresholds?.good ?? null,
              thresholdMonitor: p.thresholds?.monitor ?? null,
              thresholdAttention: p.thresholds?.attention ?? null,
              recommendation: p.recommendation, templates: p.templates ?? undefined,
              requiresPhotoOnAdverse: p.requiresPhotoOnAdverse,
              notApplicableWhen: p.notApplicableWhen ?? null,
              sortOrder: ptOrder++,
            },
          });
        }
      }
    });
    await this.audit.record(u.id, "CHECKLIST_DRAFT_EDITED", "ChecklistVersion", id, null, { categories: dto.categories.length });
    return this.present(await this.loadFull(id));
  }

  /** Publish a draft: validate, deactivate previous active, bump weightVersion when weights changed. */
  async publish(u: AbilityUser, id: string) {
    this.assertAdmin(u);
    const draft = await this.loadFull(id);
    if (draft.status !== "DRAFT") throw new DomainError("CHECKLIST_IMMUTABLE", "only drafts can be published", 409);
    this.validateForPublish(draft);

    const previous = await this.prisma.checklistVersion.findFirst({ where: { isActive: true } });
    const weightVersion = previous && (await this.weightsChanged(draft, previous.id))
      ? bumpVersion((await this.prisma.checklistVersion.findUniqueOrThrow({ where: { id: previous.id } })).weightVersion)
      : draft.weightVersion;

    const published = await this.prisma.$transaction(async (tx) => {
      if (previous) await tx.checklistVersion.update({ where: { id: previous.id }, data: { isActive: false } });
      return tx.checklistVersion.update({
        where: { id },
        data: { status: "PUBLISHED", isActive: true, publishedAt: new Date(), weightVersion },
      });
    });
    await this.audit.record(u.id, "CHECKLIST_PUBLISHED", "ChecklistVersion", id, { previousActive: previous?.id ?? null }, { versionLabel: published.versionLabel, weightVersion });
    return published;
  }

  /** Run the pure engine against a version's config. Persists nothing. */
  async previewScore(u: AbilityUser, id: string, dto: PreviewScoreInput) {
    this.assertAdmin(u);
    const config = toChecklistConfig(await this.loadFull(id));
    return computeVHS({ results: dto.results, daysSinceInspection: dto.daysSinceInspection }, config);
  }

  private validateForPublish(v: LoadedChecklist): void {
    const problems: string[] = [];
    const catSum = v.categories.reduce((s, c) => s + c.weight, 0);
    if (Math.abs(catSum - 100) > 1e-9) problems.push(`category weights sum to ${catSum}, expected 100`);
    for (const c of v.categories) {
      const ptSum = c.points.reduce((s, p) => s + p.weightInCategory, 0);
      if (Math.abs(ptSum - 100) > 1e-9) problems.push(`category ${c.code} point weights sum to ${ptSum}, expected 100`);
      for (const p of c.points) {
        if (p.inputType === "MEASURED" && (p.thresholdDirection == null || p.thresholdGood == null || p.thresholdMonitor == null || p.thresholdAttention == null)) {
          problems.push(`measured point ${p.code} is missing thresholds`);
        }
        if (!p.label || !p.labelFil) problems.push(`point ${p.code} is missing EN+FIL labels`);
        if (!p.recommendation) problems.push(`point ${p.code} is missing a recommendation`);
      }
    }
    if (problems.length > 0) {
      throw new DomainError("CHECKLIST_INVALID", "checklist failed publish validation", 409, { problems });
    }
  }

  private async weightsChanged(draft: LoadedChecklist, previousId: string): Promise<boolean> {
    const prev = await this.loadFull(previousId);
    const key = (v: LoadedChecklist) =>
      JSON.stringify(
        [...v.categories]
          .sort((a, b) => a.code.localeCompare(b.code))
          .map((c) => [c.code, c.weight, [...c.points].sort((a, b) => a.code.localeCompare(b.code)).map((p) => [p.code, p.weightInCategory])]),
      );
    return key(draft) !== key(prev);
  }

  private async nextVersionLabel(base: string): Promise<string> {
    const m = /^v(\d+)\.(\d+)$/.exec(base);
    let major = 1, minor = 1;
    if (m) { major = Number(m[1]); minor = Number(m[2]) + 1; }
    // skip labels already taken (crashed runs, concurrent drafts)
    for (;;) {
      const label = `v${major}.${minor}`;
      const clash = await this.prisma.checklistVersion.findUnique({ where: { versionLabel: label } });
      if (!clash) return label;
      minor += 1;
    }
  }
}

function bumpVersion(w: string): string {
  const m = /^w(\d+)\.(\d+)$/.exec(w);
  if (!m) return `${w}+1`;
  return `w${m[1]}.${Number(m[2]) + 1}`;
}
