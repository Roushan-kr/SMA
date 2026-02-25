import type { Request, Response, NextFunction } from "express";
import { consumerService, isValidConsentType } from "../services/consumer.service.js";
import { sendSuccess } from "../lib/apiResponse.js";
import { BadRequestError, UnauthorizedError } from "../lib/errors.js";
import { getAuth } from "@clerk/express";
import type { ConsentType } from "../generated/prisma/client.js";
import { requireBody, requireParam } from "../helper/controller.helper.js";

// ── Controller ───────────────────────────────────────────────────────

export class ConsumerController {
  // ── Self-Service (Consumer-facing) ──────────────────────────────

  /**
   * POST /register
   * Register a new consumer (links Clerk ID automatically).
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireBody(req.body, "name", "address", "stateId", "boardId");

      // Clerk userId from the authenticated session
      const auth = getAuth(req);
      const clerkUserId = auth.userId;
      if (!clerkUserId) {
        throw new UnauthorizedError("No authenticated user found");
      }

      const { name, address, stateId, boardId, phoneNumber } = req.body as {
        name: string;
        address: string;
        stateId: string;
        boardId: string;
        phoneNumber?: string;
      };

      const consumer = await consumerService.registerConsumer(
        { name, address, stateId, boardId, phoneNumber },
        clerkUserId,
      );

      sendSuccess(res, consumer, "Consumer registered successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /me
   * Get the authenticated consumer's own profile.
   */
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const consumer = await consumerService.getConsumerProfile(
        req.appConsumer!.id,
        req.appConsumer!,
      );

      sendSuccess(res, consumer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /me
   * Update the authenticated consumer's own profile.
   */
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, phoneNumber, address } = req.body as {
        name?: string;
        phoneNumber?: string;
        address?: string;
      };

      const updated = await consumerService.updateConsumer(
        req.appConsumer!.id,
        { name, phoneNumber, address },
        req.appConsumer!,
      );

      sendSuccess(res, updated, "Profile updated successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /me/consents
   * Get the authenticated consumer's consent records.
   */
  async getMyConsents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const consents = await consumerService.getConsents(
        req.appConsumer!.id,
        req.appConsumer!,
      );

      sendSuccess(res, consents);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /me/consents/:consentType/grant
   * Grant a specific consent.
   */
  async grantMyConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const consentType = requireParam(req.params, "consentType");
      if (!isValidConsentType(consentType)) {
        throw new BadRequestError(
          `Invalid consent type '${consentType}'. Must be one of: ENERGY_TRACKING, AI_QUERY_PROCESSING`,
        );
      }

      const consent = await consumerService.grantConsent(
        req.appConsumer!.id,
        consentType as ConsentType,
        req.appConsumer!,
      );

      sendSuccess(res, consent, "Consent granted successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /me/consents/:consentType/revoke
   * Revoke a specific consent.
   */
  async revokeMyConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const consentType = requireParam(req.params, "consentType");
      if (!isValidConsentType(consentType)) {
        throw new BadRequestError(
          `Invalid consent type '${consentType}'. Must be one of: ENERGY_TRACKING, AI_QUERY_PROCESSING`,
        );
      }

      const consent = await consumerService.revokeConsent(
        req.appConsumer!.id,
        consentType as ConsentType,
        req.appConsumer!,
      );

      sendSuccess(res, consent, "Consent revoked successfully");
    } catch (error) {
      next(error);
    }
  }

  // ── Admin Operations ────────────────────────────────────────────

  /**
   * GET /
   * List consumers with pagination and filters (admin only).
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stateId, boardId, search, page, limit } = req.query as {
        stateId?: string;
        boardId?: string;
        search?: string;
        page?: string;
        limit?: string;
      };

      const result = await consumerService.listConsumers(
        {
          stateId,
          boardId,
          search,
          page: page ? parseInt(page, 10) : undefined,
          limit: limit ? parseInt(limit, 10) : undefined,
        },
        req.appUser!,
      );

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /:consumerId
   * Get a single consumer by ID (admin, scope-checked).
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const consumerId = requireParam(req.params, "consumerId");

      const consumer = await consumerService.getConsumerProfile(consumerId, req.appUser!);

      sendSuccess(res, consumer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /:consumerId
   * Update a consumer (admin, scope-checked).
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const consumerId = requireParam(req.params, "consumerId");

      const { name, phoneNumber, address } = req.body as {
        name?: string;
        phoneNumber?: string;
        address?: string;
      };

      const updated = await consumerService.updateConsumer(
        consumerId,
        { name, phoneNumber, address },
        req.appUser!,
      );

      sendSuccess(res, updated, "Consumer updated successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /:consumerId
   * Delete a consumer (admin only).
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const consumerId = requireParam(req.params, "consumerId");

      const result = await consumerService.deleteConsumer(consumerId, req.appUser!);

      sendSuccess(res, result, "Consumer deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /:consumerId/consents
   * View a consumer's consents (admin, scope-checked).
   */
  async getConsents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const consumerId = requireParam(req.params, "consumerId");

      const consents = await consumerService.getConsents(consumerId, req.appUser!);

      sendSuccess(res, consents);
    } catch (error) {
      next(error);
    }
  }
}

export const consumerController = new ConsumerController();
