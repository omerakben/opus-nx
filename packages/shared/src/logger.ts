type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

const LOG_COLORS = {
  debug: "\x1b[36m", // Cyan
  info: "\x1b[32m",  // Green
  warn: "\x1b[33m",  // Yellow
  error: "\x1b[31m", // Red
  reset: "\x1b[0m",
};

class Logger {
  private name: string;
  private minLevel: LogLevel;

  constructor(name: string, minLevel: LogLevel = "info") {
    this.name = name;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private format(entry: LogEntry): string {
    const color = LOG_COLORS[entry.level];
    const reset = LOG_COLORS.reset;
    const timestamp = entry.timestamp.toISOString();
    const context = entry.context
      ? ` ${JSON.stringify(entry.context)}`
      : "";

    return `${color}[${entry.level.toUpperCase()}]${reset} ${timestamp} [${this.name}] ${entry.message}${context}`;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
    };

    const formatted = this.format(entry);

    if (level === "error") {
      console.error(formatted);
    } else if (level === "warn") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }
}

export function createLogger(name: string, minLevel?: LogLevel): Logger {
  const envLevel = (typeof process !== "undefined" ? process.env?.LOG_LEVEL : undefined) as LogLevel | undefined;
  return new Logger(name, minLevel ?? envLevel ?? "info");
}

export type { Logger, LogLevel, LogEntry };
