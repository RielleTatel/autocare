import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/** Score tables are append-only (NFR-054): corrections create new rows via
 *  supersedes; there is no UPDATE path. The one sanctioned mutation is the
 *  BR-05 staleness flag, which is display state, never arithmetic. */
const APPEND_ONLY_MODELS = new Set(["HealthScore", "CategoryScore", "Recommendation", "InspectionResult"]);
const HEALTH_SCORE_MUTABLE_FIELDS = new Set(["isStale"]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
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
}
