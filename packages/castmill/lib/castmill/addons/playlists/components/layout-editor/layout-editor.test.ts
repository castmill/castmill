import { describe, it, expect } from 'vitest';
import { parseAspectRatio, calculateCanvasSize } from './layout-editor';

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
});
