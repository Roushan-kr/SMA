import {
  RoleType,
  TariffType,
  MeterStatus,
  AggregationGranularity,
  ConsentType,
  QueryStatus,
  ReportFileFormat,
} from "../generated/prisma/enums.js";
import { prisma } from "../lib/prisma.js";

async function main() {
  console.log("🌱 Seeding database...");

  ////////////////////////////////////////////
  // STATES
  ////////////////////////////////////////////

  const gujarat = await prisma.state.create({
    data: {
      name: "Gujarat",
      code: "GJ",
    },
  });

  const up = await prisma.state.create({
    data: {
      name: "Uttar Pradesh",
      code: "UP",
    },
  });

  ////////////////////////////////////////////
  // ELECTRICITY BOARDS
  ////////////////////////////////////////////

  const mgvcl = await prisma.electricityBoard.create({
    data: {
      name: "MGVCL",
      code: "MGVCL_GJ",
      stateId: gujarat.id,
    },
  });

  const uppcl = await prisma.electricityBoard.create({
    data: {
      name: "UPPCL",
      code: "UPPCL_UP",
      stateId: up.id,
    },
  });

  ////////////////////////////////////////////
  // TARIFFS (all types)
  ////////////////////////////////////////////

  const gjResidentialTariff = await prisma.tariff.create({
    data: {
      stateId: gujarat.id,
      type: TariffType.RESIDENTIAL,
      unitRate: 6.5,
      fixedCharge: 120,
      effectiveFrom: new Date("2024-01-01"),
    },
  });

  const gjCommercialTariff = await prisma.tariff.create({
    data: {
      stateId: gujarat.id,
      type: TariffType.COMMERCIAL,
      unitRate: 9.2,
      fixedCharge: 250,
      effectiveFrom: new Date("2024-01-01"),
    },
  });

  const upResidentialTariff = await prisma.tariff.create({
    data: {
      stateId: up.id,
      type: TariffType.RESIDENTIAL,
      unitRate: 5.8,
      fixedCharge: 100,
      effectiveFrom: new Date("2024-01-01"),
    },
  });

  const upIndustrialTariff = await prisma.tariff.create({
    data: {
      stateId: up.id,
      type: TariffType.INDUSTRIAL,
      unitRate: 11.5,
      fixedCharge: 500,
      effectiveFrom: new Date("2024-01-01"),
      effectiveTo: new Date("2025-12-31"),
    },
  });

  ////////////////////////////////////////////
  // ADMIN USERS (all roles)
  ////////////////////////////////////////////

  const superAdmin = await prisma.user.create({
    data: {
      name: "Platform Super Admin",
      clerkUserId: "clerk_super_admin_001",
      email: "superadmin@smartmettr.in",
      role: RoleType.SUPER_ADMIN,
    },
  });

  const gjStateAdmin = await prisma.user.create({
    data: {
      name: "Gujarat State Admin",
      clerkUserId: "clerk_admin_gj_001",
      email: "admin@mgvcl.gj.in",
      role: RoleType.STATE_ADMIN,
      stateId: gujarat.id,
    },
  });

  const upBoardAdmin = await prisma.user.create({
    data: {
      name: "UP Board Admin",
      clerkUserId: "clerk_admin_up_001",
      email: "admin@uppcl.up.in",
      role: RoleType.BOARD_ADMIN,
      stateId: up.id,
      boardId: uppcl.id,
    },
  });

  const supportAgent = await prisma.user.create({
    data: {
      name: "MGVCL Support Agent",
      clerkUserId: "clerk_support_gj_001",
      phone: "+911234567890",
      role: RoleType.SUPPORT_AGENT,
      stateId: gujarat.id,
      boardId: mgvcl.id,
    },
  });

  const auditor = await prisma.user.create({
    data: {
      name: "State Auditor Gujarat",
      clerkUserId: "clerk_auditor_gj_001",
      email: "auditor@smartmettr.in",
      role: RoleType.AUDITOR,
      stateId: gujarat.id,
    },
  });

  ////////////////////////////////////////////
  // USER CONSENTS (DPDP)
  ////////////////////////////////////////////

  await prisma.userConsent.create({
    data: {
      userId: gjStateAdmin.id,
      consentType: ConsentType.ENERGY_TRACKING,
      granted: true,
      grantedAt: new Date("2024-01-15"),
    },
  });

  await prisma.userConsent.create({
    data: {
      userId: supportAgent.id,
      consentType: ConsentType.AI_QUERY_PROCESSING,
      granted: true,
      grantedAt: new Date("2024-02-01"),
    },
  });

  ////////////////////////////////////////////
  // CONSUMERS
  ////////////////////////////////////////////

  const consumer1 = await prisma.consumer.create({
    data: {
      name: "Rahul Sharma",
      clerkUserId: "clerk_consumer_001",
      phoneNumber: "+919999999999",
      address: "Vadodara, Gujarat",
      stateId: gujarat.id,
      boardId: mgvcl.id,
    },
  });

  const consumer2 = await prisma.consumer.create({
    data: {
      name: "Amit Verma",
      clerkUserId: "clerk_consumer_002",
      phoneNumber: "+918888888888",
      address: "Lucknow, UP",
      stateId: up.id,
      boardId: uppcl.id,
    },
  });

  const consumer3 = await prisma.consumer.create({
    data: {
      name: "Priya Patel",
      clerkUserId: "clerk_consumer_003",
      phoneNumber: "+917777777777",
      address: "Ahmedabad, Gujarat",
      stateId: gujarat.id,
      boardId: mgvcl.id,
    },
  });

  ////////////////////////////////////////////
  // CUSTOMER CONSENTS (DPDP)
  ////////////////////////////////////////////

  await prisma.customerConsent.create({
    data: {
      consumerId: consumer1.id,
      consentType: ConsentType.ENERGY_TRACKING,
      granted: true,
      grantedAt: new Date("2024-01-10"),
    },
  });

  await prisma.customerConsent.create({
    data: {
      consumerId: consumer1.id,
      consentType: ConsentType.AI_QUERY_PROCESSING,
      granted: true,
      grantedAt: new Date("2024-01-10"),
    },
  });

  await prisma.customerConsent.create({
    data: {
      consumerId: consumer2.id,
      consentType: ConsentType.ENERGY_TRACKING,
      granted: true,
      grantedAt: new Date("2024-02-05"),
    },
  });

  await prisma.customerConsent.create({
    data: {
      consumerId: consumer2.id,
      consentType: ConsentType.AI_QUERY_PROCESSING,
      granted: false,
    },
  });

  await prisma.customerConsent.create({
    data: {
      consumerId: consumer3.id,
      consentType: ConsentType.ENERGY_TRACKING,
      granted: true,
      grantedAt: new Date("2024-03-01"),
      revokedAt: new Date("2024-06-15"), // revoked later
    },
  });

  ////////////////////////////////////////////
  // EXTERNAL AUTH (Clerk mappings)
  ////////////////////////////////////////////

  await prisma.externalAuth.create({
    data: {
      provider: "clerk",
      providerUserId: "clerk_consumer_001",
      consumerId: consumer1.id,
    },
  });

  await prisma.externalAuth.create({
    data: {
      provider: "clerk",
      providerUserId: "clerk_consumer_002",
      consumerId: consumer2.id,
    },
  });

  await prisma.externalAuth.create({
    data: {
      provider: "clerk",
      providerUserId: "clerk_admin_gj_001",
      userId: gjStateAdmin.id,
    },
  });

  ////////////////////////////////////////////
  // SMART METERS
  ////////////////////////////////////////////

  const meter1 = await prisma.smartMeter.create({
    data: {
      meterNumber: "GJ-MTR-1001",
      status: MeterStatus.ACTIVE,
      consumerId: consumer1.id,
      tariffId: gjResidentialTariff.id,
    },
  });

  const meter2 = await prisma.smartMeter.create({
    data: {
      meterNumber: "UP-MTR-2001",
      status: MeterStatus.ACTIVE,
      consumerId: consumer2.id,
      tariffId: upResidentialTariff.id,
    },
  });

  const meter3 = await prisma.smartMeter.create({
    data: {
      meterNumber: "GJ-MTR-1002",
      status: MeterStatus.FAULTY,
      consumerId: consumer3.id,
      tariffId: gjCommercialTariff.id,
    },
  });

  // Disconnected meter (no active consumer scenario)
  await prisma.smartMeter.create({
    data: {
      meterNumber: "UP-MTR-2002",
      status: MeterStatus.DISCONNECTED,
      consumerId: consumer2.id,
      tariffId: upIndustrialTariff.id,
    },
  });

  ////////////////////////////////////////////
  // METER READINGS — meter1 (24h Jan 1)
  ////////////////////////////////////////////

  for (let i = 0; i < 24; i++) {
    await prisma.meterReading.create({
      data: {
        meterId: meter1.id,
        timestamp: new Date(2024, 0, 1, i),
        consumption: Math.random() * 2 + 0.5,
        voltage: 218 + Math.random() * 6,
        current: 3 + Math.random() * 4,
      },
    });
  }

  ////////////////////////////////////////////
  // METER READINGS — meter2 (24h Jan 1)
  ////////////////////////////////////////////

  for (let i = 0; i < 24; i++) {
    await prisma.meterReading.create({
      data: {
        meterId: meter2.id,
        timestamp: new Date(2024, 0, 1, i),
        consumption: Math.random() * 1.8 + 0.3,
        voltage: 215 + Math.random() * 10,
        current: 2 + Math.random() * 3,
      },
    });
  }

  ////////////////////////////////////////////
  // METER READINGS — meter3 (partial, faulty)
  ////////////////////////////////////////////

  for (let i = 0; i < 12; i++) {
    await prisma.meterReading.create({
      data: {
        meterId: meter3.id,
        timestamp: new Date(2024, 0, 1, i),
        consumption: Math.random() * 3 + 1,
        voltage: i < 8 ? 220 : 180, // voltage drops → faulty
        current: 4 + Math.random() * 2,
      },
    });
  }

  ////////////////////////////////////////////
  // AGGREGATED DATA
  ////////////////////////////////////////////

  await prisma.consumptionAggregate.create({
    data: {
      meterId: meter1.id,
      periodStart: new Date("2024-01-01"),
      periodEnd: new Date("2024-01-31"),
      granularity: AggregationGranularity.MONTHLY,
      totalUnits: 320,
      maxDemand: 5.2,
      avgVoltage: 220.5,
    },
  });

  await prisma.consumptionAggregate.create({
    data: {
      meterId: meter2.id,
      periodStart: new Date("2024-01-01"),
      periodEnd: new Date("2024-01-31"),
      granularity: AggregationGranularity.MONTHLY,
      totalUnits: 245,
      maxDemand: 4.1,
      avgVoltage: 219.3,
    },
  });

  await prisma.consumptionAggregate.create({
    data: {
      meterId: meter1.id,
      periodStart: new Date("2024-01-01"),
      periodEnd: new Date("2024-01-01T23:59:59"),
      granularity: AggregationGranularity.DAILY,
      totalUnits: 10.3,
      maxDemand: 6.8,
      avgVoltage: 221,
    },
  });

  ////////////////////////////////////////////
  // BILLING REPORT SNAPSHOTS
  ////////////////////////////////////////////

  const billingReport1 = await prisma.billingReport.create({
    data: {
      meterId: meter1.id,
      tariffId: gjResidentialTariff.id,
      billingStart: new Date("2024-01-01"),
      billingEnd: new Date("2024-01-31"),
      totalUnits: 320,
      energyCharge: 320 * 6.5,
      fixedCharge: 120,
      taxAmount: 320 * 6.5 * 0.05,
      totalAmount: 320 * 6.5 + 120 + 320 * 6.5 * 0.05,
    },
  });

  const billingReport2 = await prisma.billingReport.create({
    data: {
      meterId: meter2.id,
      tariffId: upResidentialTariff.id,
      billingStart: new Date("2024-01-01"),
      billingEnd: new Date("2024-01-31"),
      totalUnits: 245,
      energyCharge: 245 * 5.8,
      fixedCharge: 100,
      taxAmount: 245 * 5.8 * 0.05,
      totalAmount: 245 * 5.8 + 100 + 245 * 5.8 * 0.05,
    },
  });

  ////////////////////////////////////////////
  // RECALCULATION LOG
  ////////////////////////////////////////////

  await prisma.recalculationLog.create({
    data: {
      billingReportId: billingReport1.id,
      reason: "Tariff correction: fixed charge updated from ₹100 to ₹120",
      triggeredBy: gjStateAdmin.id,
      previousVersion: 1,
      newVersion: 2,
    },
  });

  ////////////////////////////////////////////
  // CUSTOMER BILL VIEWS
  ////////////////////////////////////////////

  await prisma.customerBillView.create({
    data: {
      billingReportId: billingReport1.id,
      consumerId: consumer1.id,
      viewedAt: new Date("2024-02-05T10:30:00Z"),
    },
  });

  await prisma.customerBillView.create({
    data: {
      billingReportId: billingReport2.id,
      consumerId: consumer2.id,
      viewedAt: null, // not viewed yet
    },
  });

  ////////////////////////////////////////////
  // CUSTOMER QUERIES (AI)
  ////////////////////////////////////////////

  await prisma.customerQuery.create({
    data: {
      consumerId: consumer1.id,
      queryText: "Why is my bill so high this month compared to last month?",
      aiCategory: "billing_dispute",
      aiConfidence: 0.92,
      status: QueryStatus.AI_REVIEWED,
      adminReply: "Your consumption increased by 40 units due to winter heating usage.",
      reviewedBy: supportAgent.id,
    },
  });

  await prisma.customerQuery.create({
    data: {
      consumerId: consumer2.id,
      queryText: "My meter is showing error code E-04, what should I do?",
      aiCategory: "meter_issue",
      aiConfidence: 0.87,
      status: QueryStatus.PENDING,
    },
  });

  await prisma.customerQuery.create({
    data: {
      consumerId: consumer3.id,
      queryText: "How can I switch to a commercial tariff plan?",
      aiCategory: "tariff_inquiry",
      aiConfidence: 0.95,
      status: QueryStatus.RESOLVED,
      adminReply: "Please visit your nearest MGVCL office with your business registration.",
      reviewedBy: supportAgent.id,
    },
  });

  await prisma.customerQuery.create({
    data: {
      consumerId: consumer1.id,
      queryText: "I want to report power theft in my area",
      aiCategory: "complaint",
      aiConfidence: 0.6,
      status: QueryStatus.REJECTED,
      adminReply: "This query should be directed to local police authorities.",
      reviewedBy: gjStateAdmin.id,
    },
  });

  ////////////////////////////////////////////
  // NOTIFICATIONS
  ////////////////////////////////////////////

  await prisma.notification.create({
    data: {
      consumerId: consumer1.id,
      title: "Bill Generated",
      message: "Your electricity bill for January 2024 has been generated. Total: ₹2,324.",
      type: "billing",
      isRead: true,
    },
  });

  await prisma.notification.create({
    data: {
      consumerId: consumer1.id,
      title: "Payment Due Reminder",
      message: "Your bill payment of ₹2,324 is due by Feb 15, 2024.",
      type: "reminder",
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      consumerId: consumer2.id,
      title: "Bill Generated",
      message: "Your electricity bill for January 2024 has been generated. Total: ₹1,592.",
      type: "billing",
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      consumerId: consumer3.id,
      title: "Meter Fault Detected",
      message: "A voltage anomaly has been detected on your meter GJ-MTR-1002. A technician will visit soon.",
      type: "alert",
      isRead: false,
    },
  });

  ////////////////////////////////////////////
  // CUSTOMER PREFERENCES
  ////////////////////////////////////////////

  await prisma.customerPreference.create({
    data: {
      consumerId: consumer1.id,
      language: "hi",
      alerts: true,
      theme: "dark",
    },
  });

  await prisma.customerPreference.create({
    data: {
      consumerId: consumer2.id,
      language: "en",
      alerts: true,
      theme: "light",
    },
  });

  await prisma.customerPreference.create({
    data: {
      consumerId: consumer3.id,
      language: "gu",
      alerts: false,
      theme: "dark",
    },
  });

  ////////////////////////////////////////////
  // REPORT FORMATS
  ////////////////////////////////////////////

  await prisma.reportFormat.create({
    data: {
      boardId: mgvcl.id,
      name: "Standard Monthly CSV",
      schema: {
        columns: ["MeterNumber", "ConsumerName", "Units", "Amount", "BillingPeriod"],
      },
    },
  });

  await prisma.reportFormat.create({
    data: {
      boardId: uppcl.id,
      name: "UP Board XML Report",
      schema: {
        rootElement: "BillingReport",
        fields: ["meterId", "consumerName", "units", "energyCharge", "totalAmount"],
      },
    },
  });

  ////////////////////////////////////////////
  // GENERATED REPORT FILES
  ////////////////////////////////////////////

  await prisma.generatedReportFile.create({
    data: {
      reportType: "monthly_billing_summary",
      boardId: mgvcl.id,
      stateId: gujarat.id,
      fileUrl: "https://storage.smartmettr.in/reports/mgvcl-jan-2024.csv",
      format: ReportFileFormat.CSV,
      createdBy: gjStateAdmin.id,
    },
  });

  await prisma.generatedReportFile.create({
    data: {
      reportType: "consumption_analysis",
      stateId: gujarat.id,
      fileUrl: "https://storage.smartmettr.in/reports/gj-consumption-q1-2024.pdf",
      format: ReportFileFormat.PDF,
      createdBy: superAdmin.id,
    },
  });

  await prisma.generatedReportFile.create({
    data: {
      reportType: "monthly_billing_summary",
      boardId: uppcl.id,
      stateId: up.id,
      fileUrl: "https://storage.smartmettr.in/reports/uppcl-jan-2024.xml",
      format: ReportFileFormat.XML,
      createdBy: upBoardAdmin.id,
    },
  });

  ////////////////////////////////////////////
  // AUDIT LOGS
  ////////////////////////////////////////////

  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id,
      action: "CREATE",
      entity: "State",
      entityId: gujarat.id,
      metadata: { stateName: "Gujarat", stateCode: "GJ" },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: gjStateAdmin.id,
      action: "CREATE",
      entity: "SmartMeter",
      entityId: meter1.id,
      metadata: { meterNumber: "GJ-MTR-1001", consumer: consumer1.name },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: upBoardAdmin.id,
      action: "UPDATE",
      entity: "BillingReport",
      entityId: billingReport2.id,
      metadata: { reason: "Recalculation after tariff update" },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: supportAgent.id,
      action: "RESOLVE",
      entity: "CustomerQuery",
      entityId: "query-placeholder",
      metadata: { category: "billing_dispute", resolution: "explained_to_customer" },
    },
  });

  ////////////////////////////////////////////
  // DATA RETENTION POLICIES
  ////////////////////////////////////////////

  await prisma.dataRetentionPolicy.create({
    data: {
      stateId: gujarat.id,
      entityType: "MeterReading",
      retentionDays: 365 * 7, // 7 years
    },
  });

  await prisma.dataRetentionPolicy.create({
    data: {
      stateId: up.id,
      entityType: "MeterReading",
      retentionDays: 365 * 5, // 5 years
    },
  });

  await prisma.dataRetentionPolicy.create({
    data: {
      entityType: "AuditLog",
      retentionDays: 365 * 10, // 10 years — global policy
    },
  });

  await prisma.dataRetentionPolicy.create({
    data: {
      boardId: mgvcl.id,
      entityType: "CustomerQuery",
      retentionDays: 365 * 3, // 3 years
    },
  });

  console.log("✅ Seeding complete — all models populated.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });