import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import type { RoleType, ConsentType } from "../generated/prisma/client.js";
import { NotFoundError, BadRequestError, ForbiddenError, mapPrismaError } from "../lib/errors.js";
import { buildScopeFilter } from "../helper/service.helper.js";

// ── Types ────────────────────────────────────────────────────────────

export interface CreateAdminUserInput {
  name: string;
  email?: string | undefined;
  phone?: string | undefined;
  role: RoleType;
  stateId?: string | null | undefined;
  boardId?: string | null | undefined;
}

export interface LinkClerkUserInput {
  clerkUserId: string;
  role: RoleType;
  stateId?: string;
  boardId?: string;
}

export interface ListUsersFilter {
  role?: RoleType | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

const VALID_ROLES: RoleType[] = [
  "SUPER_ADMIN",
  "STATE_ADMIN",
  "BOARD_ADMIN",
  "SUPPORT_AGENT",
  "AUDITOR",
];

export function isValidRole(value: string): value is RoleType {
  return VALID_ROLES.includes(value as RoleType);
}

const VALID_CONSENT_TYPES: ConsentType[] = ["ENERGY_TRACKING", "AI_QUERY_PROCESSING"];

export function isValidConsentType(value: string): value is ConsentType {
  return VALID_CONSENT_TYPES.includes(value as ConsentType);
}

// ── RBAC Creation Hierarchy ──────────────────────────────────────────

/**
 * Defines which roles each role can create.
 * SUPER_ADMIN → STATE_ADMIN, AUDITOR
 * STATE_ADMIN → BOARD_ADMIN
 * BOARD_ADMIN → SUPPORT_AGENT
 */
const CREATION_HIERARCHY: Record<string, RoleType[]> = {
  SUPER_ADMIN: ["STATE_ADMIN", "BOARD_ADMIN", "SUPPORT_AGENT", "AUDITOR"],
  STATE_ADMIN: ["BOARD_ADMIN", "SUPPORT_AGENT"],
  BOARD_ADMIN: ["SUPPORT_AGENT"],
};

function canCreateRole(creatorRole: RoleType, targetRole: RoleType): boolean {
  const allowed = CREATION_HIERARCHY[creatorRole];
  return !!allowed && allowed.includes(targetRole);
}

// ── Service ──────────────────────────────────────────────────────────

export class UserService {
  /**
   * Create a new admin user. Enforces RBAC creation hierarchy.
   */
  async createAdminUser(input: CreateAdminUserInput, authUser: AuthUser) {
    try {
      if (!canCreateRole(authUser.role, input.role)) {
        throw new ForbiddenError(
          `${authUser.role} cannot create users with role ${input.role}`,
        );
      }

      // Scope enforcement: STATE_ADMIN can only create within their state
      if (authUser.role === "STATE_ADMIN") {
        if (input.stateId && input.stateId !== authUser.stateId) {
          throw new ForbiddenError("You can only create users within your own state");
        }
        input.stateId = authUser.stateId ?? null;
      }

      // BOARD_ADMIN can only create within their board
      if (authUser.role === "BOARD_ADMIN") {
        if (input.boardId && input.boardId !== authUser.boardId) {
          throw new ForbiddenError("You can only create users within your own board");
        }
        input.boardId = authUser.boardId ?? null;
        input.stateId = authUser.stateId ?? null;
      }

      // Validate state/board exist if provided
      if (input.stateId) {
        const state = await prisma.state.findUnique({
          where: { id: input.stateId },
          select: { id: true },
        });
        if (!state) throw new NotFoundError("State", input.stateId);
      }

      if (input.boardId) {
        const board = await prisma.electricityBoard.findUnique({
          where: { id: input.boardId },
          select: { id: true, stateId: true },
        });
        if (!board) throw new NotFoundError("ElectricityBoard", input.boardId);

        // Ensure board belongs to the correct state
        if (input.stateId && board.stateId !== input.stateId) {
          throw new BadRequestError("Board does not belong to the specified state");
        }
      }

      const user = await prisma.user.create({
        data: {
          name: input.name,
          email: input.email ?? null,
          phone: input.phone ?? null,
          role: input.role,
          stateId: input.stateId ?? null,
          boardId: input.boardId ?? null,
        },
        include: { state: true, board: true },
      });

      return user;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Link an existing Clerk user to the system.
   * Creates a User record and an ExternalAuth record.
   */
  async linkClerkUser(input: LinkClerkUserInput) {
    try {
      // Check if Clerk user is already linked
      const existing = await prisma.user.findUnique({
        where: { clerkUserId: input.clerkUserId },
        select: { id: true },
      });

      if (existing) {
        throw new BadRequestError("This Clerk user is already linked to an account");
      }

      const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            clerkUserId: input.clerkUserId,
            name: input.clerkUserId, // placeholder — updated on first profile sync
            role: input.role,
            stateId: input.stateId ?? null,
            boardId: input.boardId ?? null,
          },
          include: { state: true, board: true },
        });

        await tx.externalAuth.create({
          data: {
            provider: "clerk",
            providerUserId: input.clerkUserId,
            userId: newUser.id,
          },
        });

        return newUser;
      });

      return user;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * List users with scope filtering and optional role filter.
   */
  async listUsers(authUser: AuthUser, filters: ListUsersFilter) {
    try {
      const scopeFilter = buildScopeFilter(authUser);
      const page = filters.page ?? 1;
      const limit = Math.min(filters.limit ?? 20, 100);
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = { ...scopeFilter };
      if (filters.role) where["role"] = filters.role;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          include: { state: true, board: true },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      return {
        data: users,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Get a single user by ID (scope-enforced).
   */
  async getUserById(id: string, authUser: AuthUser) {
    try {
      const user = await this.findUserOrThrow(id, authUser);
      return user;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Update a user's role. Enforces RBAC creation hierarchy.
   */
  async updateUserRole(id: string, role: RoleType, authUser: AuthUser) {
    try {
      const user = await this.findUserOrThrow(id, authUser);

      // Cannot change own role
      if (user.id === authUser.id) {
        throw new ForbiddenError("You cannot change your own role");
      }

      // Cannot promote to a role the caller can't create
      if (!canCreateRole(authUser.role, role)) {
        throw new ForbiddenError(
          `${authUser.role} cannot assign role ${role}`,
        );
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role },
        include: { state: true, board: true },
      });

      return updated;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Update a user's scope (stateId / boardId).
   * Only SUPER_ADMIN can change scope freely.
   */
  async updateUserScope(
    id: string,
    stateId: string | undefined,
    boardId: string | undefined,
    authUser: AuthUser,
  ) {
    try {
      const user = await this.findUserOrThrow(id, authUser);

      if (user.id === authUser.id) {
        throw new ForbiddenError("You cannot change your own scope");
      }

      // Only SUPER_ADMIN can reassign scope freely
      if (authUser.role !== "SUPER_ADMIN") {
        // STATE_ADMIN can only assign within their state
        if (authUser.role === "STATE_ADMIN") {
          if (stateId && stateId !== authUser.stateId) {
            throw new ForbiddenError("You can only assign users within your own state");
          }
        }
        // BOARD_ADMIN can only assign within their board
        if (authUser.role === "BOARD_ADMIN") {
          if (boardId && boardId !== authUser.boardId) {
            throw new ForbiddenError("You can only assign users within your own board");
          }
        }
      }

      // Validate state/board exist
      if (stateId) {
        const state = await prisma.state.findUnique({
          where: { id: stateId },
          select: { id: true },
        });
        if (!state) throw new NotFoundError("State", stateId);
      }

      if (boardId) {
        const board = await prisma.electricityBoard.findUnique({
          where: { id: boardId },
          select: { id: true, stateId: true },
        });
        if (!board) throw new NotFoundError("ElectricityBoard", boardId);
        if (stateId && board.stateId !== stateId) {
          throw new BadRequestError("Board does not belong to the specified state");
        }
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          stateId: stateId ?? null,
          boardId: boardId ?? null,
        },
        include: { state: true, board: true },
      });

      return updated;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Delete a user (admin only, scope-enforced).
   */
  async deleteUser(id: string, authUser: AuthUser) {
    try {
      const user = await this.findUserOrThrow(id, authUser);

      if (user.id === authUser.id) {
        throw new ForbiddenError("You cannot delete your own account");
      }

      // Cannot delete a user with a higher or equal role
      if (!canCreateRole(authUser.role, user.role)) {
        throw new ForbiddenError(
          `${authUser.role} cannot delete users with role ${user.role}`,
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.externalAuth.deleteMany({ where: { userId: user.id } });
        await tx.userConsent.deleteMany({ where: { userId: user.id } });
        await tx.user.delete({ where: { id: user.id } });
      });

      return { deleted: true, id: user.id };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── Consent Management ──────────────────────────────────────────

  /**
   * List all consents for a user.
   */
  async listUserConsents(userId: string, authUser: AuthUser) {
    try {
      // Verify user exists and is in scope
      await this.findUserOrThrow(userId, authUser);

      const consents = await prisma.userConsent.findMany({
        where: { userId },
        orderBy: { consentType: "asc" },
      });

      return consents;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Update (upsert) a consent for a user.
   */
  async updateUserConsent(
    userId: string,
    consentType: ConsentType,
    granted: boolean,
    authUser: AuthUser,
  ) {
    try {
      await this.findUserOrThrow(userId, authUser);

      const consent = await prisma.userConsent.upsert({
        where: { userId_consentType: { userId, consentType } },
        update: {
          granted,
          grantedAt: granted ? new Date() : null,
          revokedAt: granted ? null : new Date(),
        },
        create: {
          userId,
          consentType,
          granted,
          grantedAt: granted ? new Date() : null,
        },
      });

      return consent;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── Private Helpers ─────────────────────────────────────────────

  /**
   * Find a user by ID with scope enforcement.
   */
  private async findUserOrThrow(id: string, authUser: AuthUser) {
    const scopeFilter = buildScopeFilter(authUser);

    const user = await prisma.user.findFirst({
      where: { id, ...scopeFilter },
      include: { state: true, board: true },
    });

    if (!user) {
      throw new NotFoundError("User", id);
    }

    return user;
  }
}

export const userService = new UserService();
