import 'dotenv/config';
import express from 'express';
import { clerkAuth } from './middleware/auth.js';
import { globalErrorHandler } from './middleware/errorHandler.js';
import smartMeterRoutes from './routes/smartMeter.routes.js';
import consumerRoutes from './routes/consumer.routes.js';
import billingReportRoutes from './routes/billingReport.routes.js';
import queryRoutes from './routes/query.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import reportRoutes from './routes/report.routes.js';
import auditRoutes from './routes/audit.routes.js';
import userRoutes from './routes/user.routes.js';
import referenceRoutes from './routes/reference.routes.js';
import retentionRoutes from './routes/retention.routes.js';
import authRoutes from './routes/auth.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import cors from 'cors';

import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger.js';
import { createCacheMiddleware } from './middleware/cache.middleware.js';

const app = express();
const isDev = process.env['NODE_ENV'] === 'development';

// ── Global Middleware ────────────────────────────────────────────────
app.use(pinoHttp({
  logger,
  autoLogging: !isDev, // tempary 
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
}));

app.use(express.json());
app.use(clerkAuth);
app.use(cors());

// ── Health Check ─────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes (Cached) ──────────────────────────────────────────────
const cache60 = createCacheMiddleware(60);
const cache300 = createCacheMiddleware(300);

app.use('/api/smart-meters', cache60, smartMeterRoutes);
app.use('/api/consumers', cache60, consumerRoutes);
app.use('/api/billing', cache60, billingReportRoutes);
app.use('/api/support', cache60, queryRoutes);
app.use('/api/dashboard', cache300, dashboardRoutes);

// ── API Routes (Standard) ────────────────────────────────────────────
app.use('/api/users', cache60, userRoutes);
app.use('/api/reference', cache60, referenceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/retention', retentionRoutes);
app.use('/api/auth', authRoutes);

// ── Global Error Handler (must be last) ──────────────────────────────
app.use(globalErrorHandler);

// ── Start Server ─────────────────────────────────────────────────────
const PORT = process.env['PORT'] ?? 3000;

app.listen(PORT, () => {
  logger.info(`Server is running on port ${String(PORT)}`);
});
