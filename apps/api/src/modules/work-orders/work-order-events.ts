import { Injectable, Logger } from "@nestjs/common";

/** In-process event port for work-order + attention realtime signals. A
 *  Socket.IO gateway can subscribe here later; consumers today refetch on focus. */
@Injectable()
export class WorkOrderEvents {
  private readonly logger = new Logger(WorkOrderEvents.name);
  private changed = new Set<(vehicleId: string) => void>();
  private approval = new Set<(e: { vehicleId: string; workOrderId: string }) => void>();
  private attention = new Set<(memberId: string) => void>();

  onChanged(cb: (vehicleId: string) => void): () => void { this.changed.add(cb); return () => this.changed.delete(cb); }
  onApprovalRequired(cb: (e: { vehicleId: string; workOrderId: string }) => void): () => void { this.approval.add(cb); return () => this.approval.delete(cb); }
  onAttentionChanged(cb: (memberId: string) => void): () => void { this.attention.add(cb); return () => this.attention.delete(cb); }

  emitChanged(vehicleId: string): void { for (const cb of this.changed) cb(vehicleId); }
  emitApprovalRequired(vehicleId: string, workOrderId: string): void {
    this.logger.log(`workorder.approval_required wo=${workOrderId}`);
    for (const cb of this.approval) cb({ vehicleId, workOrderId });
  }
  emitAttentionChanged(memberId?: string): void {
    if (!memberId) return;
    for (const cb of this.attention) cb(memberId);
  }
}
