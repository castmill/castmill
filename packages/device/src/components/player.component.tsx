import { onMount } from 'solid-js';
import { Device } from '../classes';

export function PlayerComponent(props: { device: Device }) {
  let playerElement: HTMLDivElement | undefined;
  let logElement: HTMLDivElement | undefined;

  onMount(() => {
    props.device.start(playerElement!, logElement!);
  });

  return (
    <>
      <div ref={playerElement} style={
        {
          width: '100%',
          height: '100%',
          background: 'black',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        }
      }></div>
      <div
        ref={logElement}
        style="display: none; background-color: white; color: black; width: 40%; height: 40%; overflow-y: scroll;"
      ></div>
    </>
  );
}
