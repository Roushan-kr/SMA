import type { Request, Response, NextFunction } from "express";
import { auditService } from "../services/audit.service.js";
import { sendSuccess } from "../lib/apiResponse.js";
import { requireParam } from "../helper/controller.helper.js";

// ── Controller ───────────────────────────────────────────────────────

export class AuditController {
  /**
   * GET /
   * List audit logs (paginated, filtered, scope-enforced).
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { action, entity, entityId, userId, startDate, endDate, page, limit } =
        req.query as {
          action?: string;
          entity?: string;
          entityId?: string;
          userId?: string;
          startDate?: string;
          endDate?: string;
          page?: string;
          limit?: string;
        };

      const result = await auditService.listAuditLogs(req.appUser!, {
        action,
        entity,
        entityId,
        userId,
        startDate,
        endDate,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /export/csv
   * Export audit logs as CSV download.
   */
  async exportCSV(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { action, entity, entityId, userId, startDate, endDate } = req.query as {
        action?: string;
        entity?: string;
        entityId?: string;
        userId?: string;
        startDate?: string;
        endDate?: string;
      };

      const csvBuffer = await auditService.exportAuditLogsCSV(req.appUser!, {
        action,
        entity,
        entityId,
        userId,
        startDate,
        endDate,
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=audit_logs.csv");
      res.send(csvBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /:id
   * Get a single audit log by ID (scope-enforced).
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");

      const log = await auditService.getAuditLogById(id, req.appUser!);

      sendSuccess(res, log);
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
