import type { Request, Response, NextFunction } from "express";
import {
  notificationService,
  isValidNotificationType,
} from "../services/notification.service.js";
import { sendSuccess } from "../lib/apiResponse.js";
import { BadRequestError } from "../lib/errors.js";
import { requireBody, requireParam } from "../helper/controller.helper.js";

// ── Controller ───────────────────────────────────────────────────────

export class NotificationController {
  // ── Admin Operations ────────────────────────────────────────────

  /**
   * POST /
   * Create a notification for a consumer (admin only).
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireBody(req.body, "consumerId", "title", "message", "type");

      const { consumerId, title, message, type } = req.body as {
        consumerId: string;
        title: string;
        message: string;
        type: string;
      };

      if (!isValidNotificationType(type)) {
        throw new BadRequestError(
          `Invalid notification type '${type}'. Must be one of: BILL_GENERATED, QUERY_REPLY, METER_ALERT, GENERAL`,
        );
      }

      const notification = await notificationService.createNotification(
        { consumerId, title, message, type },
        req.appUser!,
      );

      sendSuccess(res, notification, "Notification created successfully", 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET / (admin)
   * List notifications with admin scope filtering.
   */
  async listAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, isRead } = req.query as {
        page?: string;
        limit?: string;
        isRead?: string;
      };

      const result = await notificationService.listNotificationsForAdmin(
        req.appUser!,
        {
          page: page ? parseInt(page, 10) : undefined,
          limit: limit ? parseInt(limit, 10) : undefined,
          isRead: isRead !== undefined ? isRead === "true" : undefined,
        },
      );

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /:id
   * Delete a notification (admin only).
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");

      const result = await notificationService.deleteNotification(id, req.appUser!);

      sendSuccess(res, result, "Notification deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  // ── Consumer Self-Service ───────────────────────────────────────

  /**
   * GET / (consumer)
   * List the authenticated consumer's own notifications.
   */
  async listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, isRead } = req.query as {
        page?: string;
        limit?: string;
        isRead?: string;
      };

      const result = await notificationService.listNotificationsForConsumer(
        req.appConsumer!.id,
        {
          page: page ? parseInt(page, 10) : undefined,
          limit: limit ? parseInt(limit, 10) : undefined,
          isRead: isRead !== undefined ? isRead === "true" : undefined,
        },
      );

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /:id/read
   * Mark a single notification as read (consumer only).
   */
  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params, "id");

      const updated = await notificationService.markAsRead(id, req.appConsumer!);

      sendSuccess(res, updated, "Notification marked as read");
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /read-all
   * Mark all notifications as read (consumer only).
   */
  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await notificationService.markAllAsRead(req.appConsumer!);

      sendSuccess(res, result, "All notifications marked as read");
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
