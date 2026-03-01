import { Router, type Router as RouterType } from "express";
import { smartMeterController } from "../controllers/smartMeter.controller.js";
import {
  requireAuth,
  resolveAppUser,
  resolveConsumer,
  checkPermission,
  Permission,
} from "../middleware/auth.js";

const router: RouterType = Router();

// ═══════════════════════════════════════════════════════════════════════
//  Consumer Self-Service Routes
//  Auth: requireAuth + resolveConsumer()
//  NOTE: these must be registered BEFORE the /:meterId param route
// ═══════════════════════════════════════════════════════════════════════

// GET /my-meters — list all meters belonging to the signed-in consumer
router.get(
  "/my-meters",
  requireAuth,
  resolveConsumer(),
  (req, res, next) => smartMeterController.getMyMeters(req, res, next),
);

// GET /my-meters/:meterId/consumption — consumption summary for own meter
router.get(
  "/my-meters/:meterId/consumption",
  requireAuth,
  resolveConsumer(),
  (req, res, next) => smartMeterController.getMyMeterConsumption(req, res, next),
);

// ═══════════════════════════════════════════════════════════════════════
//  Admin Routes
//  Auth: requireAuth + resolveAppUser() + checkPermission()
//  NOTE: /consumer/:consumerId MUST be before /:meterId to avoid
//  Express treating "consumer" as a meterId param value.
// ═══════════════════════════════════════════════════════════════════════

// GET /consumer/:consumerId — list all meters for a specific consumer (admin)
router.get(
  "/consumer/:consumerId",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.METER_READ),
  (req, res, next) => smartMeterController.getByConsumer(req, res, next),
);

// POST / — create a new meter
router.post(
  "/",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.METER_CREATE),
  (req, res, next) => smartMeterController.create(req, res, next),
);

// PATCH /:meterId/assign — assign meter to consumer
router.patch(
  "/:meterId/assign",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.METER_ASSIGN),
  (req, res, next) => smartMeterController.assign(req, res, next),
);

// PATCH /:meterId/status — update meter status
router.patch(
  "/:meterId/status",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.METER_UPDATE),
  (req, res, next) => smartMeterController.updateStatus(req, res, next),
);

// GET /:meterId/consumption — consumption summary (admin)
router.get(
  "/:meterId/consumption",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.METER_READ),
  (req, res, next) => smartMeterController.getConsumptionSummary(req, res, next),
);

// GET /:meterId — get meter by ID (LAST — catches all remaining /:id patterns)
router.get(
  "/:meterId",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.METER_READ),
  (req, res, next) => smartMeterController.getById(req, res, next),
);

export default router;
