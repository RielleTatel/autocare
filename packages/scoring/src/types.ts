import type { DiagramZone } from "@autocare/contracts";

export type PointStatus = "GOOD" | "MONITOR" | "ATTENTION" | "CRITICAL" | "NOT_APPLICABLE";
export type Band = "EXCELLENT" | "GOOD" | "FAIR" | "NEEDS_ATTENTION" | "CRITICAL";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type Override = "NONE" | "SAFETY_CRITICAL" | "SAFETY_ATTENTION";

export interface Thresholds {
  direction: "HIGHER_BETTER" | "LOWER_BETTER";
  good: number;      // HIGHER_BETTER: value >= good → GOOD; LOWER_BETTER: value < good → GOOD
  monitor: number;   // next boundary, same orientation
  attention: number; // beyond attention (or >= for LOWER_BETTER) → CRITICAL
}

/** One plain-language sentence per adverse-capable status (FR-115 content source). */
export type StatusTemplates = Partial<Record<Exclude<PointStatus, "NOT_APPLICABLE">, string>>;

export interface ConfigPoint {
  code: string; label: string; weightInCategory: number;
  isSafetyCritical: boolean;
  inputType: "STATUS" | "MEASURED";
  unit?: string;
  thresholds?: Thresholds;           // required when inputType === "MEASURED"
  recommendation: string;            // shown when the point detracts
  labelFil?: string;
  templates?: StatusTemplates;
  requiresPhotoOnAdverse?: boolean;
  notApplicableWhen?: string;        // human note, e.g. "manual transmission"
  diagramZone?: DiagramZone;         // where this sits on the car (FR-116); omit when ambiguous
}
export interface ConfigCategory { code: string; label: string; weight: number; points: ConfigPoint[]; labelFil?: string }
export interface ChecklistConfig { checklistVersion: string; weightVersion: string; categories: ConfigCategory[] }

export interface ResultInput { pointCode: string; status?: PointStatus; measuredValue?: number }
export interface InspectionInput { results: ResultInput[]; daysSinceInspection: number }

export interface ScoreResult {
  score: number; rawScore: number; band: Band; confidence: Confidence; stars: 1 | 2 | 3 | 4 | 5;
  categoryScores: Array<{ categoryCode: string; label: string; weight: number; score: number; applicablePoints: number; stars: 1 | 2 | 3 | 4 | 5 }>;
  overrideApplied: Override;
  topDetractors: Array<{ pointCode: string; label: string; status: PointStatus; scoreImpact: number; recommendation: string }>;
  checklistVersion: string; weightVersion: string;
}
