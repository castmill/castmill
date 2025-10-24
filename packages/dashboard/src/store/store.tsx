/**
 * Global store for the application
 *
 */
import { Socket } from 'phoenix';
import { createStore } from 'solid-js/store';

import { AddOn } from '../interfaces/addon.interface';
import { Organization } from '../interfaces/organization';
import { baseUrl, origin, domain } from '../env';
import type {
  Role,
  ResourceType,
  Action,
} from '../services/permissions.service';
import type { KeyboardShortcut } from '../hooks/useKeyboardShortcuts';

interface OrganizationLogoState {
  mediaId: number | null;
  url: string | null | undefined;
  loading?: boolean;
  error?: boolean;
}

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
    logos: Record<string, OrganizationLogoState>;
  };

  // Permissions for the current organization
  permissions: {
    loaded: boolean;
    loading: boolean;
    role?: Role;
    matrix?: Record<ResourceType, Action[]>;
  };

  socket?: Socket;

  env: {
    baseUrl: string;
    origin: string;
    domain: string;
  };

  // i18n functions (set by wrapLazyComponent)
  i18n?: {
    t: (key: string, params?: Record<string, any>) => string;
    tp: (key: string, count: number, params?: Record<string, any>) => string;
    formatDate: (date: Date, format?: string) => string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    formatCurrency: (
      value: number,
      currency?: string,
      options?: Intl.NumberFormatOptions
    ) => string;
    locale: () => string;
    setLocale: (locale: any) => void; // Using any to match i18n context signature
  };

  // Keyboard shortcuts registry (set by index.tsx)
  keyboardShortcuts?: {
    registerShortcut: (id: string, shortcut: KeyboardShortcut) => void;
    unregisterShortcut: (id: string) => void;
    registerShortcutAction: (
      id: string,
      action: () => void,
      condition?: () => boolean
    ) => void;
    unregisterShortcutAction: (id: string) => void;
    getShortcuts: () => Map<string, KeyboardShortcut>;
    formatShortcut: (shortcut: KeyboardShortcut) => string;
    isMac: () => boolean;
    isMobile: () => boolean;
  };

  // Router utilities (set by wrapLazyComponent)
  router?: {
    navigate: (path: string, options?: any) => void;
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
    logos: {},
  },

  permissions: {
    loaded: false,
    loading: false,
  },

  env: {
    baseUrl,
    origin,
    domain,
  },
});

export { store, setStore };
