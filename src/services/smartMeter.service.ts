import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import type { MeterStatus } from "../generated/prisma/client.js";
import { NotFoundError, BadRequestError, mapPrismaError } from "../lib/errors.js";
import { buildScopeFilter } from "../helper/service.helper.js";

// ── Types ────────────────────────────────────────────────────────────

export interface CreateMeterInput {
  meterNumber: string;
  consumerId: string;
  tariffId: string;
  status?: MeterStatus | undefined;
}

export interface ConsumptionSummary {
  meterId: string;
  meterNumber: string;
  periodStart: Date;
  periodEnd: Date;
  totalUnits: number;
  readingCount: number;
  maxDemand: number | null;
  avgVoltage: number | null;
}

// ── Service ──────────────────────────────────────────────────────────

export class SmartMeterService {
  /**
   * Create a new smart meter and link it to a consumer + tariff.
   */
  async createMeter(input: CreateMeterInput, user: AuthUser) {
    try {
      // Verify consumer exists and is within the caller's scope
      const consumer = await prisma.consumer.findUnique({
        where: { id: input.consumerId },
        select: { id: true, stateId: true, boardId: true },
      });

      if (!consumer) {
        throw new NotFoundError("Consumer", input.consumerId);
      }

      this.assertScope(user, consumer.stateId, consumer.boardId);

      // Verify tariff exists
      const tariff = await prisma.tariff.findUnique({
        where: { id: input.tariffId },
        select: { id: true },
      });

      if (!tariff) {
        throw new NotFoundError("Tariff", input.tariffId);
      }

      const meter = await prisma.smartMeter.create({
        data: {
          meterNumber: input.meterNumber,
          status: input.status ?? "ACTIVE",
          consumerId: input.consumerId,
          tariffId: input.tariffId,
        },
        include: { consumer: true, tariff: true },
      });

      return meter;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Re-assign an existing meter to a different consumer.
   */
  async assignMeterToConsumer(meterId: string, consumerId: string, user: AuthUser) {
    try {
      const meter = await this.findMeterOrThrow(meterId, user);

      const consumer = await prisma.consumer.findUnique({
        where: { id: consumerId },
        select: { id: true, stateId: true, boardId: true },
      });

      if (!consumer) {
        throw new NotFoundError("Consumer", consumerId);
      }

      this.assertScope(user, consumer.stateId, consumer.boardId);

      const updated = await prisma.smartMeter.update({
        where: { id: meter.id },
        data: { consumerId },
        include: { consumer: true, tariff: true },
      });

      return updated;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Get a single meter by ID, including consumer and tariff.
   */
  async getMeterById(meterId: string, user: AuthUser) {
    try {
      return await this.findMeterOrThrow(meterId, user);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * List all meters for a specific consumer.
   */
  async getMetersForConsumer(consumerId: string, user: AuthUser) {
    try {
      // Verify consumer exists and is within scope
      const consumer = await prisma.consumer.findUnique({
        where: { id: consumerId },
        select: { id: true, stateId: true, boardId: true },
      });

      if (!consumer) {
        throw new NotFoundError("Consumer", consumerId);
      }

      this.assertScope(user, consumer.stateId, consumer.boardId);

      const meters = await prisma.smartMeter.findMany({
        where: { consumerId },
        include: { tariff: true },
        orderBy: { createdAt: "desc" },
      });

      return meters;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Update a meter's status (ACTIVE, INACTIVE, FAULTY, DISCONNECTED).
   */
  async updateMeterStatus(meterId: string, status: MeterStatus, user: AuthUser) {
    try {
      const meter = await this.findMeterOrThrow(meterId, user);

      const updated = await prisma.smartMeter.update({
        where: { id: meter.id },
        data: { status },
        include: { consumer: true, tariff: true },
      });

      return updated;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Get aggregated consumption summary for a meter in a date range.
   * Uses raw MeterReading records (not pre-aggregated).
   */
  async getMeterConsumptionSummary(
    meterId: string,
    periodStart: Date,
    periodEnd: Date,
    user: AuthUser,
  ): Promise<ConsumptionSummary> {
    try {
      const meter = await this.findMeterOrThrow(meterId, user);

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
        voltages.length > 0 ? voltages.reduce((a, b) => a + b, 0) / voltages.length : null;

      return {
        meterId: meter.id,
        meterNumber: meter.meterNumber,
        periodStart,
        periodEnd,
        totalUnits: Math.round(totalUnits * 100) / 100,
        readingCount: readings.length,
        maxDemand: maxDemand != null ? Math.round(maxDemand * 100) / 100 : null,
        avgVoltage: avgVoltage != null ? Math.round(avgVoltage * 100) / 100 : null,
      };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── Consumer Self-Service ────────────────────────────────────────

  /**
   * List all meters belonging to a consumer (consumer self-service).
   * No admin scope check — consumer ID is the scope itself.
   */
  async getMetersForConsumerSelf(consumerId: string) {
    try {
      const meters = await prisma.smartMeter.findMany({
        where: { consumerId },
        include: { tariff: true },
        orderBy: { createdAt: "desc" },
      });
      return meters;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  /**
   * Get consumption summary for a meter, verifying it belongs to the given consumer.
   */
  async getConsumerMeterConsumption(
    meterId: string,
    consumerId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<ConsumptionSummary> {
    try {
      // Ownership check
      const meter = await prisma.smartMeter.findFirst({
        where: { id: meterId, consumerId },
        select: { id: true, meterNumber: true },
      });

      if (!meter) throw new NotFoundError("SmartMeter", meterId);

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
        voltages.length > 0 ? voltages.reduce((a, b) => a + b, 0) / voltages.length : null;

      return {
        meterId: meter.id,
        meterNumber: meter.meterNumber,
        periodStart,
        periodEnd,
        totalUnits: Math.round(totalUnits * 100) / 100,
        readingCount: readings.length,
        maxDemand: maxDemand != null ? Math.round(maxDemand * 100) / 100 : null,
        avgVoltage: avgVoltage != null ? Math.round(avgVoltage * 100) / 100 : null,
      };
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Find a meter by ID with scope enforcement.
   * Throws NotFoundError if not found or out of scope.
   */
  private async findMeterOrThrow(meterId: string, user: AuthUser) {
    const scopeFilter = buildScopeFilter(user);

    const meter = await prisma.smartMeter.findFirst({
      where: { id: meterId, ...scopeFilter },
      include: { consumer: true, tariff: true },
    });

    if (!meter) {
      throw new NotFoundError("SmartMeter", meterId);
    }

    return meter;
  }

  /**
   * Assert the caller has access to a resource within the given state/board.
   */
  private assertScope(user: AuthUser, stateId: string, boardId: string): void {
    if (user.role === "SUPER_ADMIN") return;

    if (user.role === "STATE_ADMIN" && user.stateId && user.stateId !== stateId) {
      throw new BadRequestError("Consumer does not belong to your state");
    }

    if (
      (user.role === "BOARD_ADMIN" || user.role === "SUPPORT_AGENT") &&
      user.boardId &&
      user.boardId !== boardId
    ) {
      throw new BadRequestError("Consumer does not belong to your board");
    }
  }
}

export const smartMeterService = new SmartMeterService();
