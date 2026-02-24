import type { Request, Response, NextFunction, RequestHandler } from "express";
import { clerkMiddleware, getAuth, requireAuth as clerkRequireAuth } from "@clerk/express";
import type { RoleType } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";

// ── Type Augmentation ────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  clerkUserId: string;
  role: RoleType;
  stateId: string | null;
  boardId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      appUser?: AuthUser;
    }
  }
}

// ── Permission Map ───────────────────────────────────────────────────
// Single source of truth: define what each role is allowed to do.
// Permissions are checked via `checkPermission(permission)` middleware.

export const Permission = {
  METER_CREATE: "meter:create",
  METER_READ: "meter:read",
  METER_UPDATE: "meter:update",
  METER_ASSIGN: "meter:assign",
  METER_DELETE: "meter:delete",
  CONSUMER_READ: "consumer:read",
  BILLING_READ: "billing:read",
  REPORT_GENERATE: "report:generate",
  QUERY_MANAGE: "query:manage",
  AUDIT_READ: "audit:read",
  USER_MANAGE: "user:manage",
} as const;

export type PermissionKey = (typeof Permission)[keyof typeof Permission];

const ROLE_PERMISSIONS: Record<RoleType, readonly PermissionKey[]> = {
  SUPER_ADMIN: Object.values(Permission), // full access
  STATE_ADMIN: [
    Permission.METER_CREATE,
    Permission.METER_READ,
    Permission.METER_UPDATE,
    Permission.METER_ASSIGN,
    Permission.CONSUMER_READ,
    Permission.BILLING_READ,
    Permission.REPORT_GENERATE,
    Permission.QUERY_MANAGE,
    Permission.AUDIT_READ,
    Permission.USER_MANAGE,
  ],
  BOARD_ADMIN: [
    Permission.METER_CREATE,
    Permission.METER_READ,
    Permission.METER_UPDATE,
    Permission.METER_ASSIGN,
    Permission.CONSUMER_READ,
    Permission.BILLING_READ,
    Permission.REPORT_GENERATE,
    Permission.QUERY_MANAGE,
  ],
  SUPPORT_AGENT: [
    Permission.METER_READ,
    Permission.CONSUMER_READ,
    Permission.BILLING_READ,
    Permission.QUERY_MANAGE,
  ],
  AUDITOR: [
    Permission.METER_READ,
    Permission.CONSUMER_READ,
    Permission.BILLING_READ,
    Permission.AUDIT_READ,
  ],
} as const;

// ── Middleware: Clerk Integration ─────────────────────────────────────

/** Apply Clerk middleware globally to parse JWT from cookies/headers. */
export const clerkAuth: RequestHandler = clerkMiddleware();

/** Protect a route — requires a valid Clerk session. */
export const requireAuth: RequestHandler = clerkRequireAuth();

// ── Middleware: Resolve App User ──────────────────────────────────────

/**
 * After Clerk authentication, resolve the internal `User` record
 * from the database and attach it to `req.appUser`.
 * This is required before any permission check.
 */
export function resolveAppUser() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = getAuth(req);
      const clerkUserId = auth.userId;

      if (!clerkUserId) {
        throw new UnauthorizedError("No authenticated user found");
      }

      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, clerkUserId: true, role: true, stateId: true, boardId: true },
      });

      if (!user || !user.clerkUserId) {
        throw new ForbiddenError("User not registered in the system");
      }

      req.appUser = {
        id: user.id,
        clerkUserId: user.clerkUserId,
        role: user.role,
        stateId: user.stateId,
        boardId: user.boardId,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

// ── Middleware: Permission Check ──────────────────────────────────────

/**
 * Check if the authenticated user has the required permission.
 * Must be used AFTER `resolveAppUser()`.
 *
 * @example
 *   router.post("/", requireAuth, resolveAppUser(), checkPermission("meter:create"), controller.create);
 */
export function checkPermission(permission: PermissionKey) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.appUser;
    if (!user) {
      next(new UnauthorizedError("User context not resolved"));
      return;
    }

    const allowed = ROLE_PERMISSIONS[user.role];
    if (!allowed.includes(permission)) {
      next(new ForbiddenError(`Missing permission: ${permission}`));
      return;
    }

    next();
  };
}

/**
 * Convenience: require ANY of the listed permissions.
 */
export function checkAnyPermission(...permissions: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.appUser;
    if (!user) {
      next(new UnauthorizedError("User context not resolved"));
      return;
    }

    const allowed = ROLE_PERMISSIONS[user.role];
    const hasAny = permissions.some((p) => allowed.includes(p));

    if (!hasAny) {
      next(new ForbiddenError(`Missing one of permissions: ${permissions.join(", ")}`));
      return;
    }

    next();
  };
}
