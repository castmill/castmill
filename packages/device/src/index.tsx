/* @refresh reload */
import { render } from 'solid-js/web';

import './index.css';
import App from './App';
import { Device } from './classes/device';
import { BrowserMachine } from './integrations/browser';
import { StorageBrowser } from '@castmill/cache';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got mispelled?'
  );
}

// Create device instance for browser environment
const machine = new BrowserMachine();
const storage = new StorageBrowser('device');
const device = new Device(machine, storage);

render(() => <App device={device} />, root!);
