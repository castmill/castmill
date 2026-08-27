import { describe, it, expect } from 'vitest';
import {
  parseAspectRatio,
  calculateCanvasSize,
  calculateHeightForAspectRatio,
  calculateWidthForAspectRatio,
} from './layout-editor-utils';

describe('LayoutEditor Utilities', () => {
  describe('parseAspectRatio', () => {
    it('should parse standard aspect ratios', () => {
      expect(parseAspectRatio('16:9')).toEqual({ width: 16, height: 9 });
      expect(parseAspectRatio('9:16')).toEqual({ width: 9, height: 16 });
      expect(parseAspectRatio('4:3')).toEqual({ width: 4, height: 3 });
      expect(parseAspectRatio('1:1')).toEqual({ width: 1, height: 1 });
      expect(parseAspectRatio('21:9')).toEqual({ width: 21, height: 9 });
    });

    it('should return default for invalid formats', () => {
      expect(parseAspectRatio('')).toEqual({ width: 16, height: 9 });
      expect(parseAspectRatio('invalid')).toEqual({ width: 16, height: 9 });
      expect(parseAspectRatio('16')).toEqual({ width: 16, height: 9 });
      expect(parseAspectRatio('16:9:4')).toEqual({ width: 16, height: 9 });
    });

    it('should return default for invalid numbers', () => {
      expect(parseAspectRatio('abc:def')).toEqual({ width: 16, height: 9 });
      expect(parseAspectRatio('0:9')).toEqual({ width: 16, height: 9 });
      expect(parseAspectRatio('16:0')).toEqual({ width: 16, height: 9 });
      expect(parseAspectRatio('-1:9')).toEqual({ width: 16, height: 9 });
    });
  });

  describe('calculateCanvasSize', () => {
    it('should fit landscape aspect ratio in container', () => {
      // 16:9 in a 800x600 container
      const result = calculateCanvasSize(800, 600, '16:9');
      // 800 width would need 450 height (800 / (16/9) = 450)
      expect(result.width).toBe(800);
      expect(result.height).toBe(450);
    });

    it('should fit portrait aspect ratio in container', () => {
      // 9:16 in a 800x600 container
      const result = calculateCanvasSize(800, 600, '9:16');
      // Height-constrained: 600 height needs 337.5 width
      expect(result.height).toBe(600);
      expect(result.width).toBe(337);
    });

    it('should handle square aspect ratio', () => {
      // 1:1 in a 800x600 container
      const result = calculateCanvasSize(800, 600, '1:1');
      // Height-constrained
      expect(result.width).toBe(600);
      expect(result.height).toBe(600);
    });

    it('should handle square container', () => {
      // 16:9 in a 500x500 container
      const result = calculateCanvasSize(500, 500, '16:9');
      expect(result.width).toBe(500);
      expect(result.height).toBe(281); // 500 / (16/9) ≈ 281
    });

    it('should handle height-constrained scenarios', () => {
      // 16:9 in a very wide but short container
      const result = calculateCanvasSize(1000, 200, '16:9');
      // Height-constrained: 200 height, width = 200 * (16/9) ≈ 355
      expect(result.height).toBe(200);
      expect(result.width).toBe(355);
    });

    it('should handle ultra-wide aspect ratio', () => {
      // 21:9 in a 800x600 container
      const result = calculateCanvasSize(800, 600, '21:9');
      expect(result.width).toBe(800);
      expect(result.height).toBe(342); // 800 / (21/9) ≈ 342
    });
  });

  describe('calculateHeightForAspectRatio', () => {
    it('should calculate correct height for 16:9 zone in 16:9 layout', () => {
      // Zone takes 50% width, aspect 16:9 in 16:9 layout
      // Height should also be 50% since ratios match
      const height = calculateHeightForAspectRatio(50, '16:9', '16:9');
      expect(height).toBeCloseTo(50, 1);
    });

    it('should calculate correct height for 16:9 zone in 9:16 layout (portrait)', () => {
      // Zone takes 50% width in a portrait layout with 16:9 zone aspect
      // Layout ratio = 9/16 = 0.5625
      // Zone ratio = 16/9 = 1.778
      // height = (50 * 0.5625) / 1.778 ≈ 15.82%
      const height = calculateHeightForAspectRatio(50, '16:9', '9:16');
      expect(height).toBeCloseTo(15.82, 1);
    });

    it('should calculate correct height for 1:1 zone in 16:9 layout', () => {
      // Zone takes 50% width, square zone in 16:9 layout
      // Layout ratio = 16/9 = 1.778
      // Zone ratio = 1/1 = 1
      // height = (50 * 1.778) / 1 ≈ 88.9%
      const height = calculateHeightForAspectRatio(50, '1:1', '16:9');
      expect(height).toBeCloseTo(88.89, 1);
    });

    it('should calculate correct height for 9:16 zone in 16:9 layout', () => {
      // Zone takes 25% width, portrait zone in landscape layout
      // Layout ratio = 16/9 = 1.778
      // Zone ratio = 9/16 = 0.5625
      // height = (25 * 1.778) / 0.5625 ≈ 79.0%
      const height = calculateHeightForAspectRatio(25, '9:16', '16:9');
      expect(height).toBeCloseTo(79.01, 1);
    });
  });

  describe('calculateWidthForAspectRatio', () => {
    it('should calculate correct width for 16:9 zone in 16:9 layout', () => {
      // Zone takes 50% height, aspect 16:9 in 16:9 layout
      // Width should also be 50% since ratios match
      const width = calculateWidthForAspectRatio(50, '16:9', '16:9');
      expect(width).toBeCloseTo(50, 1);
    });

    it('should calculate correct width for 16:9 zone in 9:16 layout (portrait)', () => {
      // Zone takes 50% height in a portrait layout with 16:9 zone aspect
      // Layout ratio = 9/16 = 0.5625
      // Zone ratio = 16/9 = 1.778
      // width = (50 * 1.778) / 0.5625 ≈ 158.0%
      const width = calculateWidthForAspectRatio(50, '16:9', '9:16');
      expect(width).toBeCloseTo(158.02, 1);
    });

    it('should calculate correct width for 1:1 zone in 16:9 layout', () => {
      // Zone takes 50% height, square zone in 16:9 layout
      // Layout ratio = 16/9 = 1.778
      // Zone ratio = 1/1 = 1
      // width = (50 * 1) / 1.778 ≈ 28.12%
      const width = calculateWidthForAspectRatio(50, '1:1', '16:9');
      expect(width).toBeCloseTo(28.12, 1);
    });

    it('should calculate correct width for 9:16 zone in 16:9 layout', () => {
      // Zone takes 50% height, portrait zone in landscape layout
      // Layout ratio = 16/9 = 1.778
      // Zone ratio = 9/16 = 0.5625
      // width = (50 * 0.5625) / 1.778 ≈ 15.82%
      const width = calculateWidthForAspectRatio(50, '9:16', '16:9');
      expect(width).toBeCloseTo(15.82, 1);
    });
  });

  describe('aspect ratio calculation inverse relationship', () => {
    it('calculateHeightForAspectRatio and calculateWidthForAspectRatio should be inverses', () => {
      const layoutAspect = '16:9';
      const zoneAspect = '4:3';
      const originalWidth = 40;

      // Calculate height from width
      const height = calculateHeightForAspectRatio(
        originalWidth,
        zoneAspect,
        layoutAspect
      );
      // Calculate width back from height
      const calculatedWidth = calculateWidthForAspectRatio(
        height,
        zoneAspect,
        layoutAspect
      );

      expect(calculatedWidth).toBeCloseTo(originalWidth, 5);
    });

    it('should maintain aspect ratio consistency across different layout ratios', () => {
      const testCases = [
        { layout: '16:9', zone: '16:9' },
        { layout: '16:9', zone: '4:3' },
        { layout: '9:16', zone: '16:9' },
        { layout: '1:1', zone: '21:9' },
      ];

      for (const { layout, zone } of testCases) {
        const width = 50;
        const height = calculateHeightForAspectRatio(width, zone, layout);
        const backWidth = calculateWidthForAspectRatio(height, zone, layout);
        expect(backWidth).toBeCloseTo(width, 5);
      }
    });
  });
});
