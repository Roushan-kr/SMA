import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import { NotFoundError, BadRequestError, ForbiddenError, mapPrismaError } from "../lib/errors.js";
import { buildScopeFilter } from "../helper/service.helper.js";
import { DateTime } from "luxon";

// ── Types ────────────────────────────────────────────────────────────

export interface CreateRetentionPolicyInput {
  stateId?: string | undefined;
  boardId?: string | undefined;
  entityType: string;
  retentionDays: number;
}

export interface UpdateRetentionPolicyInput {
  entityType?: string | undefined;
  retentionDays?: number | undefined;
}

const VALID_ENTITY_TYPES = [
  "MeterReading",
  "AuditLog",
  "GeneratedReportFile",
  "CustomerQuery",
] as const;

export type RetentionEntityType = (typeof VALID_ENTITY_TYPES)[number];

export function isValidEntityType(value: string): value is RetentionEntityType {
  return VALID_ENTITY_TYPES.includes(value as RetentionEntityType);
}

// ── Scope Helper ─────────────────────────────────────────────────────

function buildRetentionScopeFilter(authUser: AuthUser) {
  if (authUser.role === "SUPER_ADMIN") return {};
  if (authUser.role === "STATE_ADMIN" && authUser.stateId) return { stateId: authUser.stateId };
  if (authUser.boardId) return { boardId: authUser.boardId };
  if (authUser.stateId) return { stateId: authUser.stateId };
  return {};
}

// ── Service ──────────────────────────────────────────────────────────

export class RetentionService {
  /**
   * Create a retention policy.
   * SUPER_ADMIN → global (no stateId/boardId).
   * STATE_ADMIN → scoped to their state.
   * BOARD_ADMIN → scoped to their board.
   */
  async createRetentionPolicy(input: CreateRetentionPolicyInput, authUser: AuthUser) {
    try {
      if (!isValidEntityType(input.entityType)) {
        throw new BadRequestError(
          `Invalid entityType '${input.entityType}'. Must be one of: ${VALID_ENTITY_TYPES.join(", ")}`,
        );
      }

      if (input.retentionDays < 1) {
        throw new BadRequestError("retentionDays must be at least 1");
      }

      // Scope enforcement
      let stateId: string | null = null;
      let boardId: string | null = null;

      if (authUser.role === "SUPER_ADMIN") {
        stateId = input.stateId ?? null;
        boardId = input.boardId ?? null;
      } else if (authUser.role === "STATE_ADMIN") {
        if (input.stateId && input.stateId !== authUser.stateId) {
          throw new ForbiddenError("You can only create policies for your own state");
        }
        stateId = authUser.stateId;
      } else if (authUser.role === "BOARD_ADMIN") {
        if (input.boardId && input.boardId !== authUser.boardId) {
          throw new ForbiddenError("You can only create policies for your own board");
        }
        boardId = authUser.boardId;
        stateId = authUser.stateId;
      } else {
        throw new ForbiddenError("You do not have permission to create retention policies");
      }

      // Validate references
      if (stateId) {
        const state = await prisma.state.findUnique({ where: { id: stateId }, select: { id: true } });
        if (!state) throw new NotFoundError("State", stateId);
      }
      if (boardId) {
        const board = await prisma.electricityBoard.findUnique({ where: { id: boardId }, select: { id: true } });
        if (!board) throw new NotFoundError("ElectricityBoard", boardId);
      }

      const policy = await prisma.dataRetentionPolicy.create({
        data: {
          stateId,
          boardId,
          entityType: input.entityType,
          retentionDays: input.retentionDays,
        },
      });

      return policy;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * List retention policies (scope-filtered).
   */
  async listPolicies(authUser: AuthUser) {
    try {
      const scopeFilter = buildRetentionScopeFilter(authUser);

      const policies = await prisma.dataRetentionPolicy.findMany({
        where: { ...scopeFilter },
        orderBy: { createdAt: "desc" },
      });

      return policies;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Update a retention policy (scope-enforced).
   */
  async updatePolicy(id: string, input: UpdateRetentionPolicyInput, authUser: AuthUser) {
    try {
      const policy = await this.findPolicyOrThrow(id, authUser);

      if (input.entityType && !isValidEntityType(input.entityType)) {
        throw new BadRequestError(
          `Invalid entityType '${input.entityType}'. Must be one of: ${VALID_ENTITY_TYPES.join(", ")}`,
        );
      }

      if (input.retentionDays !== undefined && input.retentionDays < 1) {
        throw new BadRequestError("retentionDays must be at least 1");
      }

      const updated = await prisma.dataRetentionPolicy.update({
        where: { id: policy.id },
        data: {
          ...(input.entityType && { entityType: input.entityType }),
          ...(input.retentionDays !== undefined && { retentionDays: input.retentionDays }),
        },
      });

      return updated;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Delete a retention policy (scope-enforced).
   */
  async deletePolicy(id: string, authUser: AuthUser) {
    try {
      const policy = await this.findPolicyOrThrow(id, authUser);

      await prisma.dataRetentionPolicy.delete({ where: { id: policy.id } });

      return { deleted: true, id: policy.id };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  Retention Cleanup (reusable by cron)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Run retention cleanup across all active policies.
   * Deletes records older than retentionDays for each entity type.
   *
   * Returns a summary of deleted counts per entity type.
   */
  async runRetentionCleanup() {
    const policies = await prisma.dataRetentionPolicy.findMany();

    const results: Array<{
      policyId: string;
      entityType: string;
      retentionDays: number;
      cutoffDate: string;
      deletedCount: number;
    }> = [];

    for (const policy of policies) {
      const cutoff = DateTime.now()
        .minus({ days: policy.retentionDays })
        .toJSDate();

      const cutoffISO = DateTime.fromJSDate(cutoff).toFormat("yyyy-MM-dd HH:mm:ss");

      let deletedCount = 0;

      try {
        deletedCount = await this.deleteOldRecords(
          policy.entityType as RetentionEntityType,
          cutoff,
          policy.stateId,
          policy.boardId,
        );
      } catch (error) {
        console.error(
          `[RetentionCleanup] Failed for policy ${policy.id} (${policy.entityType}):`,
          error,
        );
      }

      results.push({
        policyId: policy.id,
        entityType: policy.entityType,
        retentionDays: policy.retentionDays,
        cutoffDate: cutoffISO,
        deletedCount,
      });
    }

    return { executedAt: DateTime.now().toFormat("yyyy-MM-dd HH:mm:ss"), results };
  }

  // ── Private Helpers ─────────────────────────────────────────────

  private async findPolicyOrThrow(id: string, authUser: AuthUser) {
    const scopeFilter = buildRetentionScopeFilter(authUser);

    const policy = await prisma.dataRetentionPolicy.findFirst({
      where: { id, ...scopeFilter },
    });

    if (!policy) {
      throw new NotFoundError("DataRetentionPolicy", id);
    }

    return policy;
  }

  /**
   * Delete records older than `cutoff` for a specific entity type,
   * optionally scoped to a state or board.
   */
  private async deleteOldRecords(
    entityType: RetentionEntityType,
    cutoff: Date,
    stateId: string | null,
    boardId: string | null,
  ): Promise<number> {
    switch (entityType) {
      case "MeterReading": {
        // MeterReading → SmartMeter → Consumer → board/state
        const where: Record<string, unknown> = { timestamp: { lt: cutoff } };
        if (boardId) where["meter"] = { consumer: { boardId } };
        else if (stateId) where["meter"] = { consumer: { stateId } };

        const result = await prisma.meterReading.deleteMany({ where });
        return result.count;
      }

      case "AuditLog": {
        // AuditLog → User → board/state
        const where: Record<string, unknown> = { createdAt: { lt: cutoff } };
        if (boardId) where["user"] = { boardId };
        else if (stateId) where["user"] = { stateId };

        const result = await prisma.auditLog.deleteMany({ where });
        return result.count;
      }

      case "GeneratedReportFile": {
        // GeneratedReportFile has boardId/stateId directly
        const where: Record<string, unknown> = { createdAt: { lt: cutoff } };
        if (boardId) where["boardId"] = boardId;
        else if (stateId) where["stateId"] = stateId;

        const result = await prisma.generatedReportFile.deleteMany({ where });
        return result.count;
      }

      case "CustomerQuery": {
        // CustomerQuery → Consumer → board/state
        const where: Record<string, unknown> = { createdAt: { lt: cutoff } };
        if (boardId) where["consumer"] = { boardId };
        else if (stateId) where["consumer"] = { stateId };

        const result = await prisma.customerQuery.deleteMany({ where });
        return result.count;
      }

      default:
        return 0;
    }
  }
}

export const retentionService = new RetentionService();
