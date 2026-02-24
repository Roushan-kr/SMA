import { Router, type Router as RouterType } from "express";
import { referenceController } from "../controllers/reference.controller.js";
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
//  State Routes
// ═══════════════════════════════════════════════════════════════════════

// POST /states — create a state (user:manage → SUPER_ADMIN enforced in service)
router.post(
  "/states",
  checkPermission(Permission.USER_MANAGE),
  (req, res, next) => referenceController.createState(req, res, next),
);

// GET /states — list states (scope-filtered)
router.get(
  "/states",
  (req, res, next) => referenceController.listStates(req, res, next),
);

// ═══════════════════════════════════════════════════════════════════════
//  Electricity Board Routes
// ═══════════════════════════════════════════════════════════════════════

// POST /boards — create a board (user:manage)
router.post(
  "/boards",
  checkPermission(Permission.USER_MANAGE),
  (req, res, next) => referenceController.createBoard(req, res, next),
);

// GET /boards — list boards (scope-filtered)
router.get(
  "/boards",
  (req, res, next) => referenceController.listBoards(req, res, next),
);

// GET /boards/:id — get board by ID
router.get(
  "/boards/:id",
  (req, res, next) => referenceController.getBoardById(req, res, next),
);

// PATCH /boards/:id — update a board (user:manage)
router.patch(
  "/boards/:id",
  checkPermission(Permission.USER_MANAGE),
  (req, res, next) => referenceController.updateBoard(req, res, next),
);

// DELETE /boards/:id — delete a board (user:manage)
router.delete(
  "/boards/:id",
  checkPermission(Permission.USER_MANAGE),
  (req, res, next) => referenceController.deleteBoard(req, res, next),
);

export default router;
