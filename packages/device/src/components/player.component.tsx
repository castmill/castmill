import { onMount, createSignal, Show } from 'solid-js';
import { Device } from '../classes';

export function PlayerComponent(props: { device: Device }) {
  let playerElement: HTMLDivElement | undefined;
  let logElement: HTMLDivElement | undefined;

  const [timerOff, setTimerOff] = createSignal(false);
  const [nextOnTime, setNextOnTime] = createSignal<string>('');

  onMount(async () => {
    // Check if player is off due to timer
    const isOff = await props.device.isTimerOff();
    if (isOff) {
      setTimerOff(true);
      const nextOn = await props.device.getNextOnTime();
      if (nextOn) {
        setNextOnTime(nextOn.toLocaleString());
      }
    } else {
      props.device.start(playerElement!, logElement!);
    }
  });

  return (
    <>
      <div
        ref={playerElement}
        style={{
          width: '100%',
          height: '100%',
          background: 'black',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        }}
      >
        <Show when={timerOff()}>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              'text-align': 'center',
              color: 'white',
              'font-size': '2em',
              'font-family': 'sans-serif',
              padding: '2em',
              'background-color': 'rgba(0, 0, 0, 0.8)',
              'border-radius': '10px',
            }}
          >
            <div style={{ 'margin-bottom': '1em' }}>
              Playback turned off by timer
            </div>
            <Show when={nextOnTime()}>
              <div style={{ 'font-size': '0.7em', color: '#ccc' }}>
                Next scheduled turn on: {nextOnTime()}
              </div>
            </Show>
          </div>
        </Show>
      </div>
      <div
        ref={logElement}
        style="display: none; background-color: white; color: black; width: 40%; height: 40%; overflow-y: scroll;"
      ></div>
    </>
  );
}
