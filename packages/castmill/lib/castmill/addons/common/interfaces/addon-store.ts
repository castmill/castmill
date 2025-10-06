import { Socket } from 'phoenix';
import { Env } from './env';

// i18n function types
export type TranslateFn = (key: string, params?: Record<string, any>) => string;
export type TranslatePluralFn = (key: string, count: number, params?: Record<string, any>) => string;
export type FormatDateFn = (date: Date, format?: string) => string;
export type FormatNumberFn = (value: number, options?: Intl.NumberFormatOptions) => string;
export type FormatCurrencyFn = (value: number, currency?: string, options?: Intl.NumberFormatOptions) => string;

export interface AddonStore {
  organizations: { selectedId: string };
  socket: Socket;
  env: Env;
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
