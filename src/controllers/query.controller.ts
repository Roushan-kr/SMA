import type { Request, Response, NextFunction } from "express";
import { queryService, isValidQueryStatus } from "../services/query.service.js";
import { sendSuccess } from "../lib/apiResponse.js";
import { BadRequestError } from "../lib/errors.js";
import { requireBody, requireParam } from "../helper/controller.helper.js";
import type { QueryStatus } from "../generated/prisma/client.js";

// ── Controller ───────────────────────────────────────────────────────

export class QueryController {
  // ── Consumer Self-Service ───────────────────────────────────────

  /**
   * POST /
   * Create a new query (consumer-initiated).
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireBody(req.body, "queryText");

      const { queryText } = req.body as { queryText: string };

      const query = await queryService.createQuery(req.appConsumer!.id, { queryText });

      sendSuccess(res, query, "Query submitted successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /me
   * List the authenticated consumer's own queries.
   */
  async listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = req.query as { page?: string; limit?: string };

      const result = await queryService.listMyQueries(
        req.appConsumer!.id,
        page ? parseInt(page, 10) : 1,
        limit ? parseInt(limit, 10) : 20,
      );

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // ── Shared (consumer + admin) ───────────────────────────────────

  /**
   * GET /:id
   * Get a single query by ID (consumer sees own, admin scope-checked).
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");

      const caller = req.appConsumer ?? req.appUser!;

      const query = await queryService.getQueryById(id, caller);

      sendSuccess(res, query);
    } catch (error) {
      next(error);
    }
  }

  // ── Admin Operations ────────────────────────────────────────────

  /**
   * GET /
   * List all queries with pagination and filters (admin only).
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { consumerId, status, page, limit } = req.query as {
        consumerId?: string;
        status?: string;
        page?: string;
        limit?: string;
      };

      if (status && !isValidQueryStatus(status)) {
        throw new BadRequestError(
          `Invalid status '${status}'. Must be one of: PENDING, AI_REVIEWED, RESOLVED, REJECTED`,
        );
      }

      const result = await queryService.listQueries(
        {
          consumerId,
          status: status as QueryStatus | undefined,
          page: page ? parseInt(page, 10) : undefined,
          limit: limit ? parseInt(limit, 10) : undefined,
        },
        req.appUser!,
      );

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /:id/status
   * Update query status (admin only).
   */
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");
      requireBody(req.body, "status");

      const { status } = req.body as { status: string };

      if (!isValidQueryStatus(status)) {
        throw new BadRequestError(
          `Invalid status '${status}'. Must be one of: PENDING, AI_REVIEWED, RESOLVED, REJECTED`,
        );
      }

      const updated = await queryService.updateQueryStatus(
        id,
        status as QueryStatus,
        req.appUser!,
      );

      sendSuccess(res, updated, "Query status updated successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /:id/reply
   * Reply to a customer query (admin only). Auto-resolves the query.
   */
  async reply(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");
      requireBody(req.body, "reply");

      const { reply } = req.body as { reply: string };

      const updated = await queryService.replyToQuery(id, reply, req.appUser!);

      sendSuccess(res, updated, "Reply sent successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /:id
   * Delete a customer query (admin only).
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");

      const result = await queryService.deleteQuery(id, req.appUser!);

      sendSuccess(res, result, "Query deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  // ── AI Agent Operations ─────────────────────────────────────────

  /**
   * GET /ai/pending
   * Fetch PENDING queries for AI agent processing (scope-enforced).
   */
  async fetchPendingForAi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit } = req.query as { limit?: string };

      const queries = await queryService.fetchPendingForAi(
        req.appUser!,
        limit ? parseInt(limit, 10) : 10,
      );

      sendSuccess(res, queries);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /:id/ai-classify
   * AI agent classifies a query (PENDING → AI_REVIEWED).
   */
  async classifyQueryWithAi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");
      requireBody(req.body, "aiCategory", "aiConfidence");

      const { aiCategory, aiConfidence } = req.body as {
        aiCategory: string;
        aiConfidence: number;
      };

      const updated = await queryService.classifyQueryWithAi(
        id,
        aiCategory,
        aiConfidence,
        req.appUser!,
      );

      sendSuccess(res, updated, "Query classified by AI");
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /:id/ai-resolve
   * AI agent auto-resolves a high-confidence query.
   */
  async autoResolveQueryWithAi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");
      requireBody(req.body, "aiCategory", "aiConfidence", "resolutionText");

      const { aiCategory, aiConfidence, resolutionText } = req.body as {
        aiCategory: string;
        aiConfidence: number;
        resolutionText: string;
      };

      const updated = await queryService.autoResolveQueryWithAi(
        id,
        aiCategory,
        aiConfidence,
        resolutionText,
        req.appUser!,
      );

      sendSuccess(res, updated, "Query auto-resolved by AI");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /ai/stats
   * Get AI processing stats (counts, avg confidence, AI vs human resolved).
   */
  async aiStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await queryService.getAiStats();

      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
}

export const queryController = new QueryController();
