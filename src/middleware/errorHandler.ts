import type { Request, Response, NextFunction } from "express";
import { AppError, ValidationError } from "../lib/errors.js";
import type { ApiResponse } from "../lib/apiResponse.js";
import { Prisma } from "../generated/prisma/client.js";

/**
 * Global Express error handler.
 * Must be registered LAST in the middleware chain (after all routes).
 *
 * Handles:
 * - AppError subclasses (operational errors) → returns structured JSON
 * - ValidationError → includes field-level details
 * - PrismaClientKnownRequestError → maps Prisma error codes to HTTP responses
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

  // ── Prisma Known Errors ────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaErr = err as Prisma.PrismaClientKnownRequestError;
    console.error("[PRISMA ERROR]", prismaErr.code, prismaErr.message);

    // P2037: Too many connections
    if (prismaErr.code === "P2037") {
      res.status(503).json({
        success: false,
        error: "Database is temporarily overloaded. Please retry in a moment.",
      } satisfies ApiResponse);
      return;
    }

    // P2025: Record not found
    if (prismaErr.code === "P2025") {
      res.status(404).json({
        success: false,
        error: "Requested record not found.",
      } satisfies ApiResponse);
      return;
    }

    // P2002: Unique constraint violation
    if (prismaErr.code === "P2002") {
      res.status(409).json({
        success: false,
        error: "A record with this value already exists.",
      } satisfies ApiResponse);
      return;
    }

    // Fallback for other known Prisma errors
    res.status(400).json({
      success: false,
      error:
        process.env["NODE_ENV"] === "production"
          ? "Database error"
          : prismaErr.message,
    } satisfies ApiResponse);
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

