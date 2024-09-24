import { registerPlugin } from '@capacitor/core';

import type { CastmillPlugin } from './definitions';

const Castmill = registerPlugin<CastmillPlugin>('Castmill', {
  web: () => import('./web').then((m) => new m.CastmillWeb()),
});

export * from './definitions';
export { Castmill };
