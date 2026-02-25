import type { Request, Response, NextFunction } from "express";
import { userService, isValidRole, isValidConsentType } from "../services/user.service.js";
import { sendSuccess } from "../lib/apiResponse.js";
import { BadRequestError } from "../lib/errors.js";
import { requireBody, requireParam } from "../helper/controller.helper.js";
import type { RoleType, ConsentType } from "../generated/prisma/client.js";

// ── Controller ───────────────────────────────────────────────────────

export class UserController {
  /**
   * POST /
   * Create a new admin user.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireBody(req.body, "name", "role");

      const { name, email, phone, role, stateId, boardId } = req.body as {
        name: string;
        email?: string;
        phone?: string;
        role: string;
        stateId?: string;
        boardId?: string;
      };

      if (!isValidRole(role)) {
        throw new BadRequestError(
          `Invalid role '${role}'. Must be one of: SUPER_ADMIN, STATE_ADMIN, BOARD_ADMIN, SUPPORT_AGENT, AUDITOR`,
        );
      }

      const user = await userService.createAdminUser(
        {
          name,
          email,
          phone,
          role: role as RoleType,
          stateId: stateId ?? null,
          boardId: boardId ?? null,
        },
        req.appUser!,
      );

      sendSuccess(res, user, "User created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /
   * List users (paginated, scope-filtered).
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { role, page, limit } = req.query as {
        role?: string;
        page?: string;
        limit?: string;
      };

      if (role && !isValidRole(role)) {
        throw new BadRequestError(
          `Invalid role '${role}'. Must be one of: SUPER_ADMIN, STATE_ADMIN, BOARD_ADMIN, SUPPORT_AGENT, AUDITOR`,
        );
      }

      const result = await userService.listUsers(req.appUser!, {
        role: role as RoleType | undefined,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /:id
   * Get a single user by ID.
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");

      const user = await userService.getUserById(id, req.appUser!);

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /:id/role
   * Update a user's role.
   */
  async updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");
      requireBody(req.body, "role");

      const { role } = req.body as { role: string };

      if (!isValidRole(role)) {
        throw new BadRequestError(
          `Invalid role '${role}'. Must be one of: SUPER_ADMIN, STATE_ADMIN, BOARD_ADMIN, SUPPORT_AGENT, AUDITOR`,
        );
      }

      const updated = await userService.updateUserRole(id, role as RoleType, req.appUser!);

      sendSuccess(res, updated, "User role updated successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /:id/scope
   * Update a user's scope (stateId / boardId).
   */
  async updateScope(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");

      const { stateId, boardId } = req.body as {
        stateId?: string;
        boardId?: string;
      };

      const updated = await userService.updateUserScope(
        id,
        stateId,
        boardId,
        req.appUser!,
      );

      sendSuccess(res, updated, "User scope updated successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /:id
   * Delete a user.
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");

      const result = await userService.deleteUser(id, req.appUser!);

      sendSuccess(res, result, "User deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  // ── Consent Management ──────────────────────────────────────────

  /**
   * GET /:id/consents
   * List consents for a user.
   */
  async listConsents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");

      const consents = await userService.listUserConsents(id, req.appUser!);

      sendSuccess(res, consents);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /:id/consents
   * Update a consent for a user.
   */
  async updateConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");
      requireBody(req.body, "consentType", "granted");

      const { consentType, granted } = req.body as {
        consentType: string;
        granted: boolean;
      };

      if (!isValidConsentType(consentType)) {
        throw new BadRequestError(
          `Invalid consentType '${consentType}'. Must be one of: ENERGY_TRACKING, AI_QUERY_PROCESSING`,
        );
      }

      const consent = await userService.updateUserConsent(
        id,
        consentType as ConsentType,
        granted,
        req.appUser!,
      );

      sendSuccess(res, consent, granted ? "Consent granted" : "Consent revoked");
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
