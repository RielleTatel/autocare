import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ChecklistDraftPatch, InspectionTemplateCreate, InspectionTemplateVersionCreate, PreviewScoreInput } from "@autocare/contracts";
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

  async listTemplates(u: AbilityUser) {
    this.assertAdmin(u);
    const rows = await this.prisma.inspectionTemplate.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { versions: { orderBy: { createdAt: "desc" } } },
    });
    return rows.map((template) => this.presentTemplate(template));
  }

  async getTemplate(u: AbilityUser, templateId: string) {
    this.assertAdmin(u);
    const template = await this.prisma.inspectionTemplate.findUnique({
      where: { id: templateId },
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
          include: { categories: { include: { points: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    if (!template) throw new DomainError("CHECKLIST_INVALID", "inspection template not found", 404);
    return {
      id: template.id,
      name: template.name,
      scope: template.scope,
      isActive: template.isActive,
      versions: template.versions.map((version) => ({
        id: version.id,
        versionLabel: this.templateDisplayVersion(version.versionLabel),
        weightVersion: version.weightVersion,
        status: version.status,
        publishedAt: version.publishedAt,
        categories: toChecklistConfig(version as LoadedChecklist).categories,
      })),
    };
  }

  async createTemplate(u: AbilityUser, dto: InspectionTemplateCreate) {
    this.assertAdmin(u);
    const created = await this.prisma.inspectionTemplate.create({ data: { name: dto.name, scope: dto.scope } });
    await this.audit.record(u.id, "INSPECTION_TEMPLATE_CREATED", "InspectionTemplate", created.id, null, { name: created.name, scope: created.scope });
    return { id: created.id, name: created.name, scope: created.scope, isActive: created.isActive, versions: [] };
  }

  async createTemplateVersion(u: AbilityUser, templateId: string, dto: InspectionTemplateVersionCreate) {
    this.assertAdmin(u);
    const template = await this.prisma.inspectionTemplate.findUnique({ where: { id: templateId } });
    if (!template || !template.isActive) throw new DomainError("CHECKLIST_INVALID", "active inspection template not found", 404);

    const versions = await this.prisma.checklistVersion.findMany({ where: { templateId }, orderBy: { createdAt: "desc" } });
    const sourceId = dto.sourceVersionId ?? versions[0]?.id ?? (await this.prisma.checklistVersion.findFirst({ where: { isActive: true }, select: { id: true } }))?.id;
    if (!sourceId) throw new DomainError("CHECKLIST_INVALID", "no published baseline exists to copy; publish the current full checklist first", 409);
    const source = await this.loadFull(sourceId);
    if (dto.sourceVersionId && source.templateId !== templateId && source.isActive !== true) {
      throw new DomainError("CHECKLIST_INVALID", "source must be a version of this template or the active full checklist", 422);
    }
    if (source.status === "DRAFT") throw new DomainError("CHECKLIST_INVALID", "only a published checklist can seed a new template version", 409);

    const localRevision = versions.length + 1;
    const label = `template-${templateId}-v${localRevision}`;
    const draft = await this.cloneChecklist(source, { templateId, versionLabel: label });
    await this.audit.record(u.id, "INSPECTION_TEMPLATE_VERSION_CREATED", "ChecklistVersion", draft.id, null, { templateId, sourceVersionId: source.id, versionLabel: `v${localRevision}` });
    return this.getTemplate(u, templateId);
  }

  async patchTemplateVersion(u: AbilityUser, templateId: string, versionId: string, dto: ChecklistDraftPatch) {
    this.assertAdmin(u);
    const version = await this.prisma.checklistVersion.findFirst({ where: { id: versionId, templateId } });
    if (!version) throw new DomainError("CHECKLIST_INVALID", "template version not found", 404);
    await this.patchDraft(u, versionId, dto);
    return this.getTemplate(u, templateId);
  }

  async publishTemplateVersion(u: AbilityUser, templateId: string, versionId: string) {
    this.assertAdmin(u);
    const [template, version] = await Promise.all([
      this.prisma.inspectionTemplate.findUnique({ where: { id: templateId } }),
      this.prisma.checklistVersion.findFirst({ where: { id: versionId, templateId } }),
    ]);
    if (!template || !version) throw new DomainError("CHECKLIST_INVALID", "template version not found", 404);
    if (version.status !== "DRAFT") throw new DomainError("CHECKLIST_IMMUTABLE", "only draft versions can be published", 409);

    const draft = await this.loadFull(versionId);
    this.validateForPublish(draft);
    const previousFull = template.scope === "FULL"
      ? await this.prisma.checklistVersion.findFirst({ where: { isActive: true } })
      : null;
    if (template.scope === "FULL" && previousFull && previousFull.id !== versionId) {
      const baseline = await this.loadFull(previousFull.id);
      this.validateFullCoverage(draft, baseline);
    }
    const published = await this.prisma.$transaction(async (tx) => {
      if (previousFull) await tx.checklistVersion.update({ where: { id: previousFull.id }, data: { isActive: false } });
      return tx.checklistVersion.update({
        where: { id: versionId },
        data: { status: "PUBLISHED", isActive: template.scope === "FULL", publishedAt: new Date() },
      });
    });
    await this.audit.record(u.id, "INSPECTION_TEMPLATE_VERSION_PUBLISHED", "ChecklistVersion", published.id, { previousFullVersionId: previousFull?.id ?? null }, { templateId, scope: template.scope });
    return this.getTemplate(u, templateId);
  }

  private presentTemplate<T extends { id: string; name: string; scope: string; isActive: boolean; versions: Array<{ id: string; versionLabel: string; weightVersion: string; status: string; publishedAt: Date | null }> }>(template: T) {
    return {
      id: template.id,
      name: template.name,
      scope: template.scope,
      isActive: template.isActive,
      versions: template.versions.map((version) => ({
        id: version.id,
        versionLabel: this.templateDisplayVersion(version.versionLabel),
        weightVersion: version.weightVersion,
        status: version.status,
        publishedAt: version.publishedAt,
      })),
    };
  }

  private templateDisplayVersion(versionLabel: string): string {
    const match = /-v(\d+)$/.exec(versionLabel);
    return match ? `v${match[1]}.0` : versionLabel;
  }

  private async cloneChecklist(source: LoadedChecklist, opts: { templateId?: string; versionLabel: string }) {
    return this.prisma.$transaction(async (tx) => {
      const v = await tx.checklistVersion.create({
        data: { versionLabel: opts.versionLabel, weightVersion: source.weightVersion, status: "DRAFT", isActive: false, templateId: opts.templateId ?? null },
      });
      const categories = source.categories.map((cat) => ({ ...cat, newId: randomUUID() }));
      await tx.checklistCategory.createMany({
        data: categories.map((cat) => ({
          id: cat.newId, checklistVersionId: v.id, code: cat.code, label: cat.label,
          labelFil: cat.labelFil, weight: cat.weight, sortOrder: cat.sortOrder,
        })),
      });
      await tx.checklistPoint.createMany({
        data: categories.flatMap((cat) => cat.points.map((p) => ({
          categoryId: cat.newId, code: p.code, label: p.label, labelFil: p.labelFil,
          weightInCategory: p.weightInCategory, isSafetyCritical: p.isSafetyCritical,
          inputType: p.inputType, unit: p.unit, thresholdDirection: p.thresholdDirection,
          thresholdGood: p.thresholdGood, thresholdMonitor: p.thresholdMonitor,
          thresholdAttention: p.thresholdAttention, recommendation: p.recommendation,
          templates: p.templates ?? undefined, requiresPhotoOnAdverse: p.requiresPhotoOnAdverse,
          notApplicableWhen: p.notApplicableWhen, diagramZoneId: p.diagramZoneId, sortOrder: p.sortOrder,
        }))),
      });
      return v;
    });
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

    // Bulk, not row-by-row. Cloning issued 1 + categories + points sequential
    // creates (61 for the seeded checklist); on the hosted database that ran
    // ~7.4s and blew Prisma's 5s interactive-transaction limit, expiring with
    // P2028 and surfacing as a 500. Category ids are minted here so the points
    // can be inserted in one statement without reading the categories back.
    const draft = await this.prisma.$transaction(async (tx) => {
      const v = await tx.checklistVersion.create({
        data: { versionLabel: label, weightVersion: source.weightVersion, status: "DRAFT", isActive: false },
      });

      const categories = source.categories.map((cat) => ({ ...cat, newId: randomUUID() }));

      await tx.checklistCategory.createMany({
        data: categories.map((cat) => ({
          id: cat.newId, checklistVersionId: v.id, code: cat.code, label: cat.label,
          labelFil: cat.labelFil, weight: cat.weight, sortOrder: cat.sortOrder,
        })),
      });

      await tx.checklistPoint.createMany({
        data: categories.flatMap((cat) =>
          cat.points.map((p) => ({
            categoryId: cat.newId, code: p.code, label: p.label, labelFil: p.labelFil,
            weightInCategory: p.weightInCategory, isSafetyCritical: p.isSafetyCritical,
            inputType: p.inputType, unit: p.unit,
            thresholdDirection: p.thresholdDirection, thresholdGood: p.thresholdGood,
            thresholdMonitor: p.thresholdMonitor, thresholdAttention: p.thresholdAttention,
            recommendation: p.recommendation, templates: p.templates ?? undefined,
            requiresPhotoOnAdverse: p.requiresPhotoOnAdverse, notApplicableWhen: p.notApplicableWhen,
            sortOrder: p.sortOrder,
          })),
        ),
      });

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

      // Bulk for the same reason createDraft is: one create per row put ~62
      // sequential round trips inside the 5s interactive-transaction budget.
      const categories = dto.categories.map((cat, catOrder) => ({ ...cat, newId: randomUUID(), catOrder }));

      await tx.checklistCategory.createMany({
        data: categories.map((cat) => ({
          id: cat.newId, checklistVersionId: id, code: cat.code, label: cat.label,
          labelFil: cat.labelFil ?? null, weight: cat.weight, sortOrder: cat.catOrder,
        })),
      });

      await tx.checklistPoint.createMany({
        data: categories.flatMap((cat) =>
          cat.points.map((p, ptOrder) => ({
            categoryId: cat.newId, code: p.code, label: p.label, labelFil: p.labelFil ?? null,
            weightInCategory: p.weightInCategory, isSafetyCritical: p.isSafetyCritical,
            inputType: p.inputType, unit: p.unit ?? null,
            thresholdDirection: p.thresholds?.direction ?? null,
            thresholdGood: p.thresholds?.good ?? null,
            thresholdMonitor: p.thresholds?.monitor ?? null,
            thresholdAttention: p.thresholds?.attention ?? null,
            recommendation: p.recommendation, templates: p.templates ?? undefined,
            requiresPhotoOnAdverse: p.requiresPhotoOnAdverse,
            notApplicableWhen: p.notApplicableWhen ?? null,
            sortOrder: ptOrder,
          })),
        ),
      });
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
    const categoryCodes = new Set<string>();
    const pointCodes = new Set<string>();
    for (const c of v.categories) {
      if (categoryCodes.has(c.code)) problems.push(`category code ${c.code} is duplicated`);
      categoryCodes.add(c.code);
      const ptSum = c.points.reduce((s, p) => s + p.weightInCategory, 0);
      if (Math.abs(ptSum - 100) > 1e-9) problems.push(`category ${c.code} point weights sum to ${ptSum}, expected 100`);
      for (const p of c.points) {
        if (pointCodes.has(p.code)) problems.push(`check code ${p.code} is duplicated across the template`);
        pointCodes.add(p.code);
        if (p.inputType === "MEASURED" && (p.thresholdDirection == null || p.thresholdGood == null || p.thresholdMonitor == null || p.thresholdAttention == null)) {
          problems.push(`measured point ${p.code} is missing thresholds`);
        }
        if (p.inputType === "MEASURED" && !p.unit?.trim()) problems.push(`measured point ${p.code} is missing a unit`);
        if (p.inputType === "MEASURED" && p.thresholdDirection && p.thresholdGood != null && p.thresholdMonitor != null && p.thresholdAttention != null) {
          const ordered = p.thresholdDirection === "HIGHER_BETTER"
            ? p.thresholdGood >= p.thresholdMonitor && p.thresholdMonitor >= p.thresholdAttention
            : p.thresholdGood <= p.thresholdMonitor && p.thresholdMonitor <= p.thresholdAttention;
          if (!ordered) problems.push(`measured point ${p.code} thresholds are out of order for ${p.thresholdDirection}`);
        }
        if (!p.label || !p.labelFil) problems.push(`point ${p.code} is missing EN+FIL labels`);
        if (!p.recommendation) problems.push(`point ${p.code} is missing a recommendation`);
      }
    }
    if (problems.length > 0) {
      throw new DomainError("CHECKLIST_INVALID", "checklist failed publish validation", 409, { problems });
    }
  }

  private validateFullCoverage(candidate: LoadedChecklist, baseline: LoadedChecklist): void {
    const candidateByCategory = new Map(candidate.categories.map((category) => [category.code, new Set(category.points.map((point) => point.code))]));
    const missing: string[] = [];
    for (const category of baseline.categories) {
      const included = candidateByCategory.get(category.code);
      if (!included) {
        missing.push(category.code);
        continue;
      }
      for (const point of category.points) {
        if (!included.has(point.code)) missing.push(`${category.code}.${point.code}`);
      }
    }
    if (missing.length) {
      throw new DomainError("CHECKLIST_INVALID", "full template must retain every check in the current full baseline", 409, { missing });
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
