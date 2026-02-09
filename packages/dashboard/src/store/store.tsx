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
import type {
  OnboardingProgress,
  OnboardingStep,
} from '../interfaces/onboarding-progress.interface';
import type { NetworkSettings, SocialLinks } from '../services/network.service';

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

  // Network admin state
  network: {
    loaded: boolean;
    loading: boolean;
    isAdmin: boolean;
    networkId: string | null;
    access?: string;
  };

  // Network settings (loaded for all users, used for footer/topbar branding)
  networkSettings: {
    loaded: boolean;
    loading: boolean;
    logo: string;
    copyright: string;
    email: string;
    defaultLocale: string;
    socialLinks: SocialLinks;
    data?: NetworkSettings;
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

  // Onboarding tour state
  onboarding: {
    showTour: boolean;
    progress: OnboardingProgress | null;
    /** Complete an onboarding step - automatically advances to next step */
    completeStep?: (step: OnboardingStep) => Promise<void>;
    /** Flag to highlight the guide button with animation */
    highlightGuideButton?: boolean;
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

  network: {
    loaded: false,
    loading: false,
    isAdmin: false,
    networkId: null,
  },

  networkSettings: {
    loaded: false,
    loading: false,
    logo: '',
    copyright: '© 2011-2025 Castmill™',
    email: 'support@castmill.com',
    defaultLocale: 'en',
    socialLinks: {},
  },

  env: {
    baseUrl,
    origin,
    domain,
  },

  onboarding: {
    showTour: false,
    progress: null,
  },
});

export { store, setStore };
