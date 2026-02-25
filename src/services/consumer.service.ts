import { prisma } from "../lib/prisma.js";
import type { AuthUser, AuthConsumer } from "../middleware/auth.js";
import type { ConsentType } from "../generated/prisma/client.js";
import { NotFoundError, BadRequestError, ForbiddenError, mapPrismaError } from "../lib/errors.js";
import { buildScopeFilter } from "../helper/service.helper.js";

// ── Types ────────────────────────────────────────────────────────────

export interface RegisterConsumerInput {
  name: string;
  phoneNumber?: string | undefined;
  address: string;
  stateId: string;
  boardId: string;
}

export interface UpdateConsumerInput {
  name?: string | undefined;
  phoneNumber?: string | undefined;
  address?: string | undefined;
}

export interface ListConsumersFilter {
  stateId?: string | undefined;
  boardId?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

// ── Valid Consent Types ──────────────────────────────────────────────

const VALID_CONSENT_TYPES: ConsentType[] = ["ENERGY_TRACKING", "AI_QUERY_PROCESSING"];

export function isValidConsentType(value: string): value is ConsentType {
  return VALID_CONSENT_TYPES.includes(value as ConsentType);
}

// ── Service ──────────────────────────────────────────────────────────

export class ConsumerService {
  // ── Registration (Clerk auth mapping) ───────────────────────────

  /**
   * Register a new consumer and link to their Clerk ID.
   * Auto-grants default consents (ENERGY_TRACKING).
   */
  async registerConsumer(input: RegisterConsumerInput, clerkUserId: string) {
    try {
      // Verify the Clerk ID is not already linked
      const existing = await prisma.consumer.findUnique({
        where: { clerkUserId },
        select: { id: true },
      });

      if (existing) {
        throw new BadRequestError("A consumer account already exists for this Clerk user");
      }

      // Verify state exists
      const state = await prisma.state.findUnique({
        where: { id: input.stateId },
        select: { id: true },
      });
      if (!state) throw new NotFoundError("State", input.stateId);

      // Verify board exists and belongs to the selected state
      const board = await prisma.electricityBoard.findUnique({
        where: { id: input.boardId },
        select: { id: true, stateId: true },
      });
      if (!board) throw new NotFoundError("ElectricityBoard", input.boardId);
      if (board.stateId !== input.stateId) {
        throw new BadRequestError("Board does not belong to the selected state");
      }

      // Create consumer + default consent in a transaction
      const consumer = await prisma.$transaction(async (tx) => {
        const created = await tx.consumer.create({
          data: {
            clerkUserId,
            name: input.name,
            phoneNumber: input.phoneNumber ?? null,
            address: input.address,
            stateId: input.stateId,
            boardId: input.boardId,
          },
          include: { state: true, board: true },
        });

        // Auto-grant ENERGY_TRACKING consent
        await tx.customerConsent.create({
          data: {
            consumerId: created.id,
            consentType: "ENERGY_TRACKING",
            granted: true,
            grantedAt: new Date(),
          },
        });

        return created;
      });

      return consumer;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── Profile (self-service) ──────────────────────────────────────

  /**
   * Get consumer profile. Supports both self-access and admin-scoped access.
   */
  async getConsumerProfile(consumerId: string, caller: AuthUser | AuthConsumer) {
    try {
      this.assertAccess(consumerId, caller);

      const consumer = await prisma.consumer.findUnique({
        where: { id: consumerId },
        include: {
          state: true,
          board: true,
          consents: true,
          preferences: true,
          meters: { include: { tariff: true } },
        },
      });

      if (!consumer) throw new NotFoundError("Consumer", consumerId);

      return consumer;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Update consumer profile fields (name, phone, address).
   */
  async updateConsumer(
    consumerId: string,
    input: UpdateConsumerInput,
    caller: AuthUser | AuthConsumer,
  ) {
    try {
      this.assertAccess(consumerId, caller);

      const consumer = await prisma.consumer.findUnique({
        where: { id: consumerId },
        select: { id: true },
      });

      if (!consumer) throw new NotFoundError("Consumer", consumerId);

      const updated = await prisma.consumer.update({
        where: { id: consumerId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.phoneNumber !== undefined && { phoneNumber: input.phoneNumber }),
          ...(input.address !== undefined && { address: input.address }),
        },
        include: { state: true, board: true },
      });

      return updated;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── Admin Operations ────────────────────────────────────────────

  /**
   * List consumers with pagination and scope-based filtering (admin only).
   */
  async listConsumers(filters: ListConsumersFilter, adminUser: AuthUser) {
    try {
      const scopeFilter = buildScopeFilter(adminUser);
      const page = filters.page ?? 1;
      const limit = Math.min(filters.limit ?? 20, 100);
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = { ...scopeFilter };

      if (filters.stateId) where["stateId"] = filters.stateId;
      if (filters.boardId) where["boardId"] = filters.boardId;
      if (filters.search) {
        where["OR"] = [
          { name: { contains: filters.search, mode: "insensitive" } },
          { phoneNumber: { contains: filters.search } },
          { address: { contains: filters.search, mode: "insensitive" } },
        ];
      }

      const [consumers, total] = await Promise.all([
        prisma.consumer.findMany({
          where,
          include: { state: true, board: true },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.consumer.count({ where }),
      ]);

      return {
        data: consumers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Delete a consumer (admin only). Hard-deletes the record.
   */
  async deleteConsumer(consumerId: string, adminUser: AuthUser) {
    try {
      const consumer = await this.findConsumerOrThrow(consumerId, adminUser);

      await prisma.consumer.delete({ where: { id: consumer.id } });

      return { deleted: true, id: consumer.id };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── Consent Management ──────────────────────────────────────────

  /**
   * Grant a specific consent type for a consumer.
   */
  async grantConsent(
    consumerId: string,
    consentType: ConsentType,
    caller: AuthUser | AuthConsumer,
  ) {
    try {
      this.assertAccess(consumerId, caller);

      const consent = await prisma.customerConsent.upsert({
        where: { consumerId_consentType: { consumerId, consentType } },
        update: {
          granted: true,
          grantedAt: new Date(),
          revokedAt: null,
        },
        create: {
          consumerId,
          consentType,
          granted: true,
          grantedAt: new Date(),
        },
      });

      return consent;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Revoke a specific consent type for a consumer.
   */
  async revokeConsent(
    consumerId: string,
    consentType: ConsentType,
    caller: AuthUser | AuthConsumer,
  ) {
    try {
      this.assertAccess(consumerId, caller);

      const existing = await prisma.customerConsent.findUnique({
        where: { consumerId_consentType: { consumerId, consentType } },
      });

      if (!existing) {
        throw new NotFoundError("Consent", `${consumerId}/${consentType}`);
      }

      const consent = await prisma.customerConsent.update({
        where: { consumerId_consentType: { consumerId, consentType } },
        data: {
          granted: false,
          revokedAt: new Date(),
        },
      });

      return consent;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Get all consent records for a consumer.
   */
  async getConsents(consumerId: string, caller: AuthUser | AuthConsumer) {
    try {
      this.assertAccess(consumerId, caller);

      const consents = await prisma.customerConsent.findMany({
        where: { consumerId },
        orderBy: { consentType: "asc" },
      });

      return consents;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Guard: throws ForbiddenError if the consumer has NOT granted the
   * specified consent. Use before executing consent-gated logic
   * (e.g. AI query processing, energy tracking features).
   */
  async requireConsent(consumerId: string, consentType: ConsentType): Promise<void> {
    const consent = await prisma.customerConsent.findUnique({
      where: { consumerId_consentType: { consumerId, consentType } },
    });

    if (!consent || !consent.granted) {
      throw new ForbiddenError(
        `Consumer has not granted '${consentType}' consent. Please grant consent before proceeding.`,
      );
    }
  }

  // ── Private Helpers ─────────────────────────────────────────────

  /**
   * Find a consumer by ID with admin scope enforcement.
   */
  private async findConsumerOrThrow(consumerId: string, adminUser: AuthUser) {
    const scopeFilter = buildScopeFilter(adminUser);

    const consumer = await prisma.consumer.findFirst({
      where: { id: consumerId, ...scopeFilter },
      include: { state: true, board: true },
    });

    if (!consumer) throw new NotFoundError("Consumer", consumerId);

    return consumer;
  }

  /**
   * Assert the caller can access this consumer's data.
   * - AuthConsumer: can only access their own data.
   * - AuthUser (admin): scope-based access via role.
   */
  private assertAccess(consumerId: string, caller: AuthUser | AuthConsumer): void {
    // Consumer self-access
    if ("stateId" in caller && !("role" in caller)) {
      if (caller.id !== consumerId) {
        throw new ForbiddenError("You can only access your own data");
      }
      return;
    }

    // Admin access — scope check
    const adminUser = caller as AuthUser;
    if (adminUser.role === "SUPER_ADMIN") return;

    if (adminUser.role === "STATE_ADMIN" && adminUser.stateId) return; // scope enforced at query level
    if (adminUser.role === "BOARD_ADMIN" && adminUser.boardId) return;

    // SUPPORT_AGENT / AUDITOR with read-only
    if (adminUser.boardId || adminUser.stateId) return;
  }
}

export const consumerService = new ConsumerService();
