import { prisma } from "../lib/prisma.js";
import type { AuthUser, AuthConsumer } from "../middleware/auth.js";
import type { QueryStatus } from "../generated/prisma/client.js";
import { NotFoundError, BadRequestError, ForbiddenError, mapPrismaError } from "../lib/errors.js";
import { buildScopeFilter } from "../helper/service.helper.js";

// ── Types ────────────────────────────────────────────────────────────

export interface CreateQueryInput {
  queryText: string;
}

export interface ListQueriesFilter {
  consumerId?: string | undefined;
  status?: QueryStatus | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

const VALID_STATUSES: QueryStatus[] = ["PENDING", "AI_REVIEWED", "RESOLVED", "REJECTED"];

export function isValidQueryStatus(value: string): value is QueryStatus {
  return VALID_STATUSES.includes(value as QueryStatus);
}

// ── Scope Helper ─────────────────────────────────────────────────────

/**
 * Queries are scoped via Consumer → State/Board.
 * Wrap the base scope filter into the `consumer` relation path.
 */
function buildQueryScopeFilter(user: AuthUser) {
  const base = buildScopeFilter(user);
  if (Object.keys(base).length === 0) return {};
  return { consumer: base };
}

// ── Service ──────────────────────────────────────────────────────────

export class QueryService {
  /**
   * Create a new customer query (consumer-initiated).
   */
  async createQuery(consumerId: string, input: CreateQueryInput) {
    try {
      const consumer = await prisma.consumer.findUnique({
        where: { id: consumerId },
        select: { id: true },
      });

      if (!consumer) {
        throw new NotFoundError("Consumer", consumerId);
      }

      const query = await prisma.customerQuery.create({
        data: {
          consumerId,
          queryText: input.queryText,
          status: "PENDING",
        },
        include: { consumer: true },
      });

      return query;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * List queries with pagination and admin scope filtering.
   */
  async listQueries(filters: ListQueriesFilter, user: AuthUser) {
    try {
      const scopeFilter = buildQueryScopeFilter(user);
      const page = filters.page ?? 1;
      const limit = Math.min(filters.limit ?? 20, 100);
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = { ...scopeFilter };

      if (filters.consumerId) where["consumerId"] = filters.consumerId;
      if (filters.status) where["status"] = filters.status;

      const [queries, total] = await Promise.all([
        prisma.customerQuery.findMany({
          where,
          include: { consumer: true },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.customerQuery.count({ where }),
      ]);

      return {
        data: queries,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * List queries for a specific consumer (consumer self-service).
   */
  async listMyQueries(consumerId: string, page: number, limit: number) {
    try {
      const take = Math.min(limit, 100);
      const skip = (page - 1) * take;

      const [queries, total] = await Promise.all([
        prisma.customerQuery.findMany({
          where: { consumerId },
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
        prisma.customerQuery.count({ where: { consumerId } }),
      ]);

      return {
        data: queries,
        pagination: { page, limit: take, total, totalPages: Math.ceil(total / take) },
      };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Get a single query by ID.
   * Supports both admin (scope-checked) and consumer (own-only) access.
   */
  async getQueryById(queryId: string, caller: AuthUser | AuthConsumer) {
    try {
      const query = await prisma.customerQuery.findUnique({
        where: { id: queryId },
        include: { consumer: true },
      });

      if (!query) {
        throw new NotFoundError("CustomerQuery", queryId);
      }

      this.assertAccess(query.consumerId, caller);

      return query;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Update query status (admin only).
   */
  async updateQueryStatus(queryId: string, status: QueryStatus, user: AuthUser) {
    try {
      const query = await this.findQueryOrThrow(queryId, user);

      const updated = await prisma.customerQuery.update({
        where: { id: query.id },
        data: { status },
        include: { consumer: true },
      });

      return updated;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Reply to a customer query (admin / support agent).
   * Sets status to RESOLVED and records the reviewer.
   */
  async replyToQuery(queryId: string, reply: string, user: AuthUser) {
    try {
      const query = await this.findQueryOrThrow(queryId, user);

      if (query.status === "RESOLVED") {
        throw new BadRequestError("Query has already been resolved");
      }

      const updated = await prisma.customerQuery.update({
        where: { id: query.id },
        data: {
          adminReply: reply,
          reviewedBy: user.id,
          status: "RESOLVED",
        },
        include: { consumer: true },
      });

      return updated;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── AI Agent Methods ────────────────────────────────────────────

  /**
   * Fetch PENDING queries for AI processing.
   * Scoped by authUser's state/board. Returns oldest-first (FIFO).
   */
  async fetchPendingForAi(authUser: AuthUser, limit: number = 10) {
    try {
      const scopeFilter = buildQueryScopeFilter(authUser);

      const queries = await prisma.customerQuery.findMany({
        where: { status: "PENDING", ...scopeFilter },
        include: { consumer: { select: { id: true, name: true, stateId: true, boardId: true } } },
        orderBy: { createdAt: "asc" },
        take: Math.min(limit, 50),
      });

      return queries;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * AI classifies a query: sets aiCategory, aiConfidence, and
   * transitions status from PENDING → AI_REVIEWED.
   *
   * Does NOT resolve — a human SUPPORT_AGENT reviews the AI
   * classification and then replies/resolves.
   */
  async classifyQueryWithAi(
    queryId: string,
    category: string,
    confidence: number,
    authUser: AuthUser,
  ) {
    try {
      if (confidence < 0 || confidence > 1) {
        throw new BadRequestError("aiConfidence must be between 0.0 and 1.0");
      }

      const query = await this.findQueryOrThrow(queryId, authUser);

      if (query.status !== "PENDING") {
        throw new BadRequestError(
          `Query is '${query.status}', only PENDING queries can be classified`,
        );
      }

      const updated = await prisma.customerQuery.update({
        where: { id: query.id },
        data: {
          aiCategory: category,
          aiConfidence: confidence,
          status: "AI_REVIEWED",
        },
        include: { consumer: true },
      });

      return updated;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * AI auto-resolves a high-confidence query in one step:
   * classifies + replies + sets status to RESOLVED.
   *
   * Sets reviewedBy = "AI_AGENT" to distinguish from human-resolved.
   */
  async autoResolveQueryWithAi(
    queryId: string,
    category: string,
    confidence: number,
    resolutionText: string,
    authUser: AuthUser,
  ) {
    try {
      if (confidence < 0 || confidence > 1) {
        throw new BadRequestError("aiConfidence must be between 0.0 and 1.0");
      }

      const query = await this.findQueryOrThrow(queryId, authUser);

      if (query.status !== "PENDING") {
        throw new BadRequestError(
          `Query is '${query.status}', only PENDING queries can be auto-resolved`,
        );
      }

      const updated = await prisma.customerQuery.update({
        where: { id: query.id },
        data: {
          aiCategory: category,
          aiConfidence: confidence,
          adminReply: resolutionText,
          reviewedBy: "AI_AGENT",
          status: "RESOLVED",
        },
        include: { consumer: true },
      });

      return updated;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Get AI processing stats: counts by status, avg confidence, etc.
   * Useful for dashboards and monitoring AI agent performance.
   */
  async getAiStats() {
    try {
      const [pending, aiReviewed, resolved, rejected, avgConfidence] = await Promise.all([
        prisma.customerQuery.count({ where: { status: "PENDING" } }),
        prisma.customerQuery.count({ where: { status: "AI_REVIEWED" } }),
        prisma.customerQuery.count({ where: { status: "RESOLVED" } }),
        prisma.customerQuery.count({ where: { status: "REJECTED" } }),
        prisma.customerQuery.aggregate({
          _avg: { aiConfidence: true },
          where: { aiConfidence: { not: null } },
        }),
      ]);

      const aiResolved = await prisma.customerQuery.count({
        where: { status: "RESOLVED", reviewedBy: "AI_AGENT" },
      });

      return {
        counts: { pending, aiReviewed, resolved, rejected },
        aiResolved,
        humanResolved: resolved - aiResolved,
        avgAiConfidence: avgConfidence._avg.aiConfidence
          ? Math.round(avgConfidence._avg.aiConfidence * 1000) / 1000
          : null,
      };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Delete a customer query (admin only).
   */
  async deleteQuery(queryId: string, user: AuthUser) {
    try {
      const query = await this.findQueryOrThrow(queryId, user);

      await prisma.customerQuery.delete({ where: { id: query.id } });

      return { deleted: true, id: query.id };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── Private Helpers ─────────────────────────────────────────────

  /**
   * Find a query by ID with admin scope enforcement.
   */
  private async findQueryOrThrow(queryId: string, user: AuthUser) {
    const scopeFilter = buildQueryScopeFilter(user);

    const query = await prisma.customerQuery.findFirst({
      where: { id: queryId, ...scopeFilter },
      include: { consumer: true },
    });

    if (!query) {
      throw new NotFoundError("CustomerQuery", queryId);
    }

    return query;
  }

  /**
   * Assert access: consumer can only view own queries; admin uses scope.
   */
  private assertAccess(consumerId: string, caller: AuthUser | AuthConsumer): void {
    // Consumer self-access
    if ("stateId" in caller && !("role" in caller)) {
      if (caller.id !== consumerId) {
        throw new ForbiddenError("You can only access your own queries");
      }
      return;
    }

    // Admin — scope enforced at query level
    const adminUser = caller as AuthUser;
    if (adminUser.role === "SUPER_ADMIN") return;
    if (adminUser.role === "STATE_ADMIN" && adminUser.stateId) return;
    if (adminUser.role === "BOARD_ADMIN" && adminUser.boardId) return;
    if (adminUser.boardId || adminUser.stateId) return;
  }
}

export const queryService = new QueryService();
