import type { LocalResult } from "../../shared/db/inspections.repo";
import type { DraftInspectionsStore } from "./draft";

/** Jest-side DraftInspectionsStore mirroring the SQLite repo semantics. */
export class MemoryInspectionsStore implements DraftInspectionsStore {
  drafts = new Map<string, { checklistVersionId: string; checklistJson: string; status: "DRAFT" | "LOCKED"; submittedAt: number | null }>();
  private resultRows = new Map<string, Map<string, LocalResult>>();

  async createDraft(d: { clientUuid: string; checklistVersionId: string; checklistJson: string }): Promise<void> {
    this.drafts.set(d.clientUuid, { checklistVersionId: d.checklistVersionId, checklistJson: d.checklistJson, status: "DRAFT", submittedAt: null });
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
