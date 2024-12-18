import './index.css';
import { render } from 'solid-js/web';
import { deviceInfo, utility, signage } from './native';

import { PlayerFrame } from './components/player-frame';
import './polyfills/fetch';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error('Root element not found.');
}

const getDI = async () => {
  const di = await deviceInfo.getPlatformInfo();

  utility.createToast({ msg: 'platform info:' + di.modelName.length });

  signage.unregisterSystemMonitor();
};

getDI();

render(() => <PlayerFrame />, root!);
