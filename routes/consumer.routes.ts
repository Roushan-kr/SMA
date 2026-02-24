import { Router, type Router as RouterType } from "express";
import { consumerController } from "../controllers/consumer.controller.js";
import {
  requireAuth,
  resolveAppUser,
  resolveConsumer,
  checkPermission,
  Permission,
} from "../middleware/auth.js";

const router: RouterType = Router();

// ═══════════════════════════════════════════════════════════════════════
//  Consumer Self-Service Routes (Clerk → Consumer mapping)
//  Auth: requireAuth + resolveConsumer()
// ═══════════════════════════════════════════════════════════════════════

// POST /register — open to any authenticated Clerk user (no resolveConsumer needed yet)
router.post(
  "/register",
  requireAuth,
  (req, res, next) => consumerController.register(req, res, next),
);

// GET /me — consumer's own profile
router.get(
  "/me",
  requireAuth,
  resolveConsumer(),
  (req, res, next) => consumerController.getProfile(req, res, next),
);

// PATCH /me — update own profile
router.patch(
  "/me",
  requireAuth,
  resolveConsumer(),
  (req, res, next) => consumerController.updateProfile(req, res, next),
);

// GET /me/consents — view own consents
router.get(
  "/me/consents",
  requireAuth,
  resolveConsumer(),
  (req, res, next) => consumerController.getMyConsents(req, res, next),
);

// POST /me/consents/:consentType/grant — grant a consent
router.post(
  "/me/consents/:consentType/grant",
  requireAuth,
  resolveConsumer(),
  (req, res, next) => consumerController.grantMyConsent(req, res, next),
);

// POST /me/consents/:consentType/revoke — revoke a consent
router.post(
  "/me/consents/:consentType/revoke",
  requireAuth,
  resolveConsumer(),
  (req, res, next) => consumerController.revokeMyConsent(req, res, next),
);

// ═══════════════════════════════════════════════════════════════════════
//  Admin Routes (User role-based access)
//  Auth: requireAuth + resolveAppUser() + checkPermission()
// ═══════════════════════════════════════════════════════════════════════

// GET / — list consumers (paginated, filtered)
router.get(
  "/",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.CONSUMER_READ),
  (req, res, next) => consumerController.list(req, res, next),
);

// GET /:consumerId — get consumer by ID
router.get(
  "/:consumerId",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.CONSUMER_READ),
  (req, res, next) => consumerController.getById(req, res, next),
);

// PATCH /:consumerId — update a consumer
router.patch(
  "/:consumerId",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.CONSUMER_UPDATE),
  (req, res, next) => consumerController.update(req, res, next),
);

// DELETE /:consumerId — delete a consumer
router.delete(
  "/:consumerId",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.CONSUMER_DELETE),
  (req, res, next) => consumerController.remove(req, res, next),
);

// GET /:consumerId/consents — view consumer's consents (admin)
router.get(
  "/:consumerId/consents",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.CONSUMER_READ),
  (req, res, next) => consumerController.getConsents(req, res, next),
);

export default router;
