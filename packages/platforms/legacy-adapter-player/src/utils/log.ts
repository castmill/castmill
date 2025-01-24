/**
 * Super simple logger class that logs messages to the console
 * if the VITE_LOGGING environment variable is set to true.
 */
export class Logger {
  private active = import.meta.env.VITE_LOGGING === 'true';

  constructor(private readonly prefix: string) {}

  log(...args: any[]): void {
    if (!this.active) {
      return;
    }

    console.log(`[${this.prefix}] ${args.join(' ')}`);
  }

  error(...args: any[]): void {
    if (!this.active) {
      return;
    }

    console.error(`[${this.prefix}] ${args.join(' ')}`);
  }

  warn(...args: any[]): void {
    if (!this.active) {
      return;
    }

    console.warn(`[${this.prefix}] ${args.join(' ')}`);
  }
}
