import './index.css';
import { render } from 'solid-js/web';

import { PlayerFrame } from './components/player-frame';


const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

document.addEventListener('keydown', (e) => {
  console.log('key pressed webos', e);
});

render(() => <PlayerFrame />, root!);
