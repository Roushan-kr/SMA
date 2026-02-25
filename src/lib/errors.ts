/**
 * Base operational error with HTTP status code.
 * All custom errors should extend this class.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── Specific Error Types ─────────────────────────────────────────────

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    const msg = id ? `${entity} with id '${id}' not found` : `${entity} not found`;
    super(msg, 404);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  public readonly fields: Record<string, string>;

  constructor(message: string, fields: Record<string, string> = {}) {
    super(message, 422);
    this.fields = fields;
  }
}

// ── Prisma Error Mapping ─────────────────────────────────────────────

/**
 * Maps common Prisma error codes to our AppError hierarchy.
 * Call this in service methods when catching Prisma errors.
 */
export function mapPrismaError(error: unknown): AppError {
  if (
    error != null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    const prismaError = error as { code: string; meta?: { target?: string[] } };

    switch (prismaError.code) {
      case "P2002": {
        const fields = prismaError.meta?.target?.join(", ") ?? "unknown field";
        return new ConflictError(`Unique constraint violation on: ${fields}`);
      }
      case "P2025":
        return new NotFoundError("Record");
      case "P2003":
        return new BadRequestError("Related record not found (foreign key constraint)");
      case "P2014":
        return new BadRequestError("Required relation violation");
      default:
        return new AppError(`Database error: ${prismaError.code}`, 500);
    }
  }

  if (error instanceof AppError) return error;

  return new AppError(
    error instanceof Error ? error.message : "An unexpected error occurred",
    500,
    false,
  );
}
