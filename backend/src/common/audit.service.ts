import { Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async record(input: {
    action: string;
    request: FastifyRequest & { requestId?: string };
    actorId?: string | null;
    schoolId?: string | null;
    targetType?: string;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const ipHash = createHash("sha256").update(input.request.ip).digest("hex");
    await this.db.insertInto("audit_events").values({
      action: input.action,
      actor_id: input.actorId ?? null,
      school_id: input.schoolId ?? null,
      target_type: input.targetType ?? "",
      target_id: input.targetId ?? null,
      request_id: input.request.requestId ?? randomUUID(),
      ip_hash: ipHash,
      metadata: input.metadata ?? {},
    }).execute();
  }
}
