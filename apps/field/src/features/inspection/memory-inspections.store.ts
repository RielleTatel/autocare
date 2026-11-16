import type { LocalInspection, LocalResult } from "../../shared/db/inspections.repo";
import type { DraftInspectionsStore } from "./draft";

/** Jest-side DraftInspectionsStore mirroring the SQLite repo semantics. */
export class MemoryInspectionsStore implements DraftInspectionsStore {
  drafts = new Map<string, LocalInspection>();
  private resultRows = new Map<string, Map<string, LocalResult>>();

  async findByBooking(appointmentId: string): Promise<LocalInspection | null> {
    return [...this.drafts.values()].find((r) => r.appointmentId === appointmentId) ?? null;
  }

  async createDraft(d: Omit<LocalInspection, "status" | "submittedAt">): Promise<void> {
    if (d.appointmentId && await this.findByBooking(d.appointmentId)) return;
    this.drafts.set(d.clientUuid, { ...d, status: "DRAFT", submittedAt: null });
    this.resultRows.set(d.clientUuid, new Map());
  }

  async saveResult(inspectionClientUuid: string, r: LocalResult): Promise<void> {
    this.resultRows.get(inspectionClientUuid)?.set(r.pointCode, { ...r });
  }

  async results(inspectionClientUuid: string): Promise<LocalResult[]> {
    return [...(this.resultRows.get(inspectionClientUuid)?.values() ?? [])].map((r) => ({ ...r }));
  }

  async lock(clientUuid: string, submittedAt: number): Promise<void> {
    const d = this.drafts.get(clientUuid);
    if (d) {
      d.status = "LOCKED";
      d.submittedAt = submittedAt;
    }
  }
}
