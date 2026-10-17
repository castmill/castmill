import './index.css';
import { render } from 'solid-js/web';

import { PlayerFrame } from './components/player-frame';
import './polyfills/fetch';
import { registerLegacyAppShell } from './offline/app-shell';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error('Root element not found.');
}

void registerLegacyAppShell();

render(() => <PlayerFrame />, root!);
document.getElementById('legacy-boot')?.remove();
