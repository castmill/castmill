/**
 * Network Overview page — stats dashboard for network admins.
 */
import { Component, Show } from 'solid-js';
import { useI18n } from '../../i18n';
import { useNetworkContext } from './network-context';
import { BsBuilding, BsShieldLock } from 'solid-icons/bs';
import { IoPersonOutline, IoHardwareChipOutline } from 'solid-icons/io';
import { AiOutlineTeam } from 'solid-icons/ai';
import { FiDatabase } from 'solid-icons/fi';
import styles from './network.module.scss';

// Format bytes to human readable string
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const NetworkOverview: Component = () => {
  const { t } = useI18n();
  const { settings, stats } = useNetworkContext();

  return (
    <div class={styles['network-page']}>
      {/* Header */}
      <div class={styles['page-header']}>
        <h1>{t('network.title')}</h1>
        <span class={styles['network-badge']}>
          <BsShieldLock />
          {t('network.adminBadge')}
        </span>
      </div>

      {/* Stats Grid */}
      <Show when={stats()}>
        <div class={styles['stats-grid']}>
          <div class={styles['stat-card']}>
            <div class={styles['stat-value']}>
              {stats()!.organizations_count}
            </div>
            <div class={styles['stat-label']}>
              <BsBuilding style={{ 'margin-right': '0.5em' }} />
              {t('network.stats.organizations')}
            </div>
          </div>
          <div class={styles['stat-card']}>
            <div class={styles['stat-value']}>{stats()!.users_count}</div>
            <div class={styles['stat-label']}>
              <IoPersonOutline style={{ 'margin-right': '0.5em' }} />
              {t('network.stats.users')}
            </div>
          </div>
          <div class={styles['stat-card']}>
            <div class={styles['stat-value']}>{stats()!.devices_count}</div>
            <div class={styles['stat-label']}>
              <IoHardwareChipOutline style={{ 'margin-right': '0.5em' }} />
              {t('network.stats.devices')}
            </div>
          </div>
          <div class={styles['stat-card']}>
            <div class={styles['stat-value']}>{stats()!.teams_count}</div>
            <div class={styles['stat-label']}>
              <AiOutlineTeam style={{ 'margin-right': '0.5em' }} />
              {t('network.stats.teams')}
            </div>
          </div>
          <div class={styles['stat-card']}>
            <div class={styles['stat-value']}>
              {formatBytes(stats()!.total_storage_bytes)}
            </div>
            <div class={styles['stat-label']}>
              <FiDatabase style={{ 'margin-right': '0.5em' }} />
              {t('network.stats.storage')}
            </div>
          </div>
        </div>
      </Show>

      {/* Network Info */}
      <Show when={settings()}>
        <div class={styles['section']}>
          <h2>{t('network.overview.networkInfo')}</h2>
          <div class={styles['form-grid']}>
            <div class={styles['form-row']}>
              <label>{t('network.identity.name')}</label>
              <span>{settings()!.name}</span>
            </div>
            <div class={styles['form-row']}>
              <label>{t('network.domain.label')}</label>
              <div class={styles['domain-display']}>
                <span class={styles['domain-value']}>{settings()!.domain}</span>
              </div>
            </div>
            <div class={styles['form-row']}>
              <label>{t('network.identity.email')}</label>
              <span>{settings()!.email}</span>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default NetworkOverview;
