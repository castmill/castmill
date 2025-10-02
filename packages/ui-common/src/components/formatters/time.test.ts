import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatDuration, formatTimestamp, formatRelativeTime } from './time';

describe('formatDuration', () => {
  it('should format milliseconds to mm:ss format', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(1000)).toBe('0:01');
    expect(formatDuration(60000)).toBe('1:00');
    expect(formatDuration(125000)).toBe('2:05');
    expect(formatDuration(3661000)).toBe('61:01');
  });
});

describe('formatTimestamp', () => {
  it('should format ISO string to human-readable format', () => {
    const result = formatTimestamp('2025-05-10T08:39:59Z');
    // Should contain the date components
    expect(result).toMatch(/May.*10.*2025/);
    expect(result).toMatch(/08:39/);
    expect(result).toMatch(/UTC/);
  });

  it('should format Date object to human-readable format', () => {
    const date = new Date('2025-01-15T14:30:00Z');
    const result = formatTimestamp(date);
    expect(result).toMatch(/Jan.*15.*2025/);
    expect(result).toMatch(/14:30/);
    expect(result).toMatch(/UTC/);
  });
});

describe('formatRelativeTime', () => {
  let originalDate: typeof Date;

  beforeEach(() => {
    // Save the original Date
    originalDate = global.Date;
    
    // Mock Date to return a fixed time: Jan 1, 2025, 12:00:00 UTC
    const mockNow = new Date('2025-01-01T12:00:00Z');
    global.Date = class extends originalDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          return mockNow;
        }
        return new originalDate(...args);
      }
      static now() {
        return mockNow.getTime();
      }
    } as any;
  });

  afterEach(() => {
    // Restore the original Date
    global.Date = originalDate;
  });

  it('should return "just now" for very recent timestamps', () => {
    const timestamp = new Date('2025-01-01T11:59:30Z'); // 30 seconds ago
    expect(formatRelativeTime(timestamp)).toBe('just now');
  });

  it('should format minutes correctly', () => {
    const timestamp = new Date('2025-01-01T11:55:00Z'); // 5 minutes ago
    expect(formatRelativeTime(timestamp)).toBe('5 minutes ago');
    
    const timestamp2 = new Date('2025-01-01T11:59:00Z'); // 1 minute ago
    expect(formatRelativeTime(timestamp2)).toBe('1 minute ago');
  });

  it('should format hours correctly', () => {
    const timestamp = new Date('2025-01-01T10:00:00Z'); // 2 hours ago
    expect(formatRelativeTime(timestamp)).toBe('2 hours ago');
    
    const timestamp2 = new Date('2025-01-01T11:00:00Z'); // 1 hour ago
    expect(formatRelativeTime(timestamp2)).toBe('1 hour ago');
  });

  it('should format days correctly', () => {
    const timestamp = new Date('2024-12-30T12:00:00Z'); // 2 days ago
    expect(formatRelativeTime(timestamp)).toBe('2 days ago');
    
    const timestamp2 = new Date('2024-12-31T12:00:00Z'); // 1 day ago
    expect(formatRelativeTime(timestamp2)).toBe('1 day ago');
  });

  it('should format months correctly', () => {
    const timestamp = new Date('2024-11-01T12:00:00Z'); // ~2 months ago
    expect(formatRelativeTime(timestamp)).toBe('2 months ago');
    
    const timestamp2 = new Date('2024-12-01T12:00:00Z'); // ~1 month ago
    expect(formatRelativeTime(timestamp2)).toBe('1 month ago');
  });

  it('should format years correctly', () => {
    const timestamp = new Date('2023-01-01T12:00:00Z'); // 2 years ago
    expect(formatRelativeTime(timestamp)).toBe('2 years ago');
    
    const timestamp2 = new Date('2024-01-01T12:00:00Z'); // 1 year ago
    expect(formatRelativeTime(timestamp2)).toBe('1 year ago');
  });

  it('should handle future dates', () => {
    const timestamp = new Date('2025-01-01T12:05:00Z'); // 5 minutes in future
    expect(formatRelativeTime(timestamp)).toBe('in 5 minutes');
    
    const timestamp2 = new Date('2025-01-01T14:00:00Z'); // 2 hours in future
    expect(formatRelativeTime(timestamp2)).toBe('in 2 hours');
  });

  it('should handle ISO string input', () => {
    const result = formatRelativeTime('2025-01-01T11:55:00Z');
    expect(result).toBe('5 minutes ago');
  });
});
