
export type LogLevel = "info" | "warning" | "error" | "debug" | "critical" | "trace";

export interface ILogger {
  log(level: LogLevel, message: string): Promise<void>
}

export class NullLogger implements ILogger {
  async log(level: LogLevel, message: string) {
    // Do nothing
  }
}

// Logger class that delegates to specific logger implementations
export class Logger {
  private logger: ILogger;

  constructor() {
    this.logger = new NullLogger(); // Default to null logger
  }

  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  warn(message: string) {
    return this.log("warning", message);
  }

  error(message: string) {
    return this.log("error", message);
  }

  info(message: string) {
    return this.log("info", message);
  }

  debug(message: string) {
    return this.log("debug", message);
  }

  critical(message: string) {
    return this.log("critical", message);
  }

  trace(message: string) {
    return this.log("trace", message);
  }

  private async log(level: LogLevel, message: string): Promise<void> {
    // Delegate to the specific logger implementation
    // logging should never fail, so catch any exceptions
    try {
      await this.logger.log(level, message);
    } catch (e) {
      console.error(`Failed to log message: ${e}`);
    }
  }
}
