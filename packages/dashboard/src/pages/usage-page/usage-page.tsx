import styles from './usage-page.module.scss';

import { Component, createSignal, For, onMount, Show } from 'solid-js';
import { UsageService } from '../../services/usage';
import { store } from '../../store/store';
import { Usage } from '../../interfaces/usage';
import { IoImagesOutline } from 'solid-icons/io';
import { RiMediaPlayList2Fill } from 'solid-icons/ri';
import { HiOutlineTv } from 'solid-icons/hi';
import { BsCalendarWeek } from 'solid-icons/bs';
import { AiOutlineTeam, AiOutlineDatabase } from 'solid-icons/ai';

const [usage, setUsage] = createSignal<Usage>();
const [loading, setLoading] = createSignal(true);

// Icon component using the same icons as the sidebar
const ResourceIcon = (props: { type: string }) => {
  const icons: Record<string, any> = {
    medias: IoImagesOutline,
    storage: AiOutlineDatabase,
    users: AiOutlineTeam, // Using team icon for users
    devices: HiOutlineTv,
    playlists: RiMediaPlayList2Fill,
    channels: BsCalendarWeek,
    teams: AiOutlineTeam,
  };

  const Icon = icons[props.type] || IoImagesOutline;

  return <Icon size={28} />;
};

// Display names for resources
const resourceNames: Record<string, string> = {
  medias: 'Media Files',
  storage: 'Storage',
  users: 'Users',
  devices: 'Devices',
  playlists: 'Playlists',
  channels: 'Channels',
  teams: 'Teams',
  widgets: 'Widgets',
};

/**
 * UsagePage component - Modern dashboard showing resource quota usage.
 */
const UsagePage: Component = () => {
  onMount(async () => {
    const organizationId = store.organizations.selectedId;
    if (organizationId) {
      try {
        setLoading(true);
        const usageData = await UsageService.getUsage(organizationId);
        setUsage(usageData);
      } catch (error) {
        console.error('Failed to fetch usage data:', error);
        alert(`Failed to fetch usage data: ${error}`);
      } finally {
        setLoading(false);
      }
    }
  });

  const getUsageState = (used: number, total: number) => {
    if (total === 0) return 'empty';
    const percentage = (used / total) * 100;
    if (percentage >= 100) return 'full';
    if (percentage >= 90) return 'warning';
    return 'normal';
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatValue = (resource: string, value: number) => {
    return resource === 'storage' ? formatBytes(value) : formatNumber(value);
  };

  return (
    <div class={styles.usagePage}>
      <div class={styles.container}>
        <header class={styles.header}>
          <h1 class={styles.title}>Resource Usage</h1>
          <p class={styles.subtitle}>
            Monitor your organization's quota usage across all resources
          </p>
        </header>

        <Show when={loading()}>
          <div class={styles.loadingState}>
            <div class={styles.spinner}></div>
            <p>Loading usage data...</p>
          </div>
        </Show>

        <Show when={!loading() && usage()}>
          <div class={styles.grid}>
            <For each={Object.entries(usage() || {})}>
              {([resource, { used, total }]) => {
                const percentage =
                  total > 0 ? Math.round((used / total) * 100) : 0;
                const state = getUsageState(used, total);

                return (
                  <div class={`${styles.card} ${styles[state]}`}>
                    <div class={styles.cardHeader}>
                      <div class={styles.iconWrapper}>
                        <ResourceIcon type={resource} />
                      </div>
                      <div class={styles.cardTitle}>
                        <h3>{resourceNames[resource] || resource}</h3>
                        <span class={styles.percentage}>{percentage}%</span>
                      </div>
                    </div>

                    <div class={styles.cardBody}>
                      <div class={styles.stats}>
                        <div class={styles.stat}>
                          <span class={styles.statLabel}>Used</span>
                          <span class={styles.statValue}>
                            {formatValue(resource, used)}
                          </span>
                        </div>
                        <div class={styles.statDivider}>/</div>
                        <div class={styles.stat}>
                          <span class={styles.statLabel}>Total</span>
                          <span class={styles.statValue}>
                            {formatValue(resource, total)}
                          </span>
                        </div>
                      </div>

                      <div class={styles.progressBar}>
                        <div
                          class={styles.progressFill}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        >
                          <div class={styles.progressGlow}></div>
                        </div>
                      </div>

                      <Show when={state === 'full'}>
                        <div class={styles.alert}>
                          <span class={styles.alertIcon}>⚠️</span>
                          <span>Quota limit reached</span>
                        </div>
                      </Show>

                      <Show when={state === 'warning'}>
                        <div class={styles.alert}>
                          <span class={styles.alertIcon}>⚡</span>
                          <span>Approaching limit</span>
                        </div>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        <Show when={!loading() && !usage()}>
          <div class={styles.emptyState}>
            <span class={styles.emptyIcon}>📊</span>
            <h3>No usage data available</h3>
            <p>Unable to load resource usage information</p>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default UsagePage;
