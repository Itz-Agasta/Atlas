import winston from "winston";

const { combine, timestamp, json, printf, colorize, errors } = winston.format;

const isDevelopment = process.env.NODE_ENV !== "production";

// Custom format for console output (dev mode) with colors
const consoleFormat = printf(
  ({ level, message, timestamp: ts, ...metadata }) => {
    let msg = `${ts} [${level}]: ${message}`;

    // Add metadata if present (excluding service and environment as they're always there)
    const relevantMeta = Object.keys(metadata).filter(
      (key) => !["service", "environment"].includes(key)
    );
    if (relevantMeta.length > 0) {
      const metaObj: Record<string, unknown> = {};
      for (const key of relevantMeta) {
        metaObj[key] = metadata[key];
      }
      msg += ` ${JSON.stringify(metaObj)}`;
    }

    return msg;
  }
);

// Create Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  format: combine(
    errors({ stack: true }), // Handle errors with stack traces
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    json() // Default JSON format for production
  ),
  defaultMeta: {
    service: "atlas-api-gateway",
    environment: process.env.NODE_ENV || "development",
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: isDevelopment
        ? combine(
            colorize({ all: true }), // Colorize everything, not just level
            timestamp({ format: "HH:mm:ss" }),
            consoleFormat
          )
        : combine(timestamp(), json()),
    }),
    // File transports for production
    ...(isDevelopment
      ? []
      : [
          new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
            maxsize: 5_242_880, // 5MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: "logs/combined.log",
            maxsize: 5_242_880,
            maxFiles: 5,
          }),
        ]),
  ],
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Handle uncaught exceptions and unhandled rejections
if (!isDevelopment) {
  logger.exceptions.handle(
    new winston.transports.File({
      filename: "logs/exceptions.log",
    })
  );

  logger.rejections.handle(
    new winston.transports.File({
      filename: "logs/rejections.log",
    })
  );
}

export default logger;
