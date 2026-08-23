import { Injectable, Logger } from "@nestjs/common";

export interface ScoreReadyEvent {
  vehicleId: string;
  score: number;
  band: string;
}

/** In-process `score.ready` event port. A Socket.IO gateway can subscribe here
 *  when realtime transport lands; the member app currently refetches on focus. */
@Injectable()
export class ScoreEvents {
  private readonly logger = new Logger(ScoreEvents.name);
  private listeners = new Set<(e: ScoreReadyEvent) => void>();

  onScoreReady(cb: (e: ScoreReadyEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  emitScoreReady(e: ScoreReadyEvent): void {
    this.logger.log(`score.ready vehicle=${e.vehicleId} score=${e.score} band=${e.band}`);
    for (const cb of this.listeners) cb(e);
  }
}
