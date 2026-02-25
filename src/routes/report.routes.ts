import { Router, type Router as RouterType } from "express";
import { reportController } from "../controllers/report.controller.js";
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
//  Report Format Routes
// ═══════════════════════════════════════════════════════════════════════

// POST /formats — create a report format template
router.post(
  "/formats",
  checkPermission(Permission.REPORT_GENERATE),
  (req, res, next) => reportController.createFormat(req, res, next),
);

// GET /formats — list report formats (scope-filtered)
router.get(
  "/formats",
  checkPermission(Permission.REPORT_GENERATE),
  (req, res, next) => reportController.listFormats(req, res, next),
);

// ═══════════════════════════════════════════════════════════════════════
//  Report Generation & Management
// ═══════════════════════════════════════════════════════════════════════

// POST /generate — generate a report file
router.post(
  "/generate",
  checkPermission(Permission.REPORT_GENERATE),
  (req, res, next) => reportController.generate(req, res, next),
);

// GET / — list generated reports (paginated, scope-filtered)
router.get(
  "/",
  checkPermission(Permission.REPORT_GENERATE),
  (req, res, next) => reportController.list(req, res, next),
);

// GET /:id/download — download a report file
router.get(
  "/:id/download",
  checkPermission(Permission.REPORT_GENERATE),
  (req, res, next) => reportController.download(req, res, next),
);

// DELETE /:id — delete a generated report
router.delete(
  "/:id",
  checkPermission(Permission.REPORT_GENERATE),
  (req, res, next) => reportController.remove(req, res, next),
);

export default router;
