import pino from 'pino';

// Define the transport explicitly for development mode to enable pretty-printing
// Otherwise, Pino defaults to high-performance LDJSON suitable for production logging (Datadog, CloudWatch, etc.)
const developmentTransport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
  },
});

export const logger = pino(
  {
    level: process.env['LOG_LEVEL'] || 'info',
  },
  process.env['NODE_ENV'] === 'development' ? developmentTransport : undefined,
);

export default logger;
