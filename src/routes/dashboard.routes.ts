import { Router, type Router as RouterType } from "express";
import { dashboardController } from "../controllers/dashboard.controller.js";
import { requireAuth, resolveAppUser } from "../middleware/auth.js";

const router: RouterType = Router();

// GET /api/dashboard/stats — aggregate stats for admin dashboards
router.get("/stats", requireAuth, resolveAppUser(), (req, res, next) =>
  dashboardController.getStats(req, res, next)
);

export default router;
