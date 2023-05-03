import { onMount } from "solid-js";
import { Device } from "../classes";

export function PlayerComponent(props: { device: Device }) {
  let playerElement: HTMLDivElement | undefined;

  onMount(() => {
    console.log("PlayerComponent onMount", playerElement);
    props.device.start(playerElement!);
  });

  return <div ref={playerElement}>This should be the player!</div>;
}
