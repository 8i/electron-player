/**
 * FileLogger - Accumulates debug logs in memory and allows downloading as a file.
 * Useful for debugging buffer issues in the DASH player.
 */

export interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
  data?: Record<string, any>;
}

export class FileLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number;
  private enabled: boolean = true;

  constructor(maxLogs: number = 10000) {
    this.maxLogs = maxLogs;
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  clear() {
    this.logs = [];
  }

  log(level: string, message: string, data?: Record<string, any>) {
    if (!this.enabled) return;

    const entry: LogEntry = {
      timestamp: performance.now(),
      level,
      message,
      data
    };

    this.logs.push(entry);

    // Trim if exceeds max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  debug(message: string, data?: Record<string, any>) {
    this.log('DEBUG', message, data);
  }

  info(message: string, data?: Record<string, any>) {
    this.log('INFO', message, data);
  }

  warn(message: string, data?: Record<string, any>) {
    this.log('WARN', message, data);
  }

  error(message: string, data?: Record<string, any>) {
    this.log('ERROR', message, data);
  }

  getLogCount(): number {
    return this.logs.length;
  }

  /**
   * Format logs as a readable string
   */
  formatLogs(): string {
    const lines: string[] = [
      '=== DASH Player Debug Log ===',
      `Generated: ${new Date().toISOString()}`,
      `Total entries: ${this.logs.length}`,
      '=============================',
      ''
    ];

    for (const entry of this.logs) {
      const time = (entry.timestamp / 1000).toFixed(3);
      let line = `[${time}s] [${entry.level}] ${entry.message}`;

      if (entry.data) {
        line += '\n  ' + JSON.stringify(entry.data, null, 2).replace(/\n/g, '\n  ');
      }

      lines.push(line);
    }

    return lines.join('\n');
  }

  /**
   * Download logs as a text file
   */
  downloadLogs(filename?: string) {
    const content = this.formatLogs();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `dash-debug-${Date.now()}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Get logs as JSON for programmatic access
   */
  getLogsJSON(): LogEntry[] {
    return [...this.logs];
  }
}

// Global singleton instance for easy access
export const fileLogger = new FileLogger();

// Expose to window for console access
(window as any).fileLogger = fileLogger;
