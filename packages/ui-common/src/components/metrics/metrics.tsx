/** @jsxImportSource solid-js */

import { For, JSX, ParentComponent, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { IconTypes } from 'solid-icons';

import styles from './metrics.module.scss';

export type MetricTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface MetricThresholds {
  /** Value at or above which the metric is a warning. */
  warning: number;
  /** Value at or above which the metric is critical. */
  critical: number;
  /**
   * Lower values are worse (e.g. battery or signal strength). The thresholds
   * are then lower bounds: below `warning` warns, below `critical` errors.
   */
  invert?: boolean;
}

/** Default thresholds for "used" percentages (memory, storage, CPU...). */
export const USAGE_THRESHOLDS: MetricThresholds = { warning: 70, critical: 90 };

/** Tone of a value for the given thresholds. */
export const metricTone = (
  value: number,
  thresholds: MetricThresholds = USAGE_THRESHOLDS
): MetricTone => {
  if (!Number.isFinite(value)) return 'neutral';
  if (thresholds.invert) {
    if (value < thresholds.critical) return 'error';
    if (value < thresholds.warning) return 'warning';
    return 'success';
  }
  if (value >= thresholds.critical) return 'error';
  if (value >= thresholds.warning) return 'warning';
  return 'success';
};

/** Rounded percentage of `used` over `total`, clamped to 0-100. */
export const usagePercent = (
  used: number,
  total: number
): number | undefined =>
  total > 0 && Number.isFinite(used) && Number.isFinite(total)
    ? Math.min(100, Math.max(0, Math.round((used / total) * 100)))
    : undefined;

const clampPercent = (value: number) =>
  Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

const join = (...classes: Array<string | false | undefined>) =>
  classes.filter(Boolean).join(' ');

// The gauge is a 270° arc, open at the bottom.
const GAUGE_SWEEP = 75;
const GAUGE_RADIUS = 42;

export interface MetricGaugeProps {
  label: string;
  /** Percentage 0-100. */
  value: number;
  /** Text inside the gauge. Defaults to the rounded percentage. */
  valueText?: string;
  /** Secondary line under the label, e.g. "1.2 GB / 4 GB". */
  detail?: JSX.Element;
  /** Fixed tone. Defaults to `metricTone(value, thresholds)`. */
  tone?: MetricTone;
  thresholds?: MetricThresholds;
  class?: string;
}

/** Dependency-free SVG radial gauge for percentages (memory, storage...). */
export const MetricGauge = (props: MetricGaugeProps) => {
  const percent = () => clampPercent(props.value);
  const tone = () => props.tone ?? metricTone(percent(), props.thresholds);
  const valueText = () => props.valueText ?? `${Math.round(percent())}%`;

  return (
    <div
      class={join(styles.gauge, styles[tone()], props.class)}
      role="meter"
      aria-label={props.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent())}
      aria-valuetext={valueText()}
      data-tone={tone()}
    >
      <div class={styles.gaugeDial}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle
            class={styles.gaugeTrack}
            cx="50"
            cy="50"
            r={GAUGE_RADIUS}
            pathLength="100"
            stroke-dasharray={`${GAUGE_SWEEP} 100`}
            transform="rotate(135 50 50)"
          />
          <circle
            class={styles.gaugeValue}
            cx="50"
            cy="50"
            r={GAUGE_RADIUS}
            pathLength="100"
            stroke-dasharray={`${(percent() / 100) * GAUGE_SWEEP} 100`}
            transform="rotate(135 50 50)"
            data-gauge-value
          />
        </svg>
        <span class={styles.gaugeText}>{valueText()}</span>
      </div>
      <div class={styles.gaugeLabel}>{props.label}</div>
      <Show when={props.detail}>
        {(detail) => <div class={styles.gaugeDetail}>{detail()}</div>}
      </Show>
    </div>
  );
};

export interface StatTileProps {
  label: string;
  value: JSX.Element;
  icon?: IconTypes;
  detail?: JSX.Element;
  tone?: MetricTone;
  class?: string;
}

/** Compact "label / large value / detail" tile for a single statistic. */
export const StatTile = (props: StatTileProps) => (
  <div
    class={join(styles.tile, props.tone && styles[props.tone], props.class)}
    data-tone={props.tone}
  >
    <div class={styles.tileHeader}>
      <Show when={props.icon}>
        {(icon) => (
          <span class={styles.tileIcon} aria-hidden="true">
            <Dynamic component={icon()} />
          </span>
        )}
      </Show>
      <span class={styles.tileLabel}>{props.label}</span>
    </div>
    <div class={styles.tileValue}>{props.value}</div>
    <Show when={props.detail}>
      {(detail) => <div class={styles.tileDetail}>{detail()}</div>}
    </Show>
  </div>
);

export interface SegmentedBarSegment {
  label: string;
  value: number;
  /** Text shown in the legend. Defaults to the raw value. */
  valueText?: string;
  tone?: MetricTone;
}

export interface SegmentedBarProps {
  /** Accessible name of the bar. */
  label: string;
  segments: SegmentedBarSegment[];
  /** Capacity of the bar. Defaults to the sum of the segments. */
  total?: number;
  class?: string;
}

const SEGMENT_TONES: MetricTone[] = ['info', 'success', 'warning', 'error'];

const positive = (value: number) =>
  Number.isFinite(value) && value > 0 ? value : 0;

/** Stacked horizontal bar with a legend, e.g. cache size by type. */
export const SegmentedBar = (props: SegmentedBarProps) => {
  const total = () =>
    Math.max(
      positive(props.total ?? 0),
      props.segments.reduce((sum, segment) => sum + positive(segment.value), 0)
    );
  const width = (value: number) =>
    total() > 0 ? `${(positive(value) / total()) * 100}%` : '0%';
  const tone = (segment: SegmentedBarSegment, index: number) =>
    segment.tone ?? SEGMENT_TONES[index % SEGMENT_TONES.length];

  return (
    <div class={join(styles.segmented, props.class)}>
      <div class={styles.segmentedTrack} role="img" aria-label={props.label}>
        <For each={props.segments}>
          {(segment, index) => (
            <span
              class={join(styles.segment, styles[tone(segment, index())])}
              style={{ width: width(segment.value) }}
              data-segment={segment.label}
            />
          )}
        </For>
      </div>
      <ul class={styles.legend}>
        <For each={props.segments}>
          {(segment, index) => (
            <li class={styles[tone(segment, index())]}>
              <span class={styles.legendSwatch} aria-hidden="true" />
              <span class={styles.legendLabel}>{segment.label}</span>
              <span class={styles.legendValue}>
                {segment.valueText ?? String(segment.value)}
              </span>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
};

export interface MetricGridProps {
  class?: string;
  /** Minimum width of each cell (CSS length); the grid wraps to fit. */
  minItemWidth?: string;
}

/** Responsive grid that fits as many metric cells as its container allows. */
export const MetricGrid: ParentComponent<MetricGridProps> = (props) => (
  <div
    class={join(styles.grid, props.class)}
    style={
      props.minItemWidth
        ? { '--metric-min-width': props.minItemWidth }
        : undefined
    }
  >
    {props.children}
  </div>
);
