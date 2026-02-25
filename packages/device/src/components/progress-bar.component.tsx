import { createSignal, onMount, onCleanup } from 'solid-js';
import { Device, ProgressEvent } from '../classes/device';

export function ProgressBarComponent(props: { device: Device }) {
  const [percent, setPercent] = createSignal(0);
  const [label, setLabel] = createSignal('Initializing…');

  onMount(() => {
    const onProgress = (event: ProgressEvent) => {
      setPercent(event.percent);
      setLabel(event.label);
    };

    props.device.on('progress', onProgress);

    onCleanup(() => {
      props.device.off('progress', onProgress);
    });
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: '0',
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        'justify-content': 'center',
        background: '#000',
        'z-index': '9999',
      }}
    >
      {/* Progress bar track */}
      <div
        style={{
          width: '320px',
          'max-width': '80vw',
          height: '6px',
          'border-radius': '3px',
          background: '#222',
          overflow: 'hidden',
        }}
      >
        {/* Progress bar fill */}
        <div
          style={{
            width: `${percent()}%`,
            height: '100%',
            'border-radius': '3px',
            background: '#4a7cff',
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Step label */}
      <div
        style={{
          'margin-top': '16px',
          color: '#888',
          'font-size': '14px',
          'font-family':
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          'letter-spacing': '0.02em',
        }}
      >
        {label()}
      </div>
    </div>
  );
}
