import { describe, expect, it } from 'vitest';
import {
  getWidgetViewAspectRatio,
  getWidgetViewContainerStyle,
} from './widget-view';

describe('WidgetView aspect ratio helpers', () => {
  it('uses layout-ref aspect ratio when present in options', () => {
    expect(
      getWidgetViewAspectRatio(
        { id: 1, name: 'Layout Widget', template: {}, aspect_ratio: '16:9' },
        {
          layout: {
            layoutId: 10,
            aspectRatio: '9:16',
          },
        }
      )
    ).toBeCloseTo(9 / 16);
  });

  it('returns null when the widget has no fixed aspect ratio', () => {
    expect(
      getWidgetViewAspectRatio({ id: 1, name: 'Weather', template: {} }, {})
    ).toBeNull();
  });

  it('fills the available container when there is no fixed aspect ratio', () => {
    expect(
      getWidgetViewContainerStyle({ width: 360, height: 640 }, null)
    ).toEqual({
      width: '360px',
      height: '640px',
    });
  });

  it('keeps contain sizing for fixed aspect ratios', () => {
    expect(
      getWidgetViewContainerStyle({ width: 360, height: 640 }, 16 / 9)
    ).toEqual({
      width: '360px',
      height: '202.5px',
    });
  });
});
