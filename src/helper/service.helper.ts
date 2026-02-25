import type { AuthUser } from "../middleware/auth.js";

/**
 * Build a Prisma `where` fragment that scopes consumer queries
 * based on the caller's role (board / state scoping).
 */
export function buildScopeFilter(user: AuthUser) {
  if (user.role === "SUPER_ADMIN") return {};
  if (user.role === "STATE_ADMIN" && user.stateId) {
    return { stateId: user.stateId };
  }
  if (user.role === "BOARD_ADMIN" && user.boardId) {
    return { boardId: user.boardId };
  }
  // SUPPORT_AGENT / AUDITOR
  if (user.boardId) return { boardId: user.boardId };
  if (user.stateId) return { stateId: user.stateId };
  return {};
}
