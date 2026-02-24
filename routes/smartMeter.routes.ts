import { Router, type Router as RouterType } from "express";
import { smartMeterController } from "../controllers/smartMeter.controller.js";
import { requireAuth, resolveAppUser, checkPermission, Permission } from "../middleware/auth.js";

const router: RouterType = Router();

// All routes require authentication + user resolution
router.use(requireAuth, resolveAppUser());

// ── Routes ───────────────────────────────────────────────────────────

// POST   /                         → Create a new meter
router.post(
  "/",
  checkPermission(Permission.METER_CREATE),
  (req, res, next) => smartMeterController.create(req, res, next),
);

// PATCH  /:meterId/assign          → Assign meter to consumer
router.patch(
  "/:meterId/assign",
  checkPermission(Permission.METER_ASSIGN),
  (req, res, next) => smartMeterController.assign(req, res, next),
);

// GET    /:meterId                  → Get meter by ID
router.get(
  "/:meterId",
  checkPermission(Permission.METER_READ),
  (req, res, next) => smartMeterController.getById(req, res, next),
);

// GET    /consumer/:consumerId      → Get all meters for a consumer
router.get(
  "/consumer/:consumerId",
  checkPermission(Permission.METER_READ),
  (req, res, next) => smartMeterController.getByConsumer(req, res, next),
);

// PATCH  /:meterId/status           → Update meter status
router.patch(
  "/:meterId/status",
  checkPermission(Permission.METER_UPDATE),
  (req, res, next) => smartMeterController.updateStatus(req, res, next),
);

// GET    /:meterId/consumption      → Get consumption summary
router.get(
  "/:meterId/consumption",
  checkPermission(Permission.METER_READ),
  (req, res, next) => smartMeterController.getConsumptionSummary(req, res, next),
);

export default router;
