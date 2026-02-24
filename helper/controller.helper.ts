import { BadRequestError } from "../lib/errors.js";

export function requireBody(body: unknown, ...fields: string[]): void {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body is required");
  }
  for (const field of fields) {
    if (!(field in body) || (body as Record<string, unknown>)[field] == null) {
      throw new BadRequestError(`Field '${field}' is required`);
    }
  }
}

export function requireParam(params: Record<string, unknown>, name: string): string {
  const value = params[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestError(`URL parameter '${name}' is required`);
  }
  return value;
}