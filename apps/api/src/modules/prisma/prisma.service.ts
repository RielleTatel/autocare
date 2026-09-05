import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/** Score tables are append-only (NFR-054): corrections create new rows via
 *  supersedes; there is no UPDATE path. The one sanctioned mutation is the
 *  BR-05 staleness flag, which is display state, never arithmetic.
 *  NOTE: Recommendation is deliberately NOT here — NFR-054 names only the
 *  inspection/score tables, and recommendations carry a Phase-5 lifecycle
 *  (OPEN→QUOTED→APPROVED/DECLINED/DEFERRED→RESOLVED, resurfacedCount). */
const APPEND_ONLY_MODELS = new Set(["HealthScore", "CategoryScore", "InspectionResult"]);
const HEALTH_SCORE_MUTABLE_FIELDS = new Set(["isStale"]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    this.$use(async (params, next) => {
      if (params.model && APPEND_ONLY_MODELS.has(params.model) && (params.action === "update" || params.action === "updateMany")) {
        const fields = Object.keys((params.args?.data ?? {}) as Record<string, unknown>);
        const allowed = params.model === "HealthScore" && fields.every((f) => HEALTH_SCORE_MUTABLE_FIELDS.has(f));
        if (!allowed) {
          throw new Error(`${params.model} is append-only (NFR-054): no update path exists`);
        }
      }
      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Release the connection pool when the module is torn down. Without this,
   * `app.close()` in an e2e spec's afterAll left the pool open: 28 app-booting
   * specs exhausted the hosted Postgres connection limit ("remaining connection
   * slots are reserved"), and the leaked handles stopped jest from exiting.
   * It matters in production too — a shutting-down app should close cleanly.
   */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
