import type { Request, Response, NextFunction } from "express";
import { AppError, ValidationError } from "../lib/errors.js";
import type { ApiResponse } from "../lib/apiResponse.js";

/**
 * Global Express error handler.
 * Must be registered LAST in the middleware chain (after all routes).
 *
 * Handles:
 * - AppError subclasses (operational errors) → returns structured JSON
 * - ValidationError → includes field-level details
 * - Unknown / programmer errors → generic 500 with no leak
 */
export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ── Operational Errors (expected) ──────────────────────────────────
  if (err instanceof ValidationError) {
    const body: ApiResponse & { fields?: Record<string, string> } = {
      success: false,
      error: err.message,
      ...(Object.keys(err.fields).length > 0 ? { fields: err.fields } : {}),
    };
    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof AppError) {
    const body: ApiResponse = {
      success: false,
      error: err.message,
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // ── Unknown / Programmer Errors ────────────────────────────────────
  console.error("[UNHANDLED ERROR]", err);

  const body: ApiResponse = {
    success: false,
    error:
      process.env["NODE_ENV"] === "production"
        ? "Internal server error"
        : err instanceof Error
          ? err.message
          : "Unknown error",
  };

  res.status(500).json(body);
}
