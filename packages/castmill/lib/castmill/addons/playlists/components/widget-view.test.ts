import { describe, expect, it } from 'vitest';
import type { JsonWidgetTemplate } from '@castmill/player';
import {
  applyWidgetMaxItemsFilter,
  feedSnapshotForSelection,
  getWidgetViewAspectRatio,
  getWidgetViewContainerStyle,
  matchesWidgetDataUpdate,
  resolveEffectiveWidgetData,
} from './widget-view';

describe('feedSnapshotForSelection', () => {
  it('discards a pushed snapshot when the selected feed changes', () => {
    const snapshot = { feedId: 'feed-a', data: { title: 'old' } };
    const afterSwitchToB = feedSnapshotForSelection(snapshot, 'feed-b');

    expect(afterSwitchToB).toBeNull();
    expect(feedSnapshotForSelection(afterSwitchToB, 'feed-a')).toBeNull();
  });

  it('keeps snapshots belonging to the selected feed', () => {
    const snapshot = { feedId: 'feed-a', data: { title: 'current' } };
    expect(feedSnapshotForSelection(snapshot, 'feed-a')).toBe(snapshot);
  });
});

describe('WidgetView aspect ratio helpers', () => {
  it('uses layout-ref aspect ratio when present in options', () => {
    expect(
      getWidgetViewAspectRatio(
        {
          id: 1,
          name: 'Layout Widget',
          template: {} as JsonWidgetTemplate,
          aspect_ratio: '16:9',
        },
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
      getWidgetViewAspectRatio(
        { id: 1, name: 'Weather', template: {} as JsonWidgetTemplate },
        {}
      )
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

describe('matchesWidgetDataUpdate', () => {
  const widgetId = 12;

  it('accepts updates for the matching widget and discriminator', () => {
    expect(
      matchesWidgetDataUpdate(
        { widget_id: '12', discriminator_id: 'org:1|query:a' },
        widgetId,
        'org:1|query:a'
      )
    ).toBe(true);
  });

  it('ignores updates for another widget, discriminator, or unknown discriminator', () => {
    expect(
      matchesWidgetDataUpdate(
        { widget_id: '13', discriminator_id: 'org:1|query:a' },
        widgetId,
        'org:1|query:a'
      )
    ).toBe(false);
    expect(
      matchesWidgetDataUpdate(
        { widget_id: '12', discriminator_id: 'org:1|query:b' },
        widgetId,
        'org:1|query:a'
      )
    ).toBe(false);
    expect(
      matchesWidgetDataUpdate(
        { widget_id: '12', discriminator_id: 'org:1|query:a' },
        widgetId,
        null
      )
    ).toBe(false);
  });
});

describe('applyWidgetMaxItemsFilter', () => {
  const data = { items: [{ id: 1 }, { id: 2 }, { id: 3 }] };

  it('limits notification data using the current widget options', () => {
    expect(applyWidgetMaxItemsFilter(data, { max_items: 2 })).toEqual({
      items: [{ id: 1 }, { id: 2 }],
    });
  });

  it('uses the default item limit when max_items is unset', () => {
    expect(applyWidgetMaxItemsFilter(data, {})).toEqual(data);
  });

  it('ignores non-numeric max_items values', () => {
    expect(applyWidgetMaxItemsFilter(data, { max_items: '2' })).toEqual(data);
  });
});
