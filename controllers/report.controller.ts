import type { Request, Response, NextFunction } from "express";
import {
  reportService,
  isValidReportType,
  isValidReportFormat,
} from "../services/report.service.js";
import { sendSuccess } from "../lib/apiResponse.js";
import { BadRequestError } from "../lib/errors.js";
import { requireBody, requireParam } from "../helper/controller.helper.js";
import type { ReportFileFormat } from "../generated/prisma/client.js";

// ── Controller ───────────────────────────────────────────────────────

export class ReportController {
  // ── Report Formats ──────────────────────────────────────────────

  /**
   * POST /formats
   * Create a report format template.
   */
  async createFormat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireBody(req.body, "boardId", "name", "schema");

      const { boardId, name, schema } = req.body as {
        boardId: string;
        name: string;
        schema: Record<string, unknown>;
      };

      const format = await reportService.createReportFormat(
        { boardId, name, schema },
        req.appUser!,
      );

      sendSuccess(res, format, "Report format created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /formats
   * List report formats (scope-filtered).
   */
  async listFormats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const formats = await reportService.listReportFormats(req.appUser!);

      sendSuccess(res, formats);
    } catch (error) {
      next(error);
    }
  }

  // ── Report Generation ───────────────────────────────────────────

  /**
   * POST /generate
   * Generate a report file.
   */
  async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireBody(req.body, "reportType", "format");

      const { reportType, format, filters } = req.body as {
        reportType: string;
        format: string;
        filters?: {
          billingStart?: string;
          billingEnd?: string;
          consumerId?: string;
          meterId?: string;
        };
      };

      if (!isValidReportType(reportType)) {
        throw new BadRequestError(
          `Invalid reportType '${reportType}'. Must be one of: BILLING_SUMMARY, CONSUMPTION_REPORT, METER_STATUS_REPORT, REVENUE_REPORT`,
        );
      }

      if (!isValidReportFormat(format)) {
        throw new BadRequestError(
          `Invalid format '${format}'. Must be one of: PDF, CSV, XML, JSON`,
        );
      }

      const report = await reportService.generateReportFile(
        { reportType, format: format as ReportFileFormat, filters },
        req.appUser!,
      );

      sendSuccess(res, report, "Report generated successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  // ── List / Download / Delete ────────────────────────────────────

  /**
   * GET /
   * List generated reports (scope-filtered, paginated).
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reportType, format, page, limit } = req.query as {
        reportType?: string;
        format?: string;
        page?: string;
        limit?: string;
      };

      if (format && !isValidReportFormat(format)) {
        throw new BadRequestError(
          `Invalid format '${format}'. Must be one of: PDF, CSV, XML, JSON`,
        );
      }

      const result = await reportService.listGeneratedReports(req.appUser!, {
        reportType,
        format: format as ReportFileFormat | undefined,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /:id/download
   * Download a report file (returns signed URL or fileUrl).
   */
  async download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");

      const result = await reportService.downloadReportFile(id, req.appUser!);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /:id
   * Delete a generated report.
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");

      const result = await reportService.deleteGeneratedReport(id, req.appUser!);

      sendSuccess(res, result, "Report deleted successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const reportController = new ReportController();
