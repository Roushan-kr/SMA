import { z } from "zod";

// ── Shared Enums ─────────────────────────────────────────────────────

const ENTITY_TYPES = [
  "MeterReading",
  "AuditLog",
  "GeneratedReportFile",
  "CustomerQuery",
] as const;

// ── Create Retention Policy ──────────────────────────────────────────

export const createRetentionPolicySchema = z.object({
  stateId: z.string().uuid("stateId must be a valid UUID").optional(),
  boardId: z.string().uuid("boardId must be a valid UUID").optional(),
  entityType: z.enum(ENTITY_TYPES, {
    message: `entityType must be one of: ${ENTITY_TYPES.join(", ")}`,
  }),
  retentionDays: z.number({ message: "retentionDays must be a number" })
    .int("retentionDays must be an integer")
    .min(1, "retentionDays must be at least 1"),
}).strict();

export type CreateRetentionPolicyInput = z.infer<typeof createRetentionPolicySchema>;

// ── Update Retention Policy ──────────────────────────────────────────

export const updateRetentionPolicySchema = z.object({
  entityType: z.enum(ENTITY_TYPES, {
    message: `entityType must be one of: ${ENTITY_TYPES.join(", ")}`,
  }).optional(),
  retentionDays: z.number({ message: "retentionDays must be a number" })
    .int("retentionDays must be an integer")
    .min(1, "retentionDays must be at least 1")
    .optional(),
}).strict();

export type UpdateRetentionPolicyInput = z.infer<typeof updateRetentionPolicySchema>;
