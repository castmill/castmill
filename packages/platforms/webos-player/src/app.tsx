import { render } from 'solid-js/web';
import { PlayerFrame } from './components/player-frame';

export function start(root: HTMLElement): void {
  render(() => <PlayerFrame />, root);
  document.getElementById('webos-boot')?.remove();
}
