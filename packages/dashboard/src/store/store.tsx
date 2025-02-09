/**
 * Global store for the application
 *
 */
import { Socket } from 'phoenix';
import { createStore } from 'solid-js/store';

import { AddOn } from '../interfaces/addon.interface';
import { Organization } from '../interfaces/organization';
import { baseUrl, origin, domain } from '../env';

interface CastmillStore {
  loadedAddons: boolean;
  loadingAddons: boolean;
  addons: AddOn[];

  organizations: {
    loaded: boolean;
    loading: boolean;
    data: Organization[];
    selectedId: string | null;
    selectedName: string;
  };

  socket?: Socket;

  env: {
    baseUrl: string;
    origin: string;
    domain: string;
  };
}

const [store, setStore] = createStore<CastmillStore>({
  loadedAddons: false,
  loadingAddons: false,
  addons: [],

  organizations: {
    loaded: false,
    loading: false,
    data: [],
    selectedId: null,
    selectedName: '',
  },

  env: {
    baseUrl,
    origin,
    domain,
  },
});

export { store, setStore };
