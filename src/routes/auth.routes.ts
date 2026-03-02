import { Router, type Router as RouterType } from "express";
import { authController } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router: RouterType = Router();

/**
 * POST /api/auth/sync
 * Identifies the Clerk user in Prisma (Admin vs Consumer)
 * and returns the unified role/profile state.
 */
router.post("/sync", requireAuth, (req, res, next) => authController.sync(req, res, next));

export default router;
