import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import { NotFoundError, BadRequestError, ForbiddenError, mapPrismaError } from "../lib/errors.js";
import { buildScopeFilter } from "../helper/service.helper.js";

// ── Types ────────────────────────────────────────────────────────────

export interface CreateStateInput {
  name: string;
  code: string;
}

export interface CreateBoardInput {
  name: string;
  code: string;
}

export interface UpdateBoardInput {
  name?: string | undefined;
  code?: string | undefined;
}

// ── Guard ────────────────────────────────────────────────────────────

function requireSuperAdmin(authUser: AuthUser): void {
  if (authUser.role !== "SUPER_ADMIN") {
    throw new ForbiddenError("Only SUPER_ADMIN can perform this action");
  }
}

function requireStateOrSuperAdmin(authUser: AuthUser): void {
  if (authUser.role !== "SUPER_ADMIN" && authUser.role !== "STATE_ADMIN") {
    throw new ForbiddenError("Only SUPER_ADMIN or STATE_ADMIN can perform this action");
  }
}

// ── Service ──────────────────────────────────────────────────────────

export class ReferenceService {
  // ══════════════════════════════════════════════════════════════════
  //  State Management
  // ══════════════════════════════════════════════════════════════════

  /**
   * Create a new state (SUPER_ADMIN only).
   */
  async createState(input: CreateStateInput, authUser: AuthUser) {
    try {
      requireSuperAdmin(authUser);

      // Check duplicate code
      const existing = await prisma.state.findUnique({
        where: { code: input.code },
        select: { id: true },
      });

      if (existing) {
        throw new BadRequestError(`State with code '${input.code}' already exists`);
      }

      const state = await prisma.state.create({
        data: {
          name: input.name,
          code: input.code.toUpperCase(),
        },
      });

      return state;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * List all states (scope-filtered for non-SUPER_ADMIN).
   */
  async listStates(authUser: AuthUser) {
    try {
      // SUPER_ADMIN sees all; STATE_ADMIN sees only their state
      if (authUser.role === "SUPER_ADMIN") {
        return prisma.state.findMany({
          include: { _count: { select: { boards: true, consumers: true } } },
          orderBy: { name: "asc" },
        });
      }

      if (authUser.stateId) {
        return prisma.state.findMany({
          where: { id: authUser.stateId },
          include: { _count: { select: { boards: true, consumers: true } } },
          orderBy: { name: "asc" },
        });
      }

      return [];
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  Electricity Board Management
  // ══════════════════════════════════════════════════════════════════

  /**
   * Create a new electricity board under a state.
   * SUPER_ADMIN can create for any state; STATE_ADMIN only for their own.
   */
  async createElectricityBoard(
    stateId: string,
    input: CreateBoardInput,
    authUser: AuthUser,
  ) {
    try {
      requireStateOrSuperAdmin(authUser);

      // STATE_ADMIN can only create boards in their own state
      if (authUser.role === "STATE_ADMIN" && authUser.stateId !== stateId) {
        throw new ForbiddenError("You can only create boards within your own state");
      }

      // Verify state exists
      const state = await prisma.state.findUnique({
        where: { id: stateId },
        select: { id: true },
      });

      if (!state) {
        throw new NotFoundError("State", stateId);
      }

      // Check duplicate board code
      const existing = await prisma.electricityBoard.findUnique({
        where: { code: input.code },
        select: { id: true },
      });

      if (existing) {
        throw new BadRequestError(`Board with code '${input.code}' already exists`);
      }

      const board = await prisma.electricityBoard.create({
        data: {
          name: input.name,
          code: input.code.toUpperCase(),
          stateId,
        },
        include: { state: true },
      });

      return board;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * List electricity boards (scope-filtered).
   */
  async listBoards(authUser: AuthUser) {
    try {
      const scopeFilter = buildScopeFilter(authUser);

      const boards = await prisma.electricityBoard.findMany({
        where: { ...scopeFilter },
        include: {
          state: true,
          _count: { select: { consumers: true, users: true, reportFormats: true } },
        },
        orderBy: { name: "asc" },
      });

      return boards;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Get a single board by ID (scope-enforced).
   */
  async getBoardById(id: string, authUser: AuthUser) {
    try {
      const board = await this.findBoardOrThrow(id, authUser);
      return board;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Update a board (SUPER_ADMIN or STATE_ADMIN for own state).
   */
  async updateBoard(id: string, input: UpdateBoardInput, authUser: AuthUser) {
    try {
      requireStateOrSuperAdmin(authUser);

      const board = await this.findBoardOrThrow(id, authUser);

      // STATE_ADMIN can only update boards in their own state
      if (authUser.role === "STATE_ADMIN" && board.stateId !== authUser.stateId) {
        throw new ForbiddenError("You can only update boards within your own state");
      }

      // Check duplicate code if changing
      if (input.code && input.code !== board.code) {
        const existing = await prisma.electricityBoard.findUnique({
          where: { code: input.code },
          select: { id: true },
        });

        if (existing) {
          throw new BadRequestError(`Board with code '${input.code}' already exists`);
        }
      }

      const updated = await prisma.electricityBoard.update({
        where: { id: board.id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.code && { code: input.code.toUpperCase() }),
        },
        include: { state: true },
      });

      return updated;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Delete a board (SUPER_ADMIN or STATE_ADMIN for own state).
   */
  async deleteBoard(id: string, authUser: AuthUser) {
    try {
      requireStateOrSuperAdmin(authUser);

      const board = await this.findBoardOrThrow(id, authUser);

      if (authUser.role === "STATE_ADMIN" && board.stateId !== authUser.stateId) {
        throw new ForbiddenError("You can only delete boards within your own state");
      }

      // Check for dependent records
      const dependents = await prisma.electricityBoard.findUnique({
        where: { id: board.id },
        select: {
          _count: { select: { consumers: true, users: true, reportFormats: true } },
        },
      });

      const total =
        (dependents?._count.consumers ?? 0) +
        (dependents?._count.users ?? 0) +
        (dependents?._count.reportFormats ?? 0);

      if (total > 0) {
        throw new BadRequestError(
          `Cannot delete board: it has ${dependents?._count.consumers ?? 0} consumers, ` +
            `${dependents?._count.users ?? 0} users, and ${dependents?._count.reportFormats ?? 0} report formats`,
        );
      }

      await prisma.electricityBoard.delete({ where: { id: board.id } });

      return { deleted: true, id: board.id };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── Private Helpers ─────────────────────────────────────────────

  private async findBoardOrThrow(id: string, authUser: AuthUser) {
    const scopeFilter = buildScopeFilter(authUser);

    const board = await prisma.electricityBoard.findFirst({
      where: { id, ...scopeFilter },
      include: {
        state: true,
        _count: { select: { consumers: true, users: true, reportFormats: true } },
      },
    });

    if (!board) {
      throw new NotFoundError("ElectricityBoard", id);
    }

    return board;
  }
}

export const referenceService = new ReferenceService();
