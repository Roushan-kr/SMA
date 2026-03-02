import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma.js";
import { sendSuccess } from "../lib/apiResponse.js";
import { UnauthorizedError } from "../lib/errors.js";

export class AuthController {
  async sync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = getAuth(req);
      const clerkUserId = auth.userId;

      if (!clerkUserId) {
        throw new UnauthorizedError("No authenticated user found");
      }

      // 1. Try to find as Admin User
      const adminUser = await prisma.user.findUnique({
        where: { clerkUserId },
        include: { state: true, board: true },
      });

      if (adminUser) {
        sendSuccess(res, {
          role: adminUser.role,
          profile: adminUser,
        }, "Admin profile synchronized");
        return;
      }

      // 2. Try to find as Consumer
      const consumer = await prisma.consumer.findUnique({
        where: { clerkUserId },
        include: { state: true, board: true },
      });

      if (consumer) {
        sendSuccess(res, {
          role: "CONSUMER",
          profile: consumer,
        }, "Consumer profile synchronized");
        return;
      }

      // 3. User logged in to Clerk but not in Prisma yet
      sendSuccess(res, {
        role: null,
        profile: null,
      }, "User not registered in local database");
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
