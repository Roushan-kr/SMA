import type { Request, Response, NextFunction } from "express";
import {
  retentionService,
  isValidEntityType,
} from "../services/retention.service.js";
import { sendSuccess } from "../lib/apiResponse.js";
import { BadRequestError } from "../lib/errors.js";
import { requireBody, requireParam } from "../helper/controller.helper.js";

// ── Controller ───────────────────────────────────────────────────────

export class RetentionController {
  /**
   * POST /
   * Create a retention policy.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireBody(req.body, "entityType", "retentionDays");

      const { stateId, boardId, entityType, retentionDays } = req.body as {
        stateId?: string;
        boardId?: string;
        entityType: string;
        retentionDays: number;
      };

      if (!isValidEntityType(entityType)) {
        throw new BadRequestError(
          `Invalid entityType '${entityType}'. Must be one of: MeterReading, AuditLog, GeneratedReportFile, CustomerQuery`,
        );
      }

      if (typeof retentionDays !== "number" || retentionDays < 1) {
        throw new BadRequestError("retentionDays must be a positive number");
      }

      const policy = await retentionService.createRetentionPolicy(
        { stateId, boardId, entityType, retentionDays },
        req.appUser!,
      );

      sendSuccess(res, policy, "Retention policy created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /
   * List retention policies (scope-filtered).
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const policies = await retentionService.listPolicies(req.appUser!);

      sendSuccess(res, policies);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /:id
   * Update a retention policy.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");

      const { entityType, retentionDays } = req.body as {
        entityType?: string;
        retentionDays?: number;
      };

      if (entityType && !isValidEntityType(entityType)) {
        throw new BadRequestError(
          `Invalid entityType '${entityType}'. Must be one of: MeterReading, AuditLog, GeneratedReportFile, CustomerQuery`,
        );
      }

      if (retentionDays !== undefined && (typeof retentionDays !== "number" || retentionDays < 1)) {
        throw new BadRequestError("retentionDays must be a positive number");
      }

      const updated = await retentionService.updatePolicy(
        id,
        { entityType, retentionDays },
        req.appUser!,
      );

      sendSuccess(res, updated, "Retention policy updated successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /:id
   * Delete a retention policy.
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");

      const result = await retentionService.deletePolicy(id, req.appUser!);

      sendSuccess(res, result, "Retention policy deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /cleanup/run
   * Trigger retention cleanup manually.
   */
  async runCleanup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await retentionService.runRetentionCleanup();

      sendSuccess(res, result, "Retention cleanup executed successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const retentionController = new RetentionController();
