import { expect } from 'chai';
import { describe, it } from 'mocha';
import type {
  LayoutZone,
  LayoutOptionValue,
  LayoutFieldAttributes,
} from '../src/interfaces/schema.interface';
import { zoneToStyle } from '../src/widgets/template/layout-utils';

describe('Layout Schema Types', () => {
  describe('LayoutZone', () => {
    it('should define a valid zone with all properties', () => {
      const zone: LayoutZone = {
        id: 'zone-1',
        name: 'Header',
        rect: { x: 0, y: 0, width: 100, height: 20 },
        zIndex: 1,
        playlistId: 123,
      };

      expect(zone.id).to.equal('zone-1');
      expect(zone.name).to.equal('Header');
      expect(zone.rect.x).to.equal(0);
      expect(zone.rect.y).to.equal(0);
      expect(zone.rect.width).to.equal(100);
      expect(zone.rect.height).to.equal(20);
      expect(zone.zIndex).to.equal(1);
      expect(zone.playlistId).to.equal(123);
    });

    it('should allow zone without playlist (for empty zones)', () => {
      const zone: LayoutZone = {
        id: 'zone-empty',
        name: 'Empty Zone',
        rect: { x: 50, y: 50, width: 50, height: 50 },
        zIndex: 2,
      };

      expect(zone.playlistId).to.be.undefined;
    });

    it('should support overlapping zones with different z-indices', () => {
      const bottomZone: LayoutZone = {
        id: 'background',
        name: 'Background',
        rect: { x: 0, y: 0, width: 100, height: 100 },
        zIndex: 0,
      };

      const topZone: LayoutZone = {
        id: 'overlay',
        name: 'Overlay',
        rect: { x: 25, y: 25, width: 50, height: 50 },
        zIndex: 10,
      };

      expect(topZone.zIndex).to.be.greaterThan(bottomZone.zIndex);
    });
  });

  describe('LayoutOptionValue', () => {
    it('should define a valid layout with aspect ratio and zones', () => {
      const layout: LayoutOptionValue = {
        aspectRatio: '16:9',
        zones: [
          {
            id: 'main',
            name: 'Main Content',
            rect: { x: 0, y: 0, width: 70, height: 100 },
            zIndex: 1,
            playlistId: 1,
          },
          {
            id: 'sidebar',
            name: 'Sidebar',
            rect: { x: 70, y: 0, width: 30, height: 100 },
            zIndex: 1,
            playlistId: 2,
          },
        ],
      };

      expect(layout.aspectRatio).to.equal('16:9');
      expect(layout.zones).to.have.lengthOf(2);
    });

    it('should support portrait aspect ratios', () => {
      const layout: LayoutOptionValue = {
        aspectRatio: '9:16',
        zones: [],
      };

      expect(layout.aspectRatio).to.equal('9:16');
    });

    it('should allow empty zones array', () => {
      const layout: LayoutOptionValue = {
        aspectRatio: '4:3',
        zones: [],
      };

      expect(layout.zones).to.deep.equal([]);
    });

    it('should support complex multi-zone layouts', () => {
      const layout: LayoutOptionValue = {
        aspectRatio: '16:9',
        zones: [
          {
            id: 'header',
            name: 'Header',
            rect: { x: 0, y: 0, width: 100, height: 15 },
            zIndex: 1,
          },
          {
            id: 'main',
            name: 'Main',
            rect: { x: 0, y: 15, width: 70, height: 70 },
            zIndex: 1,
          },
          {
            id: 'sidebar',
            name: 'Sidebar',
            rect: { x: 70, y: 15, width: 30, height: 70 },
            zIndex: 1,
          },
          {
            id: 'footer',
            name: 'Footer',
            rect: { x: 0, y: 85, width: 100, height: 15 },
            zIndex: 1,
          },
          {
            id: 'overlay',
            name: 'Breaking News',
            rect: { x: 10, y: 40, width: 80, height: 20 },
            zIndex: 10,
          },
        ],
      };

      expect(layout.zones).to.have.lengthOf(5);
      // Overlay should be on top
      const overlay = layout.zones.find((z) => z.id === 'overlay');
      expect(overlay?.zIndex).to.equal(10);
    });
  });

  describe('LayoutFieldAttributes', () => {
    it('should define a valid layout field schema', () => {
      const field: LayoutFieldAttributes = {
        type: 'layout',
        required: true,
        description: 'Configure the screen layout',
        order: 1,
      };

      expect(field.type).to.equal('layout');
      expect(field.required).to.equal(true);
    });

    it('should support default layout value', () => {
      const field: LayoutFieldAttributes = {
        type: 'layout',
        default: {
          aspectRatio: '16:9',
          zones: [
            {
              id: 'fullscreen',
              name: 'Fullscreen',
              rect: { x: 0, y: 0, width: 100, height: 100 },
              zIndex: 1,
            },
          ],
        },
      };

      expect(field.default?.aspectRatio).to.equal('16:9');
      expect(field.default?.zones).to.have.lengthOf(1);
    });

    it('should support custom aspect ratio presets', () => {
      const field: LayoutFieldAttributes = {
        type: 'layout',
        aspectRatios: ['16:9', '9:16', '4:3', '1:1', '21:9'],
      };

      expect(field.aspectRatios).to.include('16:9');
      expect(field.aspectRatios).to.include('9:16');
      expect(field.aspectRatios).to.have.lengthOf(5);
    });
  });

  describe('Layout percentage validation (conceptual)', () => {
    it('should use percentage values between 0-100', () => {
      const zone: LayoutZone = {
        id: 'test',
        name: 'Test',
        rect: { x: 25, y: 25, width: 50, height: 50 },
        zIndex: 1,
      };

      // All values should be percentages
      expect(zone.rect.x).to.be.at.least(0);
      expect(zone.rect.x).to.be.at.most(100);
      expect(zone.rect.y).to.be.at.least(0);
      expect(zone.rect.y).to.be.at.most(100);
      expect(zone.rect.width).to.be.at.least(0);
      expect(zone.rect.width).to.be.at.most(100);
      expect(zone.rect.height).to.be.at.least(0);
      expect(zone.rect.height).to.be.at.most(100);
    });

    it('zones can extend beyond 100% for overflow layouts', () => {
      // Some designs may intentionally overflow
      const zone: LayoutZone = {
        id: 'overflow',
        name: 'Overflow Zone',
        rect: { x: 80, y: 0, width: 40, height: 100 },
        zIndex: 1,
      };

      // x + width = 120%, valid for off-screen content
      expect(zone.rect.x + zone.rect.width).to.equal(120);
    });
  });
});

describe('zoneToStyle', () => {
  it('should convert zone rect to CSS percentage values', () => {
    const zone: LayoutZone = {
      id: 'test-zone',
      name: 'Test Zone',
      rect: { x: 10, y: 20, width: 30, height: 40 },
      zIndex: 5,
    };

    const style = zoneToStyle(zone);

    expect(style.position).to.equal('absolute');
    expect(style.left).to.equal('10%');
    expect(style.top).to.equal('20%');
    expect(style.width).to.equal('30%');
    expect(style.height).to.equal('40%');
    expect(style['z-index']).to.equal(5);
  });

  it('should handle full-size zone (100% width and height)', () => {
    const zone: LayoutZone = {
      id: 'full-zone',
      name: 'Full Zone',
      rect: { x: 0, y: 0, width: 100, height: 100 },
      zIndex: 0,
    };

    const style = zoneToStyle(zone);

    expect(style.left).to.equal('0%');
    expect(style.top).to.equal('0%');
    expect(style.width).to.equal('100%');
    expect(style.height).to.equal('100%');
  });

  it('should handle fractional percentages', () => {
    const zone: LayoutZone = {
      id: 'fraction-zone',
      name: 'Fractional Zone',
      rect: { x: 33.33, y: 25.5, width: 66.67, height: 74.5 },
      zIndex: 1,
    };

    const style = zoneToStyle(zone);

    expect(style.left).to.equal('33.33%');
    expect(style.top).to.equal('25.5%');
    expect(style.width).to.equal('66.67%');
    expect(style.height).to.equal('74.5%');
  });

  it('should preserve z-index for overlapping zones', () => {
    const backgroundZone: LayoutZone = {
      id: 'background',
      name: 'Background',
      rect: { x: 0, y: 0, width: 100, height: 100 },
      zIndex: 0,
    };

    const overlayZone: LayoutZone = {
      id: 'overlay',
      name: 'Overlay',
      rect: { x: 25, y: 25, width: 50, height: 50 },
      zIndex: 10,
    };

    const bgStyle = zoneToStyle(backgroundZone);
    const overlayStyle = zoneToStyle(overlayZone);

    expect(bgStyle['z-index']).to.equal(0);
    expect(overlayStyle['z-index']).to.equal(10);
  });
});
