import { Component, createSignal } from 'solid-js';
import './usage.scss';

export const UsageComponent: Component<{ used: number; total: number }> = (
  props
) => {
  const [usedPercentage] = createSignal(
    Math.round((props.used / props.total) * 100)
  );

  return (
    <div style="display: flex; gap: 20px; font-family: Arial, sans-serif;">
      <div style="flex: 1;">
        <div>
          <div class="title">
            <div>Medias {`${usedPercentage()}%`}</div>
          </div>
          <div
            style={{
              width: '100%',
              height: '18px',
              background: '#d3d3d3',
              'border-radius': '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${usedPercentage()}%`,
                height: '100%',
                background: 'orange',
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};
