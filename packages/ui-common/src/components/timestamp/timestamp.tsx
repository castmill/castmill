/** @jsxImportSource solid-js */
import { Component, createSignal, onMount, onCleanup } from 'solid-js';
import { formatRelativeTime, formatTimestamp } from '../formatters/time';
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
   * Whether to show a tooltip with absolute time when hovering (only applies to relative mode)
   * @default true
   */
  showTooltip?: boolean;
}

/**
 * Timestamp component that displays dates in human-readable format.
 * In relative mode, shows time like "2 hours ago" with an optional tooltip showing the absolute time.
 * In absolute mode, shows formatted date like "May 10, 2025, 08:39 UTC".
 */
export const Timestamp: Component<TimestampProps> = (props) => {
  const mode = () => props.mode ?? 'relative';
  const showTooltip = () => props.showTooltip ?? true;
  
  const [displayText, setDisplayText] = createSignal('');
  const [tooltipText, setTooltipText] = createSignal('');
  
  // Update display text
  const updateDisplayText = () => {
    if (mode() === 'relative') {
      setDisplayText(formatRelativeTime(props.value));
    } else {
      setDisplayText(formatTimestamp(props.value));
    }
    
    // Tooltip always shows absolute time
    if (showTooltip()) {
      setTooltipText(formatTimestamp(props.value));
    }
  };
  
  // Update on mount
  onMount(() => {
    updateDisplayText();
    
    // For relative time, update every minute to keep it fresh
    if (mode() === 'relative') {
      const interval = setInterval(updateDisplayText, 60000); // Update every minute
      onCleanup(() => clearInterval(interval));
    }
  });
  
  // If tooltip is disabled or mode is absolute, render simple span
  if (!showTooltip() || mode() === 'absolute') {
    return <span class={styles.timestamp}>{displayText()}</span>;
  }
  
  // Render with tooltip
  return (
    <span class={styles.timestampWithTooltip} title={tooltipText()}>
      {displayText()}
    </span>
  );
};
