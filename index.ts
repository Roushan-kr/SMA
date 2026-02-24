import { config } from "dotenv";
import express from "express";
import { clerkAuth } from "./middleware/auth.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";
import smartMeterRoutes from "./routes/smartMeter.routes.js";

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

// ── Global Error Handler (must be last) ──────────────────────────────
app.use(globalErrorHandler);

// ── Start Server ─────────────────────────────────────────────────────
const PORT = process.env["PORT"] ?? 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${String(PORT)}`);
});