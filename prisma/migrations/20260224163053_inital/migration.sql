-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('SUPER_ADMIN', 'STATE_ADMIN', 'BOARD_ADMIN', 'SUPPORT_AGENT', 'AUDITOR');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('ENERGY_TRACKING', 'AI_QUERY_PROCESSING');

-- CreateEnum
CREATE TYPE "QueryStatus" AS ENUM ('PENDING', 'AI_REVIEWED', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MeterStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'FAULTY', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "TariffType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL');

-- CreateEnum
CREATE TYPE "AggregationGranularity" AS ENUM ('HOURLY', 'DAILY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ReportFileFormat" AS ENUM ('PDF', 'CSV', 'XML', 'JSON');

-- CreateTable
CREATE TABLE "State" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectricityBoard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectricityBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" "RoleType" NOT NULL,
    "stateId" TEXT,
    "boardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consumer" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "address" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consumer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerConsent" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalAuth" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "userId" TEXT,
    "consumerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartMeter" (
    "id" TEXT NOT NULL,
    "meterNumber" TEXT NOT NULL,
    "status" "MeterStatus" NOT NULL,
    "consumerId" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartMeter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "consumption" DOUBLE PRECISION NOT NULL,
    "voltage" DOUBLE PRECISION,
    "current" DOUBLE PRECISION,

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tariff" (
    "id" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "type" "TariffType" NOT NULL,
    "unitRate" DOUBLE PRECISION NOT NULL,
    "fixedCharge" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumptionAggregate" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "granularity" "AggregationGranularity" NOT NULL,
    "totalUnits" DOUBLE PRECISION NOT NULL,
    "maxDemand" DOUBLE PRECISION,
    "avgVoltage" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumptionAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingReport" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "billingStart" TIMESTAMP(3) NOT NULL,
    "billingEnd" TIMESTAMP(3) NOT NULL,
    "totalUnits" DOUBLE PRECISION NOT NULL,
    "energyCharge" DOUBLE PRECISION NOT NULL,
    "fixedCharge" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecalculationLog" (
    "id" TEXT NOT NULL,
    "billingReportId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "previousVersion" INTEGER NOT NULL,
    "newVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecalculationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerBillView" (
    "id" TEXT NOT NULL,
    "billingReportId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerBillView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerQuery" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "aiCategory" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "status" "QueryStatus" NOT NULL DEFAULT 'PENDING',
    "adminReply" TEXT,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPreference" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "language" TEXT DEFAULT 'en',
    "alerts" BOOLEAN NOT NULL DEFAULT true,
    "theme" TEXT,

    CONSTRAINT "CustomerPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportFormat" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedReportFile" (
    "id" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "boardId" TEXT,
    "stateId" TEXT,
    "fileUrl" TEXT NOT NULL,
    "format" "ReportFileFormat" NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedReportFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRetentionPolicy" (
    "id" TEXT NOT NULL,
    "stateId" TEXT,
    "boardId" TEXT,
    "entityType" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataRetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "State_code_key" ON "State"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ElectricityBoard_code_key" ON "ElectricityBoard"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserConsent_userId_consentType_key" ON "UserConsent"("userId", "consentType");

-- CreateIndex
CREATE UNIQUE INDEX "Consumer_clerkUserId_key" ON "Consumer"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerConsent_consumerId_consentType_key" ON "CustomerConsent"("consumerId", "consentType");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalAuth_provider_providerUserId_key" ON "ExternalAuth"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SmartMeter_meterNumber_key" ON "SmartMeter"("meterNumber");

-- CreateIndex
CREATE INDEX "MeterReading_meterId_timestamp_idx" ON "MeterReading"("meterId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumptionAggregate_meterId_periodStart_granularity_key" ON "ConsumptionAggregate"("meterId", "periodStart", "granularity");

-- CreateIndex
CREATE INDEX "BillingReport_meterId_billingStart_idx" ON "BillingReport"("meterId", "billingStart");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPreference_consumerId_key" ON "CustomerPreference"("consumerId");

-- AddForeignKey
ALTER TABLE "ElectricityBoard" ADD CONSTRAINT "ElectricityBoard_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "ElectricityBoard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "ElectricityBoard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerConsent" ADD CONSTRAINT "CustomerConsent_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAuth" ADD CONSTRAINT "ExternalAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAuth" ADD CONSTRAINT "ExternalAuth_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartMeter" ADD CONSTRAINT "SmartMeter_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartMeter" ADD CONSTRAINT "SmartMeter_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "SmartMeter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumptionAggregate" ADD CONSTRAINT "ConsumptionAggregate_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "SmartMeter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingReport" ADD CONSTRAINT "BillingReport_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "SmartMeter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingReport" ADD CONSTRAINT "BillingReport_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecalculationLog" ADD CONSTRAINT "RecalculationLog_billingReportId_fkey" FOREIGN KEY ("billingReportId") REFERENCES "BillingReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBillView" ADD CONSTRAINT "CustomerBillView_billingReportId_fkey" FOREIGN KEY ("billingReportId") REFERENCES "BillingReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBillView" ADD CONSTRAINT "CustomerBillView_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerQuery" ADD CONSTRAINT "CustomerQuery_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPreference" ADD CONSTRAINT "CustomerPreference_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportFormat" ADD CONSTRAINT "ReportFormat_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "ElectricityBoard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReportFile" ADD CONSTRAINT "GeneratedReportFile_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "ElectricityBoard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReportFile" ADD CONSTRAINT "GeneratedReportFile_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
