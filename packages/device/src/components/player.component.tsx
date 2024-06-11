import { onMount } from 'solid-js';
import { Device } from '../classes';

export function PlayerComponent(props: { device: Device }) {
  let playerElement: HTMLDivElement | undefined;
  let logElement: HTMLDivElement | undefined;

  onMount(() => {
    console.log('PlayerComponent onMount', playerElement);
    props.device.start(playerElement!, logElement!);
  });

  return (
    <>
      <div ref={playerElement} style="background-color: black"></div>
      <div
        ref={logElement}
        style="display: none; background-color: white; color: black; width: 40%; height: 40%; overflow-y: scroll;"
      ></div>
    </>
  );
}
