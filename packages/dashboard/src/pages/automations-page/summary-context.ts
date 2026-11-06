import { useI18n } from '../../i18n';
import type { SummaryContext } from './registry-types';
import { playlistName } from './playlist-names';

/** Reactive summary context for the current locale. */
export const useSummaryContext = (): (() => SummaryContext) => {
  const { t, locale } = useI18n();
  return () => ({ t, locale: locale(), playlistName });
};
