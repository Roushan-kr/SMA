import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { BadRequestError } from "../lib/errors.js";

// ── Types ────────────────────────────────────────────────────────────

interface ValidationSchemas {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
}

// ── Middleware ────────────────────────────────────────────────────────

/**
 * Express middleware that validates req.body, req.params, and/or req.query
 * against Zod schemas. On success, replaces request fields with parsed
 * (coerced/stripped) values. On failure, throws BadRequestError.
 *
 * Usage:
 *   router.post("/", validate({ body: createUserSchema }), controller.create);
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) {
          throw new BadRequestError(formatZodError(result.error));
        }
        req.body = result.data;
      }

      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) {
          throw new BadRequestError(formatZodError(result.error));
        }
        req.params = result.data as typeof req.params;
      }

      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) {
          throw new BadRequestError(formatZodError(result.error));
        }
        req.query = result.data as typeof req.query;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Format ZodError into a human-readable string.
 */
function formatZodError(error: z.ZodError): string {
  const messages = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "input";
    return `${path}: ${issue.message}`;
  });

  return `Validation failed: ${messages.join("; ")}`;
}
