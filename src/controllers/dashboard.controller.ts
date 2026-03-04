import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { sendSuccess } from "../lib/apiResponse.js";
import { buildScopeFilter } from "../helper/service.helper.js";
import { DateTime } from "luxon";

import type { AuthUser } from "../middleware/auth.js";

export class DashboardController {
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.appUser as AuthUser;
      const scope = buildScopeFilter(user);

      // 1. Basic counts (Consumers & Meters)
      const [totalConsumers, totalMeters, activeMeters] = await Promise.all([
        prisma.consumer.count({ where: scope }),
        prisma.smartMeter.count({ where: { consumer: scope } }),
        prisma.smartMeter.count({ where: { status: "ACTIVE", consumer: scope } }),
      ]);

      // 2. Query stats
      const queries = await prisma.customerQuery.groupBy({
        by: ["status"],
        where: { consumer: scope },
        _count: true,
      });

      const queryDistribution = {
        PENDING: 0,
        AI_REVIEWED: 0,
        RESOLVED: 0,
        REJECTED: 0,
      };
      queries.forEach((q) => {
        if (q.status in queryDistribution) {
          (queryDistribution as any)[q.status] = q._count;
        }
      });

      // 3. Billing & Revenue (Last 6 months)
      const now = DateTime.now();
      const sixMonthsAgo = now.minus({ months: 5 }).startOf("month").toJSDate();

      const billingSummary = await prisma.billingReport.findMany({
        where: {
          isLatest: true,
          billingEnd: { gte: sixMonthsAgo },
          meter: { consumer: scope },
        },
        select: {
          totalAmount: true,
          totalUnits: true,
          billingEnd: true,
        },
      });

      // Aggregate by month
      const monthlyData: Record<string, { revenue: number; consumption: number }> = {};
      // Initialize buckets
      for (let i = 5; i >= 0; i--) {
        const m = now.minus({ months: i }).toFormat("MMM");
        monthlyData[m] = { revenue: 0, consumption: 0 };
      }

      billingSummary.forEach((b) => {
        const m = DateTime.fromJSDate(b.billingEnd).toFormat("MMM");
        const bucket = monthlyData[m];
        if (bucket) {
          bucket.revenue += b.totalAmount;
          bucket.consumption += b.totalUnits;
        }
      });

      const totalRevenue = billingSummary.reduce((sum, b) => sum + b.totalAmount, 0);

      const stats = {
        totalConsumers,
        totalMeters,
        activeMeters,
        totalRevenue,
        pendingQueries: queryDistribution.PENDING,
        resolvedQueries: queryDistribution.RESOLVED,
        aiReviewedQueries: queryDistribution.AI_REVIEWED,
        rejectedQueries: queryDistribution.REJECTED,
        monthlyStats: Object.entries(monthlyData).map(([month, data]) => ({
          month,
          revenue: data.revenue,
          consumption: data.consumption,
        })),
        queryDistribution,
      };

      sendSuccess(res, stats, "Dashboard statistics retrieved successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
