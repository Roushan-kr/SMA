import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import type { ReportFileFormat, Prisma } from "../generated/prisma/client.js";
import { NotFoundError, BadRequestError, ForbiddenError, mapPrismaError } from "../lib/errors.js";
import { buildScopeFilter } from "../helper/service.helper.js";
import { getStorage } from "../lib/storage/index.js";
import { Parser } from "json2csv";
import { DateTime } from "luxon";

// ── Types ────────────────────────────────────────────────────────────

export interface CreateReportFormatInput {
  boardId: string;
  name: string;
  schema: Record<string, unknown>;
}

export interface GenerateReportInput {
  reportType: string;
  format: ReportFileFormat;
  filters?: {
    billingStart?: string | undefined;
    billingEnd?: string | undefined;
    consumerId?: string | undefined;
    meterId?: string | undefined;
  } | undefined;
}

export interface ListReportsFilter {
  reportType?: string | undefined;
  format?: ReportFileFormat | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

const VALID_REPORT_TYPES = [
  "BILLING_SUMMARY",
  "CONSUMPTION_REPORT",
  "METER_STATUS_REPORT",
  "REVENUE_REPORT",
] as const;

export type ReportType = (typeof VALID_REPORT_TYPES)[number];

export function isValidReportType(value: string): value is ReportType {
  return VALID_REPORT_TYPES.includes(value as ReportType);
}

const VALID_FORMATS: ReportFileFormat[] = ["PDF", "CSV", "XML", "JSON"];

export function isValidReportFormat(value: string): value is ReportFileFormat {
  return VALID_FORMATS.includes(value as ReportFileFormat);
}

// ── Scope Helpers ───────────────────────────────────────────────────

function buildReportScopeFilter(user: AuthUser) {
  if (user.role === "SUPER_ADMIN") return {};
  if (user.role === "STATE_ADMIN" && user.stateId) {
    return { stateId: user.stateId };
  }
  if (user.role === "BOARD_ADMIN" && user.boardId) {
    return { boardId: user.boardId };
  }
  // SUPPORT_AGENT / AUDITOR
  if (user.boardId) return { boardId: user.boardId };
  if (user.stateId) return { stateId: user.stateId };
  return {};
}

// ── Service ──────────────────────────────────────────────────────────

export class ReportService {
  // ── Report Formats ──────────────────────────────────────────────

  /**
   * Create a report format template (SUPER_ADMIN / BOARD_ADMIN only).
   */
  async createReportFormat(input: CreateReportFormatInput, authUser: AuthUser) {
    try {
      if (authUser.role !== "SUPER_ADMIN" && authUser.role !== "BOARD_ADMIN") {
        throw new ForbiddenError("Only SUPER_ADMIN or BOARD_ADMIN can create report formats");
      }

      // BOARD_ADMIN can only create for their own board
      if (authUser.role === "BOARD_ADMIN" && authUser.boardId !== input.boardId) {
        throw new ForbiddenError("You can only create report formats for your own board");
      }

      // Verify board exists
      const board = await prisma.electricityBoard.findUnique({
        where: { id: input.boardId },
        select: { id: true },
      });

      if (!board) {
        throw new NotFoundError("ElectricityBoard", input.boardId);
      }

      const format = await prisma.reportFormat.create({
        data: {
          boardId: input.boardId,
          name: input.name,
          schema: input.schema as Prisma.InputJsonValue,
        },
        include: { board: true },
      });

      return format;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * List report formats with scope filtering.
   */
  async listReportFormats(authUser: AuthUser) {
    try {
      const scopeFilter = buildScopeFilter(authUser);

      const formats = await prisma.reportFormat.findMany({
        where: { board: { ...scopeFilter } },
        include: { board: true },
        orderBy: { createdAt: "desc" },
      });

      return formats;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── Report Generation ───────────────────────────────────────────

  /**
   * Generate a report file:
   *  1. Fetch data based on reportType and filters
   *  2. Build a report buffer (CSV/JSON placeholder)
   *  3. Upload via StorageProvider
   *  4. Persist GeneratedReportFile record
   */
  async generateReportFile(input: GenerateReportInput, authUser: AuthUser) {
    try {
      // Build report content
      const data = await this.fetchReportData(input.reportType, input.filters, authUser);
      const buffer = this.buildReportBuffer(data, input.format);

      // Determine scope from authUser
      const stateId = authUser.stateId ?? null;
      const boardId = authUser.boardId ?? null;

      // Upload to storage
      const timestamp = Date.now();
      const fileName = `reports/${input.reportType.toLowerCase()}_${timestamp}.${input.format.toLowerCase()}`;
      const contentType = this.getContentType(input.format);

      const storage = await getStorage();
      const { url, key } = await storage.upload(buffer, fileName, { contentType });

      // Persist record
      const report = await prisma.generatedReportFile.create({
        data: {
          reportType: input.reportType,
          boardId,
          stateId,
          fileUrl: url,
          format: input.format,
          createdBy: authUser.id,
        },
        include: { board: true, state: true },
      });

      return { ...report, storageKey: key };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── List / Download / Delete ────────────────────────────────────

  /**
   * List generated reports with scope filtering.
   */
  async listGeneratedReports(authUser: AuthUser, filters: ListReportsFilter) {
    try {
      const scopeFilter = buildReportScopeFilter(authUser);
      const page = filters.page ?? 1;
      const limit = Math.min(filters.limit ?? 20, 100);
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = { ...scopeFilter };
      if (filters.reportType) where["reportType"] = filters.reportType;
      if (filters.format) where["format"] = filters.format;

      const [reports, total] = await Promise.all([
        prisma.generatedReportFile.findMany({
          where,
          include: { board: true, state: true },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.generatedReportFile.count({ where }),
      ]);

      return {
        data: reports,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Download a report file. Returns a signed URL if provider supports it,
   * otherwise returns the stored fileUrl.
   */
  async downloadReportFile(reportId: string, authUser: AuthUser) {
    try {
      const report = await this.findReportOrThrow(reportId, authUser);

      const storage = await getStorage();

      if (storage.getSignedUrl) {
        // Extract storage key from URL (last segment after /reports/)
        const key = this.extractStorageKey(report.fileUrl);
        const signedUrl = await storage.getSignedUrl(key, 3600); // 1 hour
        return { url: signedUrl, format: report.format, reportType: report.reportType };
      }

      return { url: report.fileUrl, format: report.format, reportType: report.reportType };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Delete a generated report (admin only).
   * Removes from storage and DB.
   */
  async deleteGeneratedReport(reportId: string, authUser: AuthUser) {
    try {
      const report = await this.findReportOrThrow(reportId, authUser);

      // Delete from storage
      const storage = await getStorage();
      const key = this.extractStorageKey(report.fileUrl);

      try {
        await storage.delete(key);
      } catch {
        // Storage deletion may fail if already removed — continue with DB cleanup
      }

      // Delete DB record
      await prisma.generatedReportFile.delete({ where: { id: report.id } });

      return { deleted: true, id: report.id };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── Private Helpers ─────────────────────────────────────────────

  /**
   * Find a report by ID with scope enforcement.
   */
  private async findReportOrThrow(reportId: string, authUser: AuthUser) {
    const scopeFilter = buildReportScopeFilter(authUser);

    const report = await prisma.generatedReportFile.findFirst({
      where: { id: reportId, ...scopeFilter },
      include: { board: true, state: true },
    });

    if (!report) {
      throw new NotFoundError("GeneratedReportFile", reportId);
    }

    return report;
  }

  /**
   * Fetch data for report generation based on reportType.
   */
  private async fetchReportData(
    reportType: string,
    filters: GenerateReportInput["filters"],
    authUser: AuthUser,
  ) {
    const consumerScope = buildScopeFilter(authUser);

    switch (reportType) {
      case "BILLING_SUMMARY": {
        const where: Record<string, unknown> = {
          isLatest: true,
          meter: { consumer: { ...consumerScope } },
        };
        if (filters?.billingStart) where["billingStart"] = { gte: new Date(filters.billingStart) };
        if (filters?.billingEnd) where["billingEnd"] = { lte: new Date(filters.billingEnd) };
        if (filters?.consumerId) where["meter"] = { consumerId: filters.consumerId, consumer: { ...consumerScope } };

        return prisma.billingReport.findMany({
          where,
          include: { meter: { include: { consumer: true } }, tariff: true },
          orderBy: { generatedAt: "desc" },
          take: 1000,
        });
      }

      case "CONSUMPTION_REPORT": {
        const where: Record<string, unknown> = {
          meter: { consumer: { ...consumerScope } },
        };
        if (filters?.meterId) where["meterId"] = filters.meterId;

        return prisma.consumptionAggregate.findMany({
          where,
          include: { meter: { include: { consumer: true } } },
          orderBy: { periodStart: "desc" },
          take: 1000,
        });
      }

      case "METER_STATUS_REPORT": {
        return prisma.smartMeter.findMany({
          where: { consumer: { ...consumerScope } },
          include: { consumer: true, tariff: true },
          orderBy: { createdAt: "desc" },
          take: 1000,
        });
      }

      case "REVENUE_REPORT": {
        const where: Record<string, unknown> = {
          isLatest: true,
          meter: { consumer: { ...consumerScope } },
        };
        if (filters?.billingStart) where["billingStart"] = { gte: new Date(filters.billingStart) };
        if (filters?.billingEnd) where["billingEnd"] = { lte: new Date(filters.billingEnd) };

        return prisma.billingReport.findMany({
          where,
          select: {
            totalUnits: true,
            energyCharge: true,
            fixedCharge: true,
            taxAmount: true,
            totalAmount: true,
            billingStart: true,
            billingEnd: true,
            meter: { select: { meterNumber: true, consumer: { select: { name: true } } } },
          },
          orderBy: { generatedAt: "desc" },
          take: 1000,
        });
      }

      default:
        throw new BadRequestError(`Unknown report type '${reportType}'`);
    }
  }

  /**
   * Build a report buffer from data in the specified format.
   */
  private buildReportBuffer(data: unknown[], format: ReportFileFormat): Buffer {
    const now = DateTime.now().toFormat("yyyy-MM-dd HH:mm:ss");

    switch (format) {
      case "JSON":
        return Buffer.from(JSON.stringify(data, null, 2), "utf-8");

      case "CSV": {
        if (data.length === 0) return Buffer.from("", "utf-8");
        const flat = data.map((row) => this.flattenObject(row as Record<string, unknown>));
        const parser = new Parser();
        const csv = parser.parse(flat);
        return Buffer.from(csv, "utf-8");
      }

      case "XML": {
        const rows = data
          .map((row) => {
            const entries = Object.entries(
              this.flattenObject(row as Record<string, unknown>),
            );
            const fields = entries
              .map(([key, val]) => `    <${key}>${val ?? ""}</${key}>`)
              .join("\n");
            return `  <record>\n${fields}\n  </record>`;
          })
          .join("\n");
        return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>\n<report>\n${rows}\n</report>`, "utf-8");
      }

      case "PDF":
        // PDF generation placeholder — replace with pdfkit in production
        return Buffer.from(
          `[PDF Report]\nGenerated: ${now}\nRecords: ${data.length}\n\n${JSON.stringify(data, null, 2)}`,
          "utf-8",
        );

      default:
        throw new BadRequestError(`Unsupported format '${format as string}'`);
    }
  }

  /**
   * Flatten a nested object for CSV/XML serialisation.
   * Uses luxon for human-readable date formatting.
   */
  private flattenObject(
    obj: Record<string, unknown>,
    prefix = "",
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}_${key}` : key;

      if (value instanceof Date) {
        result[newKey] = DateTime.fromJSDate(value).toFormat("yyyy-MM-dd HH:mm:ss");
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value as Record<string, unknown>, newKey));
      } else {
        result[newKey] = value;
      }
    }

    return result;
  }

  private getContentType(format: ReportFileFormat): string {
    switch (format) {
      case "PDF": return "application/pdf";
      case "CSV": return "text/csv";
      case "XML": return "application/xml";
      case "JSON": return "application/json";
      default: return "application/octet-stream";
    }
  }

  private extractStorageKey(fileUrl: string): string {
    // Extract the key portion (everything after the domain/bucket)
    const match = fileUrl.match(/reports\/.+$/);
    return match ? match[0] : fileUrl;
  }
}

export const reportService = new ReportService();
