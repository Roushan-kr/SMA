import { z } from "zod";

// ── Create Query (Consumer) ──────────────────────────────────────────

export const createQuerySchema = z.object({
  queryText: z.string({ message: "queryText is required" })
    .min(1, "queryText must not be empty")
    .max(5000, "queryText must be at most 5000 characters"),
}).strict();

export type CreateQueryInput = z.infer<typeof createQuerySchema>;

// ── Admin Reply ──────────────────────────────────────────────────────

export const adminReplySchema = z.object({
  adminReply: z.string({ message: "adminReply is required" })
    .min(1, "adminReply must not be empty"),
  status: z.enum(["RESOLVED", "REJECTED"], {
    message: "status must be RESOLVED or REJECTED",
  }).optional(),
}).strict();

export type AdminReplyInput = z.infer<typeof adminReplySchema>;

// ── AI Classify ──────────────────────────────────────────────────────

export const aiClassifySchema = z.object({
  category: z.string({ message: "category is required" }).min(1),
  confidence: z.number({ message: "confidence must be a number" })
    .min(0, "confidence must be between 0 and 1")
    .max(1, "confidence must be between 0 and 1"),
}).strict();

export type AiClassifyInput = z.infer<typeof aiClassifySchema>;

// ── AI Auto-Resolve ──────────────────────────────────────────────────

export const aiAutoResolveSchema = z.object({
  category: z.string({ message: "category is required" }).min(1),
  confidence: z.number({ message: "confidence must be a number" })
    .min(0, "confidence must be between 0 and 1")
    .max(1, "confidence must be between 0 and 1"),
  resolutionText: z.string({ message: "resolutionText is required" }).min(1),
}).strict();

export type AiAutoResolveInput = z.infer<typeof aiAutoResolveSchema>;
