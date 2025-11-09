import { registerPlugin } from '@capacitor/core';

import type { RemoteInputPlugin } from './definitions';

const RemoteInput = registerPlugin<RemoteInputPlugin>('RemoteInput', {
  web: () => import('./web').then((m) => new m.RemoteInputWeb()),
});

export * from './definitions';
export { RemoteInput };
