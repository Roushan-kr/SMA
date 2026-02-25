import { Router, type Router as RouterType } from "express";
import { auditController } from "../controllers/audit.controller.js";
import {
  requireAuth,
  resolveAppUser,
  checkPermission,
  Permission,
} from "../middleware/auth.js";

const router: RouterType = Router();

// All routes require authentication + admin user + audit:read permission
router.use(requireAuth, resolveAppUser(), checkPermission(Permission.AUDIT_READ));

// ═══════════════════════════════════════════════════════════════════════
//  Audit Log Routes
// ═══════════════════════════════════════════════════════════════════════

// GET /export/csv — export audit logs as CSV (must be before /:id)
router.get(
  "/export/csv",
  (req, res, next) => auditController.exportCSV(req, res, next),
);

// GET / — list audit logs (paginated, filtered)
router.get(
  "/",
  (req, res, next) => auditController.list(req, res, next),
);

// GET /:id — get single audit log by ID
router.get(
  "/:id",
  (req, res, next) => auditController.getById(req, res, next),
);

export default router;
