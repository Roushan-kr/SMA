import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import { Prisma } from "../generated/prisma/client.js";
import { NotFoundError, mapPrismaError } from "../lib/errors.js";
import { buildScopeFilter } from "../helper/service.helper.js";
import { Parser } from "json2csv";
import { DateTime } from "luxon";

// ── Types ────────────────────────────────────────────────────────────

export interface AuditLogFilters {
  action?: string | undefined;
  entity?: string | undefined;
  entityId?: string | undefined;
  userId?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

// ── Scope Helper ─────────────────────────────────────────────────────

/**
 * AuditLog is linked to User (who has stateId/boardId).
 * Wrap the base scope filter into the `user` relation path.
 */
function buildAuditScopeFilter(authUser: AuthUser) {
  const base = buildScopeFilter(authUser);
  if (Object.keys(base).length === 0) return {};
  return { user: base };
}

/**
 * Build common where clause from filters + scope.
 */
function buildWhereClause(
  filters: AuditLogFilters,
  authUser: AuthUser,
): Record<string, unknown> {
  const scopeFilter = buildAuditScopeFilter(authUser);
  const where: Record<string, unknown> = { ...scopeFilter };

  if (filters.action) where["action"] = filters.action;
  if (filters.entity) where["entity"] = filters.entity;
  if (filters.entityId) where["entityId"] = filters.entityId;
  if (filters.userId) where["userId"] = filters.userId;

  if (filters.startDate || filters.endDate) {
    const createdAt: Record<string, Date> = {};
    if (filters.startDate) createdAt["gte"] = new Date(filters.startDate);
    if (filters.endDate) createdAt["lte"] = new Date(filters.endDate);
    where["createdAt"] = createdAt;
  }

  return where;
}

// ── Service ──────────────────────────────────────────────────────────

export class AuditService {
  /**
   * Log an action. Designed to be called from ANY module.
   *
   * Usage:
   *   await auditService.logAction(user.id, "CREATE", "SmartMeter", meter.id, { meterNumber });
   */
  async logAction(
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ) {
    try {
      const log = await prisma.auditLog.create({
        data: {
          userId,
          action,
          entity,
          entityId,
          metadata: metadata
            ? (metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });

      return log;
    } catch (error) {
      // Audit logging should not break the caller — log and swallow
      console.error("[AuditService] Failed to log action:", error);
      return null;
    }
  }

  /**
   * List audit logs with pagination, filters, and admin scope enforcement.
   */
  async listAuditLogs(authUser: AuthUser, filters: AuditLogFilters) {
    try {
      const where = buildWhereClause(filters, authUser);
      const page = filters.page ?? 1;
      const limit = Math.min(filters.limit ?? 20, 100);
      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: { user: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.auditLog.count({ where }),
      ]);

      return {
        data: logs,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Get a single audit log by ID (scope-enforced).
   */
  async getAuditLogById(id: string, authUser: AuthUser) {
    try {
      const scopeFilter = buildAuditScopeFilter(authUser);

      const log = await prisma.auditLog.findFirst({
        where: { id, ...scopeFilter },
        include: { user: { select: { id: true, name: true, role: true } } },
      });

      if (!log) {
        throw new NotFoundError("AuditLog", id);
      }

      return log;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Export audit logs as CSV buffer using json2csv + luxon.
   */
  async exportAuditLogsCSV(authUser: AuthUser, filters: AuditLogFilters) {
    try {
      const where = buildWhereClause(filters, authUser);

      const logs = await prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" },
        take: 5000, // cap export size
      });

      const rows = logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        userName: log.user.name,
        userRole: log.user.role,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        metadata: log.metadata ? JSON.stringify(log.metadata) : "",
        createdAt: DateTime.fromJSDate(log.createdAt).toFormat("yyyy-MM-dd HH:mm:ss"),
      }));

      if (rows.length === 0) {
        return Buffer.from("id,userId,userName,userRole,action,entity,entityId,metadata,createdAt\n", "utf-8");
      }

      const parser = new Parser({
        fields: [
          "id",
          "userId",
          "userName",
          "userRole",
          "action",
          "entity",
          "entityId",
          "metadata",
          "createdAt",
        ],
      });

      const csv = parser.parse(rows);
      return Buffer.from(csv, "utf-8");
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}

export const auditService = new AuditService();
