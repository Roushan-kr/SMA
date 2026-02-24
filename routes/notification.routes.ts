import { Router, type Router as RouterType } from "express";
import { notificationController } from "../controllers/notification.controller.js";
import {
  requireAuth,
  resolveAppUser,
  resolveConsumer,
  checkPermission,
  Permission,
} from "../middleware/auth.js";

const router: RouterType = Router();

// ═══════════════════════════════════════════════════════════════════════
//  Admin Routes
//  Auth: requireAuth + resolveAppUser() + checkPermission()
// ═══════════════════════════════════════════════════════════════════════

// POST / — admin creates a notification for a consumer
router.post(
  "/",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.NOTIFICATION_MANAGE),
  (req, res, next) => notificationController.create(req, res, next),
);

// GET /admin — admin lists notifications (scope-filtered)
router.get(
  "/admin",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.NOTIFICATION_MANAGE),
  (req, res, next) => notificationController.listAdmin(req, res, next),
);

// DELETE /:id — admin deletes a notification
router.delete(
  "/:id",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.NOTIFICATION_MANAGE),
  (req, res, next) => notificationController.remove(req, res, next),
);

// ═══════════════════════════════════════════════════════════════════════
//  Consumer Self-Service Routes
//  Auth: requireAuth + resolveConsumer()
// ═══════════════════════════════════════════════════════════════════════

// GET / — consumer lists their own notifications
router.get(
  "/",
  requireAuth,
  resolveConsumer(),
  (req, res, next) => notificationController.listMine(req, res, next),
);

// PATCH /read-all — consumer marks all notifications as read
router.patch(
  "/read-all",
  requireAuth,
  resolveConsumer(),
  (req, res, next) => notificationController.markAllAsRead(req, res, next),
);

// PATCH /:id/read — consumer marks a single notification as read
router.patch(
  "/:id/read",
  requireAuth,
  resolveConsumer(),
  (req, res, next) => notificationController.markAsRead(req, res, next),
);

export default router;
