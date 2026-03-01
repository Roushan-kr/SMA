import { Router, type Router as RouterType } from "express";
import { userController } from "../controllers/user.controller.js";
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
//  User Management Routes
// ═══════════════════════════════════════════════════════════════════════

// POST / — create a new admin user (user:manage)
router.post(
  "/",
  checkPermission(Permission.USER_MANAGE),
  (req, res, next) => userController.create(req, res, next),
);

// GET / — list users (scope-filtered)
router.get(
  "/",
  (req, res, next) => userController.list(req, res, next),
);

// GET /me — get the signed-in user's own profile (token-based)
router.get(
  "/me",
  (req, res, next) => userController.getMe(req, res, next),
);

// GET /me/consents — get the signed-in user's own consents
router.get(
  "/me/consents",
  (req, res, next) => userController.listMeConsents(req, res, next),
);

// GET /:id — get user by ID
router.get(
  "/:id",
  (req, res, next) => userController.getById(req, res, next),
);

// PATCH /:id/role — update user role (user:manage)
router.patch(
  "/:id/role",
  checkPermission(Permission.USER_MANAGE),
  (req, res, next) => userController.updateRole(req, res, next),
);

// PATCH /:id/scope — update user scope (user:manage)
router.patch(
  "/:id/scope",
  checkPermission(Permission.USER_MANAGE),
  (req, res, next) => userController.updateScope(req, res, next),
);

// DELETE /:id — delete user (user:manage)
router.delete(
  "/:id",
  checkPermission(Permission.USER_MANAGE),
  (req, res, next) => userController.remove(req, res, next),
);

// ═══════════════════════════════════════════════════════════════════════
//  User Consent Routes
// ═══════════════════════════════════════════════════════════════════════

// GET /:id/consents — list consents for a user
router.get(
  "/:id/consents",
  (req, res, next) => userController.listConsents(req, res, next),
);

// PATCH /:id/consents — update consent for a user
router.patch(
  "/:id/consents",
  (req, res, next) => userController.updateConsent(req, res, next),
);

export default router;
