/** @jsxImportSource solid-js */
import { Component, createSignal, onMount, onCleanup } from 'solid-js';
import {
  formatRelativeTimeLocalized,
  formatTimestamp,
} from '../formatters/time';
import styles from './timestamp.module.scss';

export interface TimestampProps {
  /**
   * The timestamp to display (ISO string or Date object)
   */
  value: string | Date;

  /**
   * Display mode: 'relative' shows "2 hours ago", 'absolute' shows "May 10, 2025, 08:39 UTC"
   * @default 'relative'
   */
  mode?: 'relative' | 'absolute';

  /**
   * Whether to show a tooltip with absolute time when hovering (only applies
   * to relative mode). Tapping or activating it with the keyboard toggles
   * the absolute time, so touch users can reach it too.
   * @default true
   */
  showTooltip?: boolean;

  /**
   * Locale used for relative time formatting (e.g. 'sv', 'en-US')
   */
  locale?: string;
}

/**
 * Timestamp component that displays dates in human-readable format.
 * In relative mode, shows time like "2 hours ago" with an optional tooltip showing the absolute time.
 * In absolute mode, shows formatted date like "May 10, 2025, 08:39 UTC".
 */
export const Timestamp: Component<TimestampProps> = (props) => {
  const mode = () => props.mode ?? 'relative';
  const showTooltip = () => props.showTooltip ?? true;

  // Compute display text based on mode
  const displayText = () => {
    if (mode() === 'relative') {
      return formatRelativeTimeLocalized(props.value, props.locale);
    } else {
      return formatTimestamp(props.value);
    }
  };

  // Compute tooltip text (always absolute time)
  const tooltipText = () => {
    if (showTooltip()) {
      return formatTimestamp(props.value);
    }
    return '';
  };

  const [tick, setTick] = createSignal(0);
  const [showAbsolute, setShowAbsolute] = createSignal(false);

  // Update tick every minute for relative time to trigger re-render
  onMount(() => {
    if (mode() === 'relative') {
      const interval = setInterval(() => {
        setTick(tick() + 1);
      }, 60000); // Update every minute
      onCleanup(() => clearInterval(interval));
    }
  });

  // Force re-computation by accessing tick (unused but triggers reactivity)
  const _ = tick();

  // If tooltip is disabled or mode is absolute, render simple span
  if (!showTooltip() || mode() === 'absolute') {
    return <span class={styles.timestamp}>{displayText()}</span>;
  }

  // Render with tooltip; hover-only tooltips are unreachable on touch, so a
  // tap (or Enter/Space) swaps the relative text for the absolute time.
  return (
    <button
      type="button"
      class={styles.timestampWithTooltip}
      title={tooltipText()}
      aria-pressed={showAbsolute()}
      onClick={() => setShowAbsolute(!showAbsolute())}
    >
      {showAbsolute() ? tooltipText() : displayText()}
    </button>
  );
};
