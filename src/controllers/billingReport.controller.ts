import type { Request, Response, NextFunction } from "express";
import {
  billingReportService,
  isValidGranularity,
} from "../services/billingReport.service.js";
import { sendSuccess } from "../lib/apiResponse.js";
import { BadRequestError } from "../lib/errors.js";
import { requireBody, requireParam } from "../helper/controller.helper.js";
import type { AggregationGranularity } from "../generated/prisma/client.js";

// ── Controller ───────────────────────────────────────────────────────

export class BillingReportController {
  // ── Bill Generation ─────────────────────────────────────────────

  /**
   * POST /generate
   * Generate a billing report for a meter in a date range.
   */
  async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireBody(req.body, "meterId", "billingStart", "billingEnd");

      const { meterId, billingStart, billingEnd, taxRate } = req.body as {
        meterId: string;
        billingStart: string;
        billingEnd: string;
        taxRate?: number;
      };

      const report = await billingReportService.generateBill(
        { meterId, billingStart, billingEnd, taxRate },
        req.appUser!,
      );

      sendSuccess(res, report, "Billing report generated successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  // ── Recalculation ───────────────────────────────────────────────

  /**
   * POST /:billId/recalculate
   * Recalculate an existing billing report.
   */
  async recalculate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const billId = requireParam(req.params, "billId");
      requireBody(req.body, "reason");

      const { reason } = req.body as { reason: string };

      const report = await billingReportService.recalculateBill(
        { billingReportId: billId, reason },
        req.appUser!,
      );

      sendSuccess(res, report, "Billing report recalculated successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  // ── Consumption Aggregation ─────────────────────────────────────

  /**
   * POST /aggregate
   * Build or refresh a consumption aggregate for a meter.
   */
  async aggregate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireBody(req.body, "meterId", "periodStart", "periodEnd", "granularity");

      const { meterId, periodStart, periodEnd, granularity } = req.body as {
        meterId: string;
        periodStart: string;
        periodEnd: string;
        granularity: string;
      };

      if (!isValidGranularity(granularity)) {
        throw new BadRequestError(
          `Invalid granularity '${granularity}'. Must be one of: HOURLY, DAILY, MONTHLY`,
        );
      }

      const result = await billingReportService.aggregateConsumption(
        { meterId, periodStart, periodEnd, granularity: granularity as AggregationGranularity },
        req.appUser!,
      );

      sendSuccess(res, result, "Consumption aggregated successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  // ── Read Operations ─────────────────────────────────────────────

  /**
   * GET /
   * List billing reports with pagination and filters.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { meterId, consumerId, billingStart, billingEnd, page, limit } =
        req.query as {
          meterId?: string;
          consumerId?: string;
          billingStart?: string;
          billingEnd?: string;
          page?: string;
          limit?: string;
        };

      const result = await billingReportService.listBills(
        {
          meterId,
          consumerId,
          billingStart,
          billingEnd,
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
   * GET /:billId
   * Get a single billing report by ID.
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const billId = requireParam(req.params, "billId");

      const report = await billingReportService.getBillById(billId, req.appUser!);

      sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /:billId/recalculations
   * Get recalculation history for a billing report.
   */
  async getRecalculations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const billId = requireParam(req.params, "billId");

      const logs = await billingReportService.getRecalculationHistory(billId, req.appUser!);

      sendSuccess(res, logs);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /meter/:meterId/aggregates
   * Get consumption aggregates for a meter.
   */
  async getAggregates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meterId = requireParam(req.params, "meterId");

      const { granularity } = req.query as { granularity?: string };

      if (granularity && !isValidGranularity(granularity)) {
        throw new BadRequestError(
          `Invalid granularity '${granularity}'. Must be one of: HOURLY, DAILY, MONTHLY`,
        );
      }

      const aggregates = await billingReportService.getAggregates(
        meterId,
        granularity as AggregationGranularity | undefined,
        req.appUser!,
      );

      sendSuccess(res, aggregates);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /my-bills
   * Consumer self-service: list all billing reports for meters owned by the signed-in consumer.
   * Supports optional query params: meterId, page, limit.
   */
  async listMyBills(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { meterId, page, limit } = req.query as {
        meterId?: string;
        page?: string;
        limit?: string;
      };

      const result = await billingReportService.listConsumerBills(
        {
          consumerId: req.appConsumer!.id,
          meterId: meterId!,
          page: page ? parseInt(page, 10) : 1,
          limit: limit ? parseInt(limit, 10) : 1,
        },
      );

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /my-bills/:billId
   * Consumer self-service: view a single billing report by ID.
   * Verifies the bill belongs to a meter owned by the signed-in consumer.
   */
  async getMyBillById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const billId = requireParam(req.params, "billId");

      const report = await billingReportService.getConsumerBillById(
        billId,
        req.appConsumer!.id,
      );

      sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /:billId/view
   * Record that a consumer has viewed a billing report.
   * (Consumer self-service — uses appConsumer)
   */
  async recordView(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const billId = requireParam(req.params, "billId");

      const view = await billingReportService.recordBillView(
        billId,
        req.appConsumer!.id,
      );

      sendSuccess(res, view, "Bill view recorded");
    } catch (error) {
      next(error);
    }
  }
}

export const billingReportController = new BillingReportController();
