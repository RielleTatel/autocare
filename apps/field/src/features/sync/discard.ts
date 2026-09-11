import { InspectionsRepo } from "../../shared/db/inspections.repo";
import { outbox, syncProcessor } from "../../shared/sync";
import { deletePhotosFor } from "../../shared/sync/photos";
import type { OutboxEntry } from "../../shared/sync/types";

const inspections = new InspectionsRepo();

/**
 * Permanently remove a server-rejected entry and everything tied to it.
 *
 * A rejection is terminal on the client — nothing moves REJECTED back to
 * PENDING, and "Retry now" only drains PENDING rows — so before this existed
 * the only way out of a rejected item was clearing app data. Retrying is not a
 * meaningful alternative either: the payload is frozen at enqueue time, so an
 * entry rejected for bad content will be rejected identically forever.
 *
 * Removes, in order: the outbox entry plus its dependents (an inspection
 * `submit` cannot apply once its `create` is gone), then each removed record's
 * queued photos and local draft rows.
 */
export async function discardRejected(entry: OutboxEntry): Promise<void> {
  const removed = await outbox.discard(entry.clientUuid);
  for (const clientUuid of removed) {
    await deletePhotosFor(clientUuid);
    if (entry.entityType === "inspection") await inspections.delete(clientUuid);
  }
  await syncProcessor.refreshStatus();
}
