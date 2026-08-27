import { Component, Show } from 'solid-js';
import './quota-indicator.scss';

export interface QuotaIndicatorProps {
  used: number;
  total: number;
  resourceName: string;
  compact?: boolean;
  warningThreshold?: number; // Percentage threshold for warning (default 90)
}

/**
 * QuotaIndicator Component
 *
 * Displays the current usage versus the total quota for a resource.
 * Shows a progress bar with different states based on usage percentage:
 * - Normal: < warningThreshold (default 90%)
 * - Warning: >= warningThreshold and < 100%
 * - Error: 100% (quota reached)
 *
 * @example
 * <QuotaIndicator used={10} total={100} resourceName="Playlists" />
 * <QuotaIndicator used={95} total={100} resourceName="Medias" compact />
 */
export const QuotaIndicator: Component<QuotaIndicatorProps> = (props) => {
  const warningThreshold = () => props.warningThreshold ?? 90;
  const percentage = () => {
    if (props.total === 0) return 0;
    return Math.round((props.used / props.total) * 100);
  };

  const state = () => {
    const pct = percentage();
    if (pct >= 100) return 'error';
    if (pct >= warningThreshold()) return 'warning';
    return 'normal';
  };

  const stateClass = () => `quota-indicator--${state()}`;

  return (
    <div
      class={`quota-indicator ${stateClass()} ${props.compact ? 'quota-indicator--compact' : ''}`}
      title={`${props.used} of ${props.total} ${props.resourceName} used`}
    >
      <div class="quota-indicator__text">
        <Show when={!props.compact}>
          <span class="quota-indicator__label">
            {props.used} of {props.total} {props.resourceName}
          </span>
        </Show>
        <Show when={props.compact}>
          <span class="quota-indicator__label">
            {props.used}/{props.total} {props.resourceName}
          </span>
        </Show>
        <span class="quota-indicator__percentage">{percentage()}%</span>
      </div>
      <div class="quota-indicator__bar">
        <div
          class="quota-indicator__progress"
          style={{ width: `${Math.min(percentage(), 100)}%` }}
        />
      </div>
    </div>
  );
};
