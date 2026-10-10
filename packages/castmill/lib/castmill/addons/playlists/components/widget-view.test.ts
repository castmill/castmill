import { describe, expect, it } from 'vitest';
import {
  getWidgetViewAspectRatio,
  getWidgetViewContainerStyle,
  resolveEffectiveWidgetData,
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

describe('resolveEffectiveWidgetData', () => {
  const integration = { temperature: '18°C' };
  const configData = { temperature: '15°C' };
  const defaultData = { temperature: '10°C' };

  it('prefers preview data so unsaved option changes are reflected', () => {
    const preview = { temperature: '64°F' };
    expect(
      resolveEffectiveWidgetData(preview, integration, configData, defaultData)
    ).toBe(preview);
  });

  it('falls back to integration data while preview data is loading (null)', () => {
    expect(
      resolveEffectiveWidgetData(null, integration, configData, defaultData)
    ).toBe(integration);
  });

  it('ignores preview data entirely when the prop is not provided', () => {
    expect(
      resolveEffectiveWidgetData(
        undefined,
        integration,
        configData,
        defaultData
      )
    ).toBe(integration);
  });

  it('falls back to config data, then defaults', () => {
    expect(
      resolveEffectiveWidgetData(null, null, configData, defaultData)
    ).toBe(configData);
    expect(resolveEffectiveWidgetData(null, null, null, defaultData)).toBe(
      defaultData
    );
  });
});
