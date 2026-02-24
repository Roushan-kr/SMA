import { Router, type Router as RouterType } from "express";
import { billingReportController } from "../controllers/billingReport.controller.js";
import {
  requireAuth,
  resolveAppUser,
  resolveConsumer,
  checkPermission,
  Permission,
} from "../middleware/auth.js";

const router: RouterType = Router();

// ═══════════════════════════════════════════════════════════════════════
//  Admin Routes (User role-based access)
//  Auth: requireAuth + resolveAppUser() + checkPermission()
// ═══════════════════════════════════════════════════════════════════════

// POST /generate — generate a billing report for a meter
router.post(
  "/generate",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.BILLING_GENERATE),
  (req, res, next) => billingReportController.generate(req, res, next),
);

// POST /aggregate — build/refresh a consumption aggregate
router.post(
  "/aggregate",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.BILLING_GENERATE),
  (req, res, next) => billingReportController.aggregate(req, res, next),
);

// GET / — list billing reports (paginated, filtered)
router.get(
  "/",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.BILLING_READ),
  (req, res, next) => billingReportController.list(req, res, next),
);

// GET /meter/:meterId/aggregates — get consumption aggregates for a meter
router.get(
  "/meter/:meterId/aggregates",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.BILLING_READ),
  (req, res, next) => billingReportController.getAggregates(req, res, next),
);

// GET /:billId — get a single billing report by ID
router.get(
  "/:billId",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.BILLING_READ),
  (req, res, next) => billingReportController.getById(req, res, next),
);

// POST /:billId/recalculate — recalculate an existing billing report
router.post(
  "/:billId/recalculate",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.BILLING_RECALCULATE),
  (req, res, next) => billingReportController.recalculate(req, res, next),
);

// GET /:billId/recalculations — get recalculation history
router.get(
  "/:billId/recalculations",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.BILLING_READ),
  (req, res, next) => billingReportController.getRecalculations(req, res, next),
);

// ═══════════════════════════════════════════════════════════════════════
//  Consumer Self-Service Route
//  Auth: requireAuth + resolveConsumer()
// ═══════════════════════════════════════════════════════════════════════

// POST /:billId/view — consumer records they viewed a bill
router.post(
  "/:billId/view",
  requireAuth,
  resolveConsumer(),
  (req, res, next) => billingReportController.recordView(req, res, next),
);

export default router;
