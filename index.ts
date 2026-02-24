import { config } from "dotenv";
import express from "express";
import { clerkAuth } from "./middleware/auth.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";
import smartMeterRoutes from "./routes/smartMeter.routes.js";
import consumerRoutes from "./routes/consumer.routes.js";
import billingReportRoutes from "./routes/billingReport.routes.js";
import queryRoutes from "./routes/query.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

config();

const app = express();

// ── Global Middleware ────────────────────────────────────────────────
app.use(express.json());
app.use(clerkAuth);

// ── Health Check ─────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── API Routes ───────────────────────────────────────────────────────
app.use("/api/smart-meters", smartMeterRoutes);
app.use("/api/consumers", consumerRoutes);
app.use("/api/billing", billingReportRoutes);
app.use("/api/queries", queryRoutes);
app.use("/api/notifications", notificationRoutes);

// ── Global Error Handler (must be last) ──────────────────────────────
app.use(globalErrorHandler);

// ── Start Server ─────────────────────────────────────────────────────
const PORT = process.env["PORT"] ?? 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${String(PORT)}`);
});