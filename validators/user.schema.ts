import { z } from "zod";

// ── Shared ───────────────────────────────────────────────────────────

const ROLES = ["SUPER_ADMIN", "STATE_ADMIN", "BOARD_ADMIN", "SUPPORT_AGENT", "AUDITOR"] as const;
const CONSENT_TYPES = ["ENERGY_TRACKING", "AI_QUERY_PROCESSING"] as const;

// ── Create User ──────────────────────────────────────────────────────

export const createUserSchema = z.object({
  name: z.string({ message: "name is required" }).min(1, "name must not be empty"),
  email: z.string().email("Invalid email format").optional(),
  phone: z.string().min(1).optional(),
  role: z.enum(ROLES, { message: `role must be one of: ${ROLES.join(", ")}` }),
  stateId: z.string().uuid("stateId must be a valid UUID").optional(),
  boardId: z.string().uuid("boardId must be a valid UUID").optional(),
}).strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;

// ── Update Role ──────────────────────────────────────────────────────

export const updateRoleSchema = z.object({
  role: z.enum(ROLES, { message: `role must be one of: ${ROLES.join(", ")}` }),
}).strict();

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

// ── Update Scope ─────────────────────────────────────────────────────

export const updateScopeSchema = z.object({
  stateId: z.string().uuid("stateId must be a valid UUID").optional(),
  boardId: z.string().uuid("boardId must be a valid UUID").optional(),
}).strict();

export type UpdateScopeInput = z.infer<typeof updateScopeSchema>;

// ── Update Consent ───────────────────────────────────────────────────

export const updateConsentSchema = z.object({
  consentType: z.enum(CONSENT_TYPES, {
    message: `consentType must be one of: ${CONSENT_TYPES.join(", ")}`,
  }),
  granted: z.boolean({ message: "granted must be a boolean" }),
}).strict();

export type UpdateConsentInput = z.infer<typeof updateConsentSchema>;

// ── ID Param ─────────────────────────────────────────────────────────

export const idParamSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
});
