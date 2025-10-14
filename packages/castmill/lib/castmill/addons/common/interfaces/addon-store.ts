import { Socket } from 'phoenix';
import { Env } from './env';

// i18n function types
export type TranslateFn = (key: string, params?: Record<string, any>) => string;
export type TranslatePluralFn = (key: string, count: number, params?: Record<string, any>) => string;
export type FormatDateFn = (date: Date, format?: string) => string;
export type FormatNumberFn = (value: number, options?: Intl.NumberFormatOptions) => string;
export type FormatCurrencyFn = (value: number, currency?: string, options?: Intl.NumberFormatOptions) => string;

// Permission types
export type Role = 'admin' | 'manager' | 'regular' | 'guest';
export type ResourceType = 'playlists' | 'medias' | 'channels' | 'devices' | 'teams' | 'widgets';
export type Action = 'list' | 'show' | 'create' | 'update' | 'delete';

// URL search params types (matching @solidjs/router useSearchParams)
export type SearchParams = Record<string, string | undefined>;
export type SetSearchParams = (params: SearchParams, options?: any) => void;

export interface AddonStore {
  organizations: { selectedId: string };
  socket: Socket;
  env: Env;
  
  // Permissions for the current organization
  permissions?: {
    role: Role;
    matrix: Record<ResourceType, Action[]>;
  };
  
  // i18n functions passed from Dashboard
  i18n?: {
    t: TranslateFn;
    tp: TranslatePluralFn;
    formatDate: FormatDateFn;
    formatNumber: FormatNumberFn;
    formatCurrency: FormatCurrencyFn;
    locale: () => string;
    setLocale: (locale: string) => void;
  };
}

/**
 * Props passed to addon components from the Dashboard
 * 
 * Addons receive these props when loaded dynamically. The params prop
 * provides access to URL search parameters from the parent route context,
 * enabling features like shareable filtered views (e.g., ?team_id=5).
 */
export interface AddonComponentProps {
  store: AddonStore;
  selectedOrgId: string;
  params: [SearchParams, SetSearchParams];
}
