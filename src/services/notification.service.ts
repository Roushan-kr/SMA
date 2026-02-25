import { prisma } from "../lib/prisma.js";
import type { AuthUser, AuthConsumer } from "../middleware/auth.js";
import { NotFoundError, ForbiddenError, mapPrismaError } from "../lib/errors.js";
import { buildScopeFilter } from "../helper/service.helper.js";

// ── Types ────────────────────────────────────────────────────────────

export interface CreateNotificationInput {
  consumerId: string;
  title: string;
  message: string;
  type: string;
}

export interface ListNotificationsFilter {
  page?: number | undefined;
  limit?: number | undefined;
  isRead?: boolean | undefined;
}

const VALID_NOTIFICATION_TYPES = [
  "BILL_GENERATED",
  "QUERY_REPLY",
  "METER_ALERT",
  "GENERAL",
] as const;

export type NotificationType = (typeof VALID_NOTIFICATION_TYPES)[number];

export function isValidNotificationType(value: string): value is NotificationType {
  return VALID_NOTIFICATION_TYPES.includes(value as NotificationType);
}

// ── Scope Helper ─────────────────────────────────────────────────────

function buildNotificationScopeFilter(user: AuthUser) {
  const base = buildScopeFilter(user);
  if (Object.keys(base).length === 0) return {};
  return { consumer: base };
}

// ── Service ──────────────────────────────────────────────────────────

export class NotificationService {
  /**
   * Create a notification for a consumer (admin only).
   */
  async createNotification(input: CreateNotificationInput, authUser: AuthUser) {
    try {
      // Verify consumer exists and is within admin's scope
      const scopeFilter = buildScopeFilter(authUser);
      const consumer = await prisma.consumer.findFirst({
        where: { id: input.consumerId, ...scopeFilter },
        select: { id: true },
      });

      if (!consumer) {
        throw new NotFoundError("Consumer", input.consumerId);
      }

      const notification = await prisma.notification.create({
        data: {
          consumerId: input.consumerId,
          title: input.title,
          message: input.message,
          type: input.type,
        },
        include: { consumer: true },
      });

      return notification;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * List notifications for the authenticated consumer (self-service).
   */
  async listNotificationsForConsumer(
    consumerId: string,
    filters: ListNotificationsFilter,
  ) {
    try {
      const page = filters.page ?? 1;
      const limit = Math.min(filters.limit ?? 20, 100);
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = { consumerId };
      if (filters.isRead !== undefined) where["isRead"] = filters.isRead;

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.notification.count({ where }),
      ]);

      return {
        data: notifications,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * List notifications with admin scope filtering.
   */
  async listNotificationsForAdmin(
    authUser: AuthUser,
    filters: ListNotificationsFilter,
  ) {
    try {
      const scopeFilter = buildNotificationScopeFilter(authUser);
      const page = filters.page ?? 1;
      const limit = Math.min(filters.limit ?? 20, 100);
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = { ...scopeFilter };
      if (filters.isRead !== undefined) where["isRead"] = filters.isRead;

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          include: { consumer: true },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.notification.count({ where }),
      ]);

      return {
        data: notifications,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Mark a single notification as read (consumer only).
   */
  async markAsRead(notificationId: string, consumer: AuthConsumer) {
    try {
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { id: true, consumerId: true },
      });

      if (!notification) {
        throw new NotFoundError("Notification", notificationId);
      }

      if (notification.consumerId !== consumer.id) {
        throw new ForbiddenError("You can only mark your own notifications as read");
      }

      const updated = await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });

      return updated;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Mark all notifications as read for the authenticated consumer.
   */
  async markAllAsRead(consumer: AuthConsumer) {
    try {
      const result = await prisma.notification.updateMany({
        where: { consumerId: consumer.id, isRead: false },
        data: { isRead: true },
      });

      return { updated: result.count };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Delete a notification (admin only, scope-checked).
   */
  async deleteNotification(notificationId: string, authUser: AuthUser) {
    try {
      const scopeFilter = buildNotificationScopeFilter(authUser);

      const notification = await prisma.notification.findFirst({
        where: { id: notificationId, ...scopeFilter },
        select: { id: true },
      });

      if (!notification) {
        throw new NotFoundError("Notification", notificationId);
      }

      await prisma.notification.delete({ where: { id: notification.id } });

      return { deleted: true, id: notification.id };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}

export const notificationService = new NotificationService();
