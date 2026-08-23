import { randomBytes } from "crypto";
import { Injectable } from "@nestjs/common";
import type { CertificateVisibilityInput, PublicCertificate } from "@autocare/contracts";
import { DomainError } from "../../common/errors/domain-error";
import { PrismaService } from "../prisma/prisma.service";
import { AbilityUser } from "../../common/policies/ability.factory";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // no I L O U
const VALIDITY_DAYS = 90;

function crockford(len: number): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += CROCKFORD[bytes[i] % 32];
  return out;
}

@Injectable()
export class CertificatesService {
  constructor(private prisma: PrismaService) {}

  private async assertOwnsVehicle(u: AbilityUser, vehicleId: string): Promise<void> {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new DomainError("CERTIFICATE_NOT_FOUND", "vehicle not found", 404);
    const owns = vehicle.ownerUserId === u.id || (u.orgId != null && vehicle.orgOwnerId === u.orgId);
    if (!owns) throw new DomainError("FORBIDDEN_ROLE", "not your vehicle", 403);
  }

  /** Mint an unguessable token + unique verification code for a vehicle's
   *  latest (or specified) score. Starts PRIVATE. */
  async create(u: AbilityUser, vehicleId: string, healthScoreId?: string) {
    await this.assertOwnsVehicle(u, vehicleId);
    const score = healthScoreId
      ? await this.prisma.healthScore.findFirst({ where: { id: healthScoreId, vehicleId } })
      : await this.prisma.healthScore.findFirst({ where: { vehicleId }, orderBy: { computedAt: "desc" } });
    if (!score) throw new DomainError("INSPECTION_INCOMPLETE", "no score to certify", 404);

    const publicToken = randomBytes(32).toString("base64url"); // ~256 bits
    let verificationCode = crockford(8);
    // ensure uniqueness (collision astronomically unlikely, but the column is unique)
    for (let i = 0; i < 5; i++) {
      const clash = await this.prisma.certificate.findUnique({ where: { verificationCode } });
      if (!clash) break;
      verificationCode = crockford(8);
    }

    const cert = await this.prisma.certificate.create({
      data: { vehicleId, healthScoreId: score.id, publicToken, verificationCode, visibility: "PRIVATE" },
    });
    return { id: cert.id, publicToken, verificationCode, url: `/c/${publicToken}` };
  }

  async setVisibility(u: AbilityUser, certId: string, visibility: CertificateVisibilityInput) {
    const cert = await this.prisma.certificate.findUnique({ where: { id: certId } });
    if (!cert) throw new DomainError("CERTIFICATE_NOT_FOUND", "certificate not found", 404);
    await this.assertOwnsVehicle(u, cert.vehicleId);
    return this.prisma.certificate.update({
      where: { id: certId },
      data: { visibility, revokedAt: visibility === "REVOKED" ? new Date() : null },
    });
  }

  /** Public, redacted read by token. Throws 404 for PRIVATE/unknown, 410 for REVOKED. */
  async publicByToken(token: string): Promise<PublicCertificate> {
    const cert = await this.prisma.certificate.findUnique({ where: { publicToken: token } });
    if (!cert || cert.visibility === "PRIVATE") throw new DomainError("CERTIFICATE_NOT_FOUND", "certificate not found", 404);
    if (cert.visibility === "REVOKED") throw new DomainError("CERTIFICATE_REVOKED", "this certificate has been revoked", 410);
    return this.redactedPayload(cert.healthScoreId, cert.verificationCode);
  }

  async verifyByCode(code: string): Promise<PublicCertificate> {
    const cert = await this.prisma.certificate.findUnique({ where: { verificationCode: code.toUpperCase() } });
    if (!cert || cert.visibility === "PRIVATE") throw new DomainError("CERTIFICATE_NOT_FOUND", "certificate not found", 404);
    if (cert.visibility === "REVOKED") throw new DomainError("CERTIFICATE_REVOKED", "this certificate has been revoked", 410);
    return this.redactedPayload(cert.healthScoreId, cert.verificationCode);
  }

  private async redactedPayload(healthScoreId: string, verificationCode: string): Promise<PublicCertificate> {
    const score = await this.prisma.healthScore.findUniqueOrThrow({
      where: { id: healthScoreId },
      include: { categoryScores: { orderBy: { sortOrder: "asc" } }, inspection: true, vehicle: true },
    });
    const daysSinceInspection = Math.round((Date.now() - score.computedAt.getTime()) / 86_400_000);

    // Service history summary: last 3 COMPLETED appointments — count + type + date, NO prices.
    const appts = await this.prisma.appointment.findMany({
      where: { vehicleId: score.vehicleId, status: "COMPLETED" },
      orderBy: { scheduledStart: "desc" },
      take: 3,
      include: { serviceType: true },
    });
    const totalServices = await this.prisma.appointment.count({ where: { vehicleId: score.vehicleId, status: "COMPLETED" } });

    return {
      score: score.score,
      band: score.band,
      confidence: score.confidence,
      overrideApplied: score.overrideApplied,
      isStale: score.isStale,
      daysSinceInspection,
      inspectionDate: (score.inspection.submittedAt ?? score.computedAt).toISOString(),
      odometerKm: score.inspection.odometerKm,
      plateNo: score.vehicle.plateNo, // vehicle identity, not personal data — the resale subject
      verificationCode,
      validUntil: new Date(score.computedAt.getTime() + VALIDITY_DAYS * 86_400_000).toISOString(),
      categoryScores: score.categoryScores.map((c) => ({ categoryCode: c.categoryCode, label: c.label, score: c.score, weight: c.weight })),
      serviceSummary: {
        count: totalServices,
        recent: appts.map((a) => ({ type: a.serviceType.name, date: a.scheduledStart.toISOString() })),
      },
    };
  }
}
