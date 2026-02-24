import type { Request, Response, NextFunction } from "express";
import { smartMeterService } from "../services/smartMeter.service.js";
import { sendSuccess } from "../lib/apiResponse.js";
import { BadRequestError } from "../lib/errors.js";
import type { MeterStatus } from "../generated/prisma/client.js";

// ── Validation Helpers ───────────────────────────────────────────────

const VALID_METER_STATUSES: MeterStatus[] = ["ACTIVE", "INACTIVE", "FAULTY", "DISCONNECTED"];

function requireBody(body: unknown, ...fields: string[]): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body is required");
  }
  for (const field of fields) {
    if (!(field in body) || (body as Record<string, unknown>)[field] == null) {
      throw new BadRequestError(`Field '${field}' is required`);
    }
  }
}

function requireParam(params: Record<string, unknown>, name: string): string {
  const value = params[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestError(`URL parameter '${name}' is required`);
  }
  return value;
}

// ── Controller ───────────────────────────────────────────────────────

export class SmartMeterController {
  /**
   * POST /
   * Create a new smart meter.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireBody(req.body, "meterNumber", "consumerId", "tariffId");

      const { meterNumber, consumerId, tariffId, status } = req.body as {
        meterNumber: string;
        consumerId: string;
        tariffId: string;
        status?: MeterStatus;
      };

      if (status && !VALID_METER_STATUSES.includes(status)) {
        throw new BadRequestError(
          `Invalid status '${String(status)}'. Must be one of: ${VALID_METER_STATUSES.join(", ")}`,
        );
      }

      const meter = await smartMeterService.createMeter(
        { meterNumber, consumerId, tariffId, status },
        req.appUser!,
      );

      sendSuccess(res, meter, "Smart meter created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /:meterId/assign
   * Assign a meter to a different consumer.
   */
  async assign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meterId = requireParam(req.params, "meterId");
      requireBody(req.body, "consumerId");

      const { consumerId } = req.body as { consumerId: string };

      const meter = await smartMeterService.assignMeterToConsumer(meterId, consumerId, req.appUser!);

      sendSuccess(res, meter, "Meter assigned to consumer successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /:meterId
   * Get a single meter by ID.
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meterId = requireParam(req.params, "meterId");

      const meter = await smartMeterService.getMeterById(meterId, req.appUser!);

      sendSuccess(res, meter);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /consumer/:consumerId
   * List all meters for a consumer.
   */
  async getByConsumer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const consumerId = requireParam(req.params, "consumerId");

      const meters = await smartMeterService.getMetersForConsumer(consumerId, req.appUser!);

      sendSuccess(res, meters);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /:meterId/status
   * Update a meter's status.
   */
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meterId = requireParam(req.params, "meterId");
      requireBody(req.body, "status");

      const { status } = req.body as { status: MeterStatus };

      if (!VALID_METER_STATUSES.includes(status)) {
        throw new BadRequestError(
          `Invalid status '${String(status)}'. Must be one of: ${VALID_METER_STATUSES.join(", ")}`,
        );
      }

      const meter = await smartMeterService.updateMeterStatus(meterId, status, req.appUser!);

      sendSuccess(res, meter, "Meter status updated successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /:meterId/consumption
   * Get consumption summary for a meter in a date range.
   * Query params: periodStart, periodEnd (ISO 8601 date strings).
   */
  async getConsumptionSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meterId = requireParam(req.params, "meterId");

      const { periodStart, periodEnd } = req.query as {
        periodStart?: string;
        periodEnd?: string;
      };

      if (!periodStart || !periodEnd) {
        throw new BadRequestError("Query params 'periodStart' and 'periodEnd' are required");
      }

      const start = new Date(periodStart);
      const end = new Date(periodEnd);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new BadRequestError("Invalid date format. Use ISO 8601 (e.g. 2025-01-01T00:00:00Z)");
      }

      if (start >= end) {
        throw new BadRequestError("'periodStart' must be before 'periodEnd'");
      }

      const summary = await smartMeterService.getMeterConsumptionSummary(
        meterId,
        start,
        end,
        req.appUser!,
      );

      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }
}

export const smartMeterController = new SmartMeterController();