/**
 * Global store for the application
 *
 */
import { createStore } from 'solid-js/store';
import { AddOn } from '../interfaces/addon.interface';
import { Organization } from '../interfaces/organization';
import { Socket } from 'phoenix';

interface CastmillStore {
  loadedAddons: boolean;
  loadingAddons: boolean;
  addons: AddOn[];

  organizations: {
    loaded: boolean;
    loading: boolean;
    data: Organization[];
    selectedId: string | null;
  };

  socket?: Socket;
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
  },
});

export { store, setStore };
