import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { BsClock } from 'solid-icons/bs';

import {
  MetricGauge,
  MetricGrid,
  SegmentedBar,
  StatTile,
  metricTone,
  usagePercent,
} from './metrics';

describe('metricTone', () => {
  it('maps usage values to tones', () => {
    expect(metricTone(10)).toBe('success');
    expect(metricTone(70)).toBe('warning');
    expect(metricTone(95)).toBe('error');
    expect(metricTone(Number.NaN)).toBe('neutral');
  });

  it('supports inverted thresholds where lower is worse', () => {
    const thresholds = { warning: 70, critical: 40, invert: true };
    expect(metricTone(80, thresholds)).toBe('success');
    expect(metricTone(50, thresholds)).toBe('warning');
    expect(metricTone(20, thresholds)).toBe('error');
  });
});

describe('usagePercent', () => {
  it('returns a clamped, rounded percentage', () => {
    expect(usagePercent(1, 3)).toBe(33);
    expect(usagePercent(5, 4)).toBe(100);
    expect(usagePercent(-1, 4)).toBe(0);
  });

  it('is undefined without a valid total', () => {
    expect(usagePercent(1, 0)).toBeUndefined();
    expect(usagePercent(Number.NaN, 4)).toBeUndefined();
  });
});

describe('MetricGauge', () => {
  it('renders an accessible meter with the percentage', () => {
    const { getByRole } = render(() => (
      <MetricGauge label="Memory" value={42.4} detail="1 GB / 2 GB" />
    ));
    const meter = getByRole('meter', { name: 'Memory' });
    expect(meter).toHaveAttribute('aria-valuenow', '42');
    expect(meter).toHaveAttribute('aria-valuetext', '42%');
    expect(meter).toHaveAttribute('data-tone', 'success');
    expect(meter).toHaveTextContent('1 GB / 2 GB');
  });

  it('draws the arc proportionally and clamps the value', () => {
    const [value, setValue] = createSignal(50);
    const { container, getByRole } = render(() => (
      <MetricGauge label="CPU" value={value()} />
    ));
    const arc = () => container.querySelector('[data-gauge-value]');
    expect(arc()).toHaveAttribute('stroke-dasharray', '37.5 100');

    setValue(150);
    expect(arc()).toHaveAttribute('stroke-dasharray', '75 100');
    expect(getByRole('meter')).toHaveAttribute('data-tone', 'error');
  });

  it('accepts custom text and a fixed tone', () => {
    const { getByRole } = render(() => (
      <MetricGauge label="Battery" value={80} valueText="80 %" tone="info" />
    ));
    expect(getByRole('meter')).toHaveTextContent('80 %');
    expect(getByRole('meter')).toHaveAttribute('data-tone', 'info');
  });
});

describe('StatTile', () => {
  it('renders the label, value, detail and icon', () => {
    const { container, getByText } = render(() => (
      <StatTile
        label="Uptime"
        value="3d 2h"
        detail="Since boot"
        icon={BsClock}
        tone="success"
      />
    ));
    expect(getByText('Uptime')).toBeInTheDocument();
    expect(getByText('3d 2h')).toBeInTheDocument();
    expect(getByText('Since boot')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'success');
  });
});

describe('SegmentedBar', () => {
  it('sizes the segments relative to their sum and lists them', () => {
    const { container, getByRole, getByText } = render(() => (
      <SegmentedBar
        label="Cache"
        segments={[
          { label: 'Media', value: 3, valueText: '3 MB' },
          { label: 'Data', value: 1 },
        ]}
      />
    ));
    expect(getByRole('img', { name: 'Cache' })).toBeInTheDocument();
    const segments = container.querySelectorAll('[data-segment]');
    expect((segments[0] as HTMLElement).style.width).toBe('75%');
    expect((segments[1] as HTMLElement).style.width).toBe('25%');
    expect(getByText('3 MB')).toBeInTheDocument();
    expect(getByText('1')).toBeInTheDocument();
  });

  it('uses the given capacity and handles empty values', () => {
    const { container } = render(() => (
      <SegmentedBar
        label="Disk"
        total={10}
        segments={[
          { label: 'Used', value: 5 },
          { label: 'Bad', value: Number.NaN },
        ]}
      />
    ));
    const segments = container.querySelectorAll('[data-segment]');
    expect((segments[0] as HTMLElement).style.width).toBe('50%');
    expect((segments[1] as HTMLElement).style.width).toBe('0%');
  });

  it('renders empty segments without a total', () => {
    const { container } = render(() => (
      <SegmentedBar label="Empty" segments={[{ label: 'A', value: 0 }]} />
    ));
    expect(
      (container.querySelector('[data-segment]') as HTMLElement).style.width
    ).toBe('0%');
  });
});

describe('MetricGrid', () => {
  it('renders its children and an optional minimum cell width', () => {
    const { container, getByText } = render(() => (
      <MetricGrid minItemWidth="12em">
        <span>Cell</span>
      </MetricGrid>
    ));
    expect(getByText('Cell')).toBeInTheDocument();
    expect(
      (container.firstElementChild as HTMLElement).style.getPropertyValue(
        '--metric-min-width'
      )
    ).toBe('12em');
  });
});
