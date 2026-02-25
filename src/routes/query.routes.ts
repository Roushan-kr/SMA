import { Router, type Router as RouterType } from "express";
import { queryController } from "../controllers/query.controller.js";
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
// ═══════════════════════════════════════════════════════════════════════

// POST / — consumer submits a new query
router.post(
  "/",
  requireAuth,
  resolveConsumer(),
  (req, res, next) => queryController.create(req, res, next),
);

// GET /me — consumer lists their own queries
router.get(
  "/me",
  requireAuth,
  resolveConsumer(),
  (req, res, next) => queryController.listMine(req, res, next),
);

// ═══════════════════════════════════════════════════════════════════════
//  Admin Routes
//  Auth: requireAuth + resolveAppUser() + checkPermission()
// ═══════════════════════════════════════════════════════════════════════

// GET / — admin lists all queries (paginated, filtered)
router.get(
  "/",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.QUERY_MANAGE),
  (req, res, next) => queryController.list(req, res, next),
);

// PATCH /:id/status — admin updates query status
router.patch(
  "/:id/status",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.QUERY_MANAGE),
  (req, res, next) => queryController.updateStatus(req, res, next),
);

// PATCH /:id/reply — admin replies to a query
router.patch(
  "/:id/reply",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.QUERY_MANAGE),
  (req, res, next) => queryController.reply(req, res, next),
);

// DELETE /:id — admin deletes a query
router.delete(
  "/:id",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.QUERY_MANAGE),
  (req, res, next) => queryController.remove(req, res, next),
);

// ═══════════════════════════════════════════════════════════════════════
//  AI Agent Routes
//  Auth: requireAuth + resolveAppUser() + checkPermission(query:manage)
// ═══════════════════════════════════════════════════════════════════════

// GET /ai/pending — fetch PENDING queries for AI processing
router.get(
  "/ai/pending",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.QUERY_MANAGE),
  (req, res, next) => queryController.fetchPendingForAi(req, res, next),
);

// PATCH /:id/ai-classify — AI classifies a query (PENDING → AI_REVIEWED)
router.patch(
  "/:id/ai-classify",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.QUERY_MANAGE),
  (req, res, next) => queryController.classifyQueryWithAi(req, res, next),
);

// PATCH /:id/ai-resolve — AI auto-resolves (classify + reply + RESOLVED)
router.patch(
  "/:id/ai-resolve",
  requireAuth,
  resolveAppUser(),
  checkPermission(Permission.QUERY_MANAGE),
  (req, res, next) => queryController.autoResolveQueryWithAi(req, res, next),
);

// ═══════════════════════════════════════════════════════════════════════
//  Shared Route (consumer or admin)
//  Tries consumer auth first; falls back to admin if no appConsumer.
// ═══════════════════════════════════════════════════════════════════════

// GET /:id — get query by ID (consumer sees own, admin scope-checked)
router.get(
  "/:id",
  requireAuth,
  async (req, res, next) => {
    try {
      await new Promise<void>((resolve, reject) => {
        resolveConsumer()(req, res, (err?: unknown) => {
          if (err) reject(err);
          else resolve();
        });
      });
      next();
    } catch {
      resolveAppUser()(req, res, next);
    }
  },
  (req, res, next) => queryController.getById(req, res, next),
);

export default router;
