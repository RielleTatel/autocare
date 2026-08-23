import { z } from "zod";

export const certificateVisibilitySchema = z.enum(["PRIVATE", "LINK", "REVOKED"]);
export type CertificateVisibilityInput = z.infer<typeof certificateVisibilitySchema>;

export const createCertificateSchema = z.object({
  healthScoreId: z.string().uuid().optional(),
});
export type CreateCertificateInput = z.infer<typeof createCertificateSchema>;

export const setVisibilitySchema = z.object({
  visibility: certificateVisibilitySchema,
});
export type SetVisibilityInput = z.infer<typeof setVisibilitySchema>;

export const verifyCertificateSchema = z.object({
  code: z.string().min(4).max(16),
});
export type VerifyCertificateInput = z.infer<typeof verifyCertificateSchema>;

/** Redacted public payload — never carries member contact data (FR-065, NFR-022). */
export interface PublicCertificate {
  score: number;
  band: string;
  confidence: string;
  overrideApplied: string;
  isStale: boolean;
  daysSinceInspection: number;
  inspectionDate: string;
  odometerKm: number | null;
  plateNo: string;
  verificationCode: string;
  validUntil: string;
  categoryScores: Array<{ categoryCode: string; label: string; score: number; weight: number }>;
  serviceSummary: { count: number; recent: Array<{ type: string; date: string }> };
}
