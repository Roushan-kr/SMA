import type { Request, Response, NextFunction } from "express";
import { referenceService } from "../services/reference.service.js";
import { sendSuccess } from "../lib/apiResponse.js";
import { requireBody, requireParam } from "../helper/controller.helper.js";

// ── Controller ───────────────────────────────────────────────────────

export class ReferenceController {
  // ══════════════════════════════════════════════════════════════════
  //  State Endpoints
  // ══════════════════════════════════════════════════════════════════

  /**
   * POST /states
   */
  async createState(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireBody(req.body, "name", "code");

      const { name, code } = req.body as { name: string; code: string };

      const state = await referenceService.createState({ name, code }, req.appUser!);

      sendSuccess(res, state, "State created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /states
   */
  async listStates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const states = await referenceService.listStates(req.appUser!);

      sendSuccess(res, states);
    } catch (error) {
      next(error);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  Board Endpoints
  // ══════════════════════════════════════════════════════════════════

  /**
   * POST /boards
   */
  async createBoard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireBody(req.body, "stateId", "name", "code");

      const { stateId, name, code } = req.body as {
        stateId: string;
        name: string;
        code: string;
      };

      const board = await referenceService.createElectricityBoard(
        stateId,
        { name, code },
        req.appUser!,
      );

      sendSuccess(res, board, "Electricity board created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /boards
   */
  async listBoards(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const boards = await referenceService.listBoards(req.appUser!);

      sendSuccess(res, boards);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /boards/:id
   */
  async getBoardById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");

      const board = await referenceService.getBoardById(id, req.appUser!);

      sendSuccess(res, board);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /boards/:id
   */
  async updateBoard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");

      const { name, code } = req.body as {
        name?: string;
        code?: string;
      };

      const updated = await referenceService.updateBoard(
        id,
        { name, code },
        req.appUser!,
      );

      sendSuccess(res, updated, "Board updated successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /boards/:id
   */
  async deleteBoard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");

      const result = await referenceService.deleteBoard(id, req.appUser!);

      sendSuccess(res, result, "Board deleted successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const referenceController = new ReferenceController();
