import type { Response } from "express";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
): void {
  const body: ApiResponse<T> = { success: true, data };
  if (message) body.message = message;
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  error: string,
  statusCode = 500,
): void {
  res.status(statusCode).json({ success: false, error } satisfies ApiResponse);
}
