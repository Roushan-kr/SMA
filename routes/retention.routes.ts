import { Router, type Router as RouterType } from "express";
import { retentionController } from "../controllers/retention.controller.js";
import {
  requireAuth,
  resolveAppUser,
  checkPermission,
  Permission,
} from "../middleware/auth.js";

const router: RouterType = Router();

// All routes require authentication + admin user resolution
router.use(requireAuth, resolveAppUser());

// ═══════════════════════════════════════════════════════════════════════
//  Retention Policy Routes
// ═══════════════════════════════════════════════════════════════════════

// POST /cleanup/run — trigger retention cleanup (must be before /:id)
router.post(
  "/cleanup/run",
  checkPermission(Permission.AUDIT_READ),
  (req, res, next) => retentionController.runCleanup(req, res, next),
);

// POST / — create a retention policy
router.post(
  "/",
  checkPermission(Permission.AUDIT_READ),
  (req, res, next) => retentionController.create(req, res, next),
);

// GET / — list retention policies (scope-filtered)
router.get(
  "/",
  checkPermission(Permission.AUDIT_READ),
  (req, res, next) => retentionController.list(req, res, next),
);

// PATCH /:id — update a retention policy
router.patch(
  "/:id",
  checkPermission(Permission.AUDIT_READ),
  (req, res, next) => retentionController.update(req, res, next),
);

// DELETE /:id — delete a retention policy
router.delete(
  "/:id",
  checkPermission(Permission.AUDIT_READ),
  (req, res, next) => retentionController.remove(req, res, next),
);

export default router;
