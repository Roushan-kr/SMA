import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import type { AggregationGranularity } from "../generated/prisma/client.js";
import { NotFoundError, BadRequestError, mapPrismaError } from "../lib/errors.js";
import { buildScopeFilter } from "../helper/service.helper.js";

// ── Types ────────────────────────────────────────────────────────────

export interface GenerateBillInput {
  meterId: string;
  billingStart: string; // ISO 8601
  billingEnd: string;   // ISO 8601
  taxRate?: number | undefined; // e.g. 0.18 for 18%
}

export interface RecalculateInput {
  billingReportId: string;
  reason: string;
}

export interface AggregateInput {
  meterId: string;
  periodStart: string; // ISO 8601
  periodEnd: string;   // ISO 8601
  granularity: AggregationGranularity;
}

export interface ListBillsFilter {
  meterId?: string | undefined;
  consumerId?: string | undefined;
  billingStart?: string | undefined;
  billingEnd?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

const VALID_GRANULARITIES: AggregationGranularity[] = ["HOURLY", "DAILY", "MONTHLY"];

export function isValidGranularity(value: string): value is AggregationGranularity {
  return VALID_GRANULARITIES.includes(value as AggregationGranularity);
}

// ── Meter Scope Helper ───────────────────────────────────────────────

/**
 * Combine the base scope filter with a `consumer` relation path,
 * since BillingReport → SmartMeter → Consumer holds the stateId/boardId.
 */
function buildMeterScopeFilter(user: AuthUser) {
  const base = buildScopeFilter(user);
  if (Object.keys(base).length === 0) return {};
  return { consumer: base };
}

// ── Service ──────────────────────────────────────────────────────────

export class BillingReportService {
  // ── Bill Generation ─────────────────────────────────────────────

  /**
   * Generate a billing report for a meter in a date range.
   *
   * Steps:
   *  1. Validate meter exists & caller has scope access
   *  2. Aggregate MeterReadings in [billingStart, billingEnd]
   *  3. Look up the meter's active tariff
   *  4. Calculate energyCharge, fixedCharge, tax, totalAmount
   *  5. Persist BillingReport with version = 1, isLatest = true
   */
  async generateBill(input: GenerateBillInput, user: AuthUser) {
    try {
      const billingStart = this.parseDate(input.billingStart, "billingStart");
      const billingEnd = this.parseDate(input.billingEnd, "billingEnd");
      this.assertDateRange(billingStart, billingEnd);

      // Verify meter & scope
      const meter = await this.findMeterOrThrow(input.meterId, user);

      // Aggregate consumption from raw readings
      const readings = await prisma.meterReading.findMany({
        where: {
          meterId: meter.id,
          timestamp: { gte: billingStart, lte: billingEnd },
        },
        select: { consumption: true, voltage: true, current: true },
      });

      if (readings.length === 0) {
        throw new BadRequestError(
          "No meter readings found for the specified billing period",
        );
      }

      const totalUnits = readings.reduce((sum, r) => sum + r.consumption, 0);

      // Look up the tariff linked to this meter
      const tariff = await prisma.tariff.findUnique({
        where: { id: meter.tariffId },
      });

      if (!tariff) {
        throw new NotFoundError("Tariff", meter.tariffId);
      }

      // Calculate charges
      const energyCharge = this.round(totalUnits * tariff.unitRate);
      const fixedCharge = this.round(tariff.fixedCharge);
      const subtotal = energyCharge + fixedCharge;
      const taxRate = input.taxRate ?? 0;
      const taxAmount = this.round(subtotal * taxRate);
      const totalAmount = this.round(subtotal + taxAmount);

      // Persist the billing report
      const report = await prisma.billingReport.create({
        data: {
          meterId: meter.id,
          tariffId: tariff.id,
          billingStart,
          billingEnd,
          totalUnits: this.round(totalUnits),
          energyCharge,
          fixedCharge,
          taxAmount,
          totalAmount,
          version: 1,
          isLatest: true,
        },
        include: { meter: { include: { consumer: true } }, tariff: true },
      });

      return report;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── Recalculation ───────────────────────────────────────────────

  /**
   * Recalculate an existing billing report.
   *
   * Steps:
   *  1. Find the existing report, mark it as `isLatest = false`
   *  2. Re-aggregate readings for the same period
   *  3. Create a new BillingReport with version + 1
   *  4. Log the recalculation in RecalculationLog
   */
  async recalculateBill(input: RecalculateInput, user: AuthUser) {
    try {
      const existing = await prisma.billingReport.findUnique({
        where: { id: input.billingReportId },
        include: { meter: { include: { consumer: true } }, tariff: true },
      });

      if (!existing) {
        throw new NotFoundError("BillingReport", input.billingReportId);
      }

      // Scope check via meter → consumer
      this.assertMeterScope(user, existing.meter);

      // Re-aggregate readings
      const readings = await prisma.meterReading.findMany({
        where: {
          meterId: existing.meterId,
          timestamp: { gte: existing.billingStart, lte: existing.billingEnd },
        },
        select: { consumption: true },
      });

      const totalUnits = readings.reduce((sum, r) => sum + r.consumption, 0);
      const energyCharge = this.round(totalUnits * existing.tariff.unitRate);
      const fixedCharge = this.round(existing.tariff.fixedCharge);
      const subtotal = energyCharge + fixedCharge;
      const taxAmount = existing.taxAmount
        ? this.round(subtotal * (existing.taxAmount / (existing.energyCharge + existing.fixedCharge)))
        : 0;
      const totalAmount = this.round(subtotal + taxAmount);

      const newVersion = existing.version + 1;

      // Transaction: mark old as not latest, create new, log recalc
      const result = await prisma.$transaction(async (tx) => {
        await tx.billingReport.update({
          where: { id: existing.id },
          data: { isLatest: false },
        });

        const newReport = await tx.billingReport.create({
          data: {
            meterId: existing.meterId,
            tariffId: existing.tariffId,
            billingStart: existing.billingStart,
            billingEnd: existing.billingEnd,
            totalUnits: this.round(totalUnits),
            energyCharge,
            fixedCharge,
            taxAmount,
            totalAmount,
            version: newVersion,
            isLatest: true,
          },
          include: { meter: { include: { consumer: true } }, tariff: true },
        });

        await tx.recalculationLog.create({
          data: {
            billingReportId: newReport.id,
            reason: input.reason,
            triggeredBy: user.id,
            previousVersion: existing.version,
            newVersion,
          },
        });

        return newReport;
      });

      return result;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── Consumption Aggregation ─────────────────────────────────────

  /**
   * Build or refresh a ConsumptionAggregate row for a meter.
   * Aggregates raw MeterReadings into the given granularity bucket.
   */
  async aggregateConsumption(input: AggregateInput, user: AuthUser) {
    try {
      const periodStart = this.parseDate(input.periodStart, "periodStart");
      const periodEnd = this.parseDate(input.periodEnd, "periodEnd");
      this.assertDateRange(periodStart, periodEnd);

      const meter = await this.findMeterOrThrow(input.meterId, user);

      const readings = await prisma.meterReading.findMany({
        where: {
          meterId: meter.id,
          timestamp: { gte: periodStart, lte: periodEnd },
        },
        select: { consumption: true, voltage: true, current: true },
      });

      const totalUnits = readings.reduce((sum, r) => sum + r.consumption, 0);
      const voltages = readings.map((r) => r.voltage).filter((v): v is number => v != null);
      const currents = readings.map((r) => r.current).filter((c): c is number => c != null);

      const maxDemand = currents.length > 0 ? Math.max(...currents) : null;
      const avgVoltage =
        voltages.length > 0
          ? this.round(voltages.reduce((a, b) => a + b, 0) / voltages.length)
          : null;

      const aggregate = await prisma.consumptionAggregate.upsert({
        where: {
          meterId_periodStart_granularity: {
            meterId: meter.id,
            periodStart,
            granularity: input.granularity,
          },
        },
        update: {
          periodEnd,
          totalUnits: this.round(totalUnits),
          maxDemand,
          avgVoltage,
        },
        create: {
          meterId: meter.id,
          periodStart,
          periodEnd,
          granularity: input.granularity,
          totalUnits: this.round(totalUnits),
          maxDemand,
          avgVoltage,
        },
      });

      return aggregate;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── Read Operations ─────────────────────────────────────────────

  /**
   * Get a single billing report by ID (scope-checked).
   */
  async getBillById(billId: string, user: AuthUser) {
    try {
      const scopeFilter = buildMeterScopeFilter(user);

      const report = await prisma.billingReport.findFirst({
        where: { id: billId, meter: { ...scopeFilter } },
        include: {
          meter: { include: { consumer: true } },
          tariff: true,
          recalculations: { orderBy: { createdAt: "desc" } },
        },
      });

      if (!report) throw new NotFoundError("BillingReport", billId);

      return report;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * List billing reports with pagination and filters (admin, scope-based).
   */
  async listBills(filters: ListBillsFilter, user: AuthUser) {
    try {
      const meterScope = buildMeterScopeFilter(user);
      const page = filters.page ?? 1;
      const limit = Math.min(filters.limit ?? 20, 100);
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {
        isLatest: true,
        meter: { ...meterScope },
      };

      if (filters.meterId) where["meterId"] = filters.meterId;
      if (filters.consumerId) {
        where["meter"] = { ...meterScope, consumerId: filters.consumerId };
      }
      if (filters.billingStart) {
        where["billingStart"] = { gte: new Date(filters.billingStart) };
      }
      if (filters.billingEnd) {
        where["billingEnd"] = { lte: new Date(filters.billingEnd) };
      }

      const [reports, total] = await Promise.all([
        prisma.billingReport.findMany({
          where,
          include: { meter: { include: { consumer: true } }, tariff: true },
          orderBy: { generatedAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.billingReport.count({ where }),
      ]);

      return {
        data: reports,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Get consumption aggregates for a meter (scope-checked).
   */
  async getAggregates(
    meterId: string,
    granularity: AggregationGranularity | undefined,
    user: AuthUser,
  ) {
    try {
      const meter = await this.findMeterOrThrow(meterId, user);

      const where: Record<string, unknown> = { meterId: meter.id };
      if (granularity) where["granularity"] = granularity;

      const aggregates = await prisma.consumptionAggregate.findMany({
        where,
        orderBy: { periodStart: "desc" },
      });

      return aggregates;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── Consumer Self-Service ────────────────────────────────────────

  /**
   * List billing reports for meters owned by a specific consumer.
   * Used by consumer self-service (no admin scope needed).
   */
  async listConsumerBills(filters: {
    consumerId: string;
    meterId?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const page = filters.page ?? 1;
      const limit = Math.min(filters.limit ?? 20, 50);
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {
        isLatest: true,
        meter: { consumerId: filters.consumerId },
      };

      if (filters.meterId) {
        where["meterId"] = filters.meterId;
      }

      const [reports, total] = await Promise.all([
        prisma.billingReport.findMany({
          where,
          include: { meter: true, tariff: true },
          orderBy: { generatedAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.billingReport.count({ where }),
      ]);

      return {
        data: reports,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Get a single billing report, verifying it belongs to the consumer's meter.
   */
  async getConsumerBillById(billId: string, consumerId: string) {
    try {
      const report = await prisma.billingReport.findFirst({
        where: {
          id: billId,
          meter: { consumerId },
        },
        include: { meter: true, tariff: true },
      });

      if (!report) throw new NotFoundError("BillingReport", billId);

      return report;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Record that a consumer has viewed a billing report.
   */
  async recordBillView(billingReportId: string, consumerId: string) {
    try {
      const report = await prisma.billingReport.findUnique({
        where: { id: billingReportId },
        select: { id: true },
      });

      if (!report) throw new NotFoundError("BillingReport", billingReportId);

      const view = await prisma.customerBillView.create({
        data: {
          billingReportId,
          consumerId,
          viewedAt: new Date(),
        },
      });

      return view;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Get recalculation history for a specific billing report.
   */
  async getRecalculationHistory(billId: string, user: AuthUser) {
    try {
      // First verify the report exists and is in scope
      await this.getBillById(billId, user);

      const logs = await prisma.recalculationLog.findMany({
        where: { billingReportId: billId },
        orderBy: { createdAt: "desc" },
      });

      return logs;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── Private Helpers ─────────────────────────────────────────────

  /**
   * Find a meter by ID with scope enforcement via consumer relation.
   */
  private async findMeterOrThrow(meterId: string, user: AuthUser) {
    const scopeFilter = buildMeterScopeFilter(user);

    const meter = await prisma.smartMeter.findFirst({
      where: { id: meterId, ...scopeFilter },
      include: { consumer: true, tariff: true },
    });

    if (!meter) throw new NotFoundError("SmartMeter", meterId);

    return meter;
  }

  /**
   * Assert scope access on a meter that was already loaded with its consumer.
   */
  private assertMeterScope(
    user: AuthUser,
    meter: { consumer: { stateId: string; boardId: string } },
  ): void {
    if (user.role === "SUPER_ADMIN") return;

    if (user.role === "STATE_ADMIN" && user.stateId && user.stateId !== meter.consumer.stateId) {
      throw new BadRequestError("Meter does not belong to your state");
    }

    if (
      (user.role === "BOARD_ADMIN" || user.role === "SUPPORT_AGENT") &&
      user.boardId &&
      user.boardId !== meter.consumer.boardId
    ) {
      throw new BadRequestError("Meter does not belong to your board");
    }
  }

  private parseDate(value: string, fieldName: string): Date {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new BadRequestError(
        `Invalid date format for '${fieldName}'. Use ISO 8601 (e.g. 2025-01-01T00:00:00Z)`,
      );
    }
    return date;
  }

  private assertDateRange(start: Date, end: Date): void {
    if (start >= end) {
      throw new BadRequestError("Start date must be before end date");
    }
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

export const billingReportService = new BillingReportService();
