import { describe, it, expect } from 'vitest';
import { formatBytes } from './format-bytes';

describe('formatBytes', () => {
  describe('edge cases', () => {
    it('should return "0 B" for 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should throw error for negative values', () => {
      expect(() => formatBytes(-1)).toThrow(
        'formatBytes: bytes must be non-negative'
      );
      expect(() => formatBytes(-100)).toThrow(
        'formatBytes: bytes must be non-negative'
      );
      expect(() => formatBytes(-1024)).toThrow(
        'formatBytes: bytes must be non-negative'
      );
    });
  });

  describe('bytes (B)', () => {
    it('should format single byte', () => {
      expect(formatBytes(1)).toBe('1 B');
    });

    it('should format bytes less than 1 KB', () => {
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1023)).toBe('1023 B');
    });
  });

  describe('kilobytes (KB)', () => {
    it('should format exactly 1 KB', () => {
      expect(formatBytes(1024)).toBe('1 KB');
    });

    it('should format KB with decimals', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(2048)).toBe('2 KB');
      expect(formatBytes(4871)).toBe('4.76 KB');
    });

    it('should format KB with 2 decimal precision', () => {
      expect(formatBytes(1075)).toBe('1.05 KB');
      expect(formatBytes(1024 * 1.999)).toBe('2 KB');
    });
  });

  describe('megabytes (MB)', () => {
    it('should format exactly 1 MB', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
    });

    it('should format MB with decimals', () => {
      expect(formatBytes(1572864)).toBe('1.5 MB');
      expect(formatBytes(4141914)).toBe('3.95 MB');
    });

    it('should format large MB values', () => {
      expect(formatBytes(52428800)).toBe('50 MB');
      expect(formatBytes(104857600)).toBe('100 MB');
      expect(formatBytes(524288000)).toBe('500 MB');
    });
  });

  describe('gigabytes (GB)', () => {
    it('should format exactly 1 GB', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('should format GB with decimals', () => {
      expect(formatBytes(1610612736)).toBe('1.5 GB');
      expect(formatBytes(5368709120)).toBe('5 GB');
    });

    it('should format large GB values', () => {
      expect(formatBytes(10737418240)).toBe('10 GB');
      expect(formatBytes(107374182400)).toBe('100 GB');
    });
  });

  describe('terabytes (TB)', () => {
    it('should format exactly 1 TB', () => {
      expect(formatBytes(1099511627776)).toBe('1 TB');
    });

    it('should format TB with decimals', () => {
      expect(formatBytes(1649267441664)).toBe('1.5 TB');
      expect(formatBytes(5497558138880)).toBe('5 TB');
    });

    it('should format large TB values', () => {
      expect(formatBytes(10995116277760)).toBe('10 TB');
    });
  });

  describe('decimal precision', () => {
    it('should always use 2 decimal places', () => {
      expect(formatBytes(1024 * 1.1)).toBe('1.1 KB');
      expect(formatBytes(1024 * 1.11)).toBe('1.11 KB');
      expect(formatBytes(1024 * 1.111)).toBe('1.11 KB');
      expect(formatBytes(1024 * 1.116)).toBe('1.12 KB');
    });

    it('should round correctly', () => {
      expect(formatBytes(1024 * 1.994)).toBe('1.99 KB');
      expect(formatBytes(1024 * 1.995)).toBe('2 KB');
      expect(formatBytes(1024 * 1.996)).toBe('2 KB');
    });
  });

  describe('real-world examples', () => {
    it('should format typical image file sizes', () => {
      expect(formatBytes(50 * 1024)).toBe('50 KB'); // Small image
      expect(formatBytes(500 * 1024)).toBe('500 KB'); // Medium image
      expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB'); // Large image
    });

    it('should format typical video file sizes', () => {
      expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB'); // Short video
      expect(formatBytes(500 * 1024 * 1024)).toBe('500 MB'); // Medium video
      expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2 GB'); // HD video
    });

    it('should match example from issue', () => {
      // From the issue: 4141914 bytes should be ~3.95 MB
      expect(formatBytes(4141914)).toBe('3.95 MB');
      // From the issue: 4871 bytes should be ~4.76 KB
      expect(formatBytes(4871)).toBe('4.76 KB');
    });
  });
});
