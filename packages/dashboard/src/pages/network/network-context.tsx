/**
 * Shared network context providing network data (settings, stats)
 * and admin state to all network sub-pages.
 */
import {
  Component,
  createContext,
  createSignal,
  onMount,
  useContext,
  JSX,
  Show,
} from 'solid-js';
import { Button, useToast } from '@castmill/ui-common';
import {
  NetworkService,
  NetworkSettings,
  NetworkStats,
} from '../../services/network.service';
import { store } from '../../store';
import { useI18n } from '../../i18n';
import { BsShieldLock } from 'solid-icons/bs';
import styles from './network.module.scss';

interface NetworkContextValue {
  settings: () => NetworkSettings | null;
  setSettings: (s: NetworkSettings) => void;
  stats: () => NetworkStats | null;
  setStats: (s: NetworkStats) => void;
  loading: () => boolean;
  error: () => string | null;
  reload: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue>();

export const useNetworkContext = (): NetworkContextValue => {
  const ctx = useContext(NetworkContext);
  if (!ctx) {
    throw new Error('useNetworkContext must be used within NetworkProvider');
  }
  return ctx;
};

export const NetworkProvider: Component<{ children: JSX.Element }> = (
  props
) => {
  const { t } = useI18n();
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [settings, setSettings] = createSignal<NetworkSettings | null>(null);
  const [stats, setStats] = createSignal<NetworkStats | null>(null);

  const isNetworkAdmin = () => store.network?.isAdmin ?? false;

  const loadNetworkData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!isNetworkAdmin()) {
        setError('not_admin');
        setLoading(false);
        return;
      }

      const [settingsData, statsData] = await Promise.all([
        NetworkService.getSettings(),
        NetworkService.getStats(),
      ]);

      setSettings(settingsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load network data:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load network data'
      );
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    await loadNetworkData();
  });

  const contextValue: NetworkContextValue = {
    settings,
    setSettings,
    stats,
    setStats,
    loading,
    error,
    reload: loadNetworkData,
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {/* Loading State */}
      <Show when={loading()}>
        <div class={styles['loading-container']}>
          <div class={styles['loading-text']}>{t('common.loading')}</div>
        </div>
      </Show>

      {/* Error State */}
      <Show when={!loading() && error() && error() !== 'not_admin'}>
        <div class={styles['error-container']}>
          <div class={styles['error-icon']}>⚠️</div>
          <div class={styles['error-message']}>{error()}</div>
          <div class={styles['error-hint']}>{t('network.errorHint')}</div>
          <Button onClick={loadNetworkData}>{t('common.retry')}</Button>
        </div>
      </Show>

      {/* Not Admin State */}
      <Show when={!loading() && error() === 'not_admin'}>
        <div class={styles['not-admin-container']}>
          <div class={styles['not-admin-icon']}>
            <BsShieldLock />
          </div>
          <div class={styles['not-admin-title']}>
            {t('network.accessDenied')}
          </div>
          <div class={styles['not-admin-message']}>
            {t('network.accessDeniedMessage')}
          </div>
        </div>
      </Show>

      {/* Main Content */}
      <Show when={!loading() && !error() && settings()}>{props.children}</Show>
    </NetworkContext.Provider>
  );
};
