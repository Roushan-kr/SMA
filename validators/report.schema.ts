import { z } from "zod";

// ── Shared Enums ─────────────────────────────────────────────────────

const REPORT_TYPES = [
  "BILLING_SUMMARY",
  "CONSUMPTION_REPORT",
  "METER_STATUS_REPORT",
  "REVENUE_REPORT",
] as const;

const REPORT_FORMATS = ["PDF", "CSV", "XML", "JSON"] as const;

// ── Generate Report ──────────────────────────────────────────────────

export const generateReportSchema = z.object({
  reportType: z.enum(REPORT_TYPES, {
    message: `reportType must be one of: ${REPORT_TYPES.join(", ")}`,
  }),
  format: z.enum(REPORT_FORMATS, {
    message: `format must be one of: ${REPORT_FORMATS.join(", ")}`,
  }),
  filters: z.object({
    billingStart: z.string().datetime({ offset: true }).optional(),
    billingEnd: z.string().datetime({ offset: true }).optional(),
    consumerId: z.string().uuid().optional(),
    meterId: z.string().uuid().optional(),
  }).strict().optional(),
}).strict();

export type GenerateReportInput = z.infer<typeof generateReportSchema>;

// ── Create Report Format ─────────────────────────────────────────────

export const createReportFormatSchema = z.object({
  boardId: z.string().uuid("boardId must be a valid UUID"),
  name: z.string({ message: "name is required" }).min(1, "name must not be empty"),
  schema: z.record(z.string(), z.string(), { message: "schema must be a JSON object" }),
}).strict();

export type CreateReportFormatInput = z.infer<typeof createReportFormatSchema>;
