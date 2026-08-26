import { ILogger, LogLevel } from "./logger";

export class DivLogger implements ILogger {
  private outputDiv: HTMLDivElement;
  private maxLogs: number;
  private logCount: number = 0;

  constructor(outputDiv: HTMLDivElement, maxLogs: number = 100) {
    this.outputDiv = outputDiv;
    this.maxLogs = maxLogs;
    this.outputDiv.style.overflow = "auto"; // Ensure the DIV is scrollable
    this.outputDiv.style.height = "400px"; // Set a fixed height for the DIV
  }

  async log(level: LogLevel, message: string): Promise<void> {
    if (this.logCount >= this.maxLogs) {
      // Remove the first child node (oldest log) if maxLogs is exceeded
      if (this.outputDiv.firstChild) {
        this.outputDiv.removeChild(this.outputDiv.firstChild);
      }
      this.logCount--;
    }

    const entry = document.createElement("p");
    entry.textContent = `${new Date().toISOString()} [${level}]: ${message}`;
    this.outputDiv.appendChild(entry);
    this.logCount++;

    // Scroll to the bottom every time a new log is added
    this.outputDiv.scrollTop = this.outputDiv.scrollHeight;
  }
}
