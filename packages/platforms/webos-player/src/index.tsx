// import '../lib/custom.js';
import './index.css';
// import '../lib/scap_1.7/cordova/2.7.0/cordova.webos.js';
import { render } from 'solid-js/web';
import { deviceInfo, utility, signage } from './native';

import { PlayerFrame } from './components/player-frame';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?'
  );
}

const getDI = async () => {
  const di = await deviceInfo.getPlatformInfo();

  utility.createToast({ msg: 'platform info:' + di.modelName.length });

  signage.unregisterSystemMonitor();
};

getDI();

render(() => <PlayerFrame />, root!);
