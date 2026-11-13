import styles from './usage-page.module.scss';

import {
  Component,
  createEffect,
  createSignal,
  For,
  onMount,
  Show,
} from 'solid-js';
import { UsageService } from '../../services/usage';
import { store } from '../../store/store';
import { Usage } from '../../interfaces/usage';
import { useI18n } from '../../i18n';
import { useToast, formatBytes } from '@castmill/ui-common';
import { IoImagesOutline } from 'solid-icons/io';
import { RiMediaPlayList2Fill } from 'solid-icons/ri';
import { HiOutlineTv } from 'solid-icons/hi';
import { BsCalendarWeek, BsGrid } from 'solid-icons/bs';
import { TbBolt, TbListCheck, TbRobot, TbRss } from 'solid-icons/tb';
import {
  AiOutlineTeam,
  AiOutlineDatabase,
  AiOutlineAppstore,
  AiOutlineFolder,
  AiOutlineTags,
} from 'solid-icons/ai';

const [usage, setUsage] = createSignal<Usage>();
const [loading, setLoading] = createSignal(true);

// Map resource identifiers to translation keys for localized labels. Cards
// are shown in this order; resources not listed here come last.
const resourceTranslationKeys = {
  medias: 'usage.resources.medias',
  storage: 'usage.resources.storage',
  users: 'usage.resources.users',
  devices: 'usage.resources.devices',
  playlists: 'usage.resources.playlists',
  channels: 'usage.resources.channels',
  teams: 'usage.resources.teams',
  widgets: 'usage.resources.widgets',
  layouts: 'usage.resources.layouts',
  feeds: 'usage.resources.feeds',
  automations: 'usage.resources.automations',
  automation_rules: 'usage.resources.automation_rules',
  tags: 'usage.resources.tags',
  tag_groups: 'usage.resources.tag_groups',
  agents: 'usage.resources.agents',
} as const;

const resourceOrder = Object.keys(resourceTranslationKeys);
const orderOf = (resource: string) => {
  const index = resourceOrder.indexOf(resource);
  return index === -1 ? resourceOrder.length : index;
};

type ResourceType = keyof typeof resourceTranslationKeys;

// Icon component using the same icons as the sidebar
const ResourceIcon = (props: { type: ResourceType }) => {
  const icons: Record<ResourceType, any> = {
    medias: IoImagesOutline,
    storage: AiOutlineDatabase,
    users: AiOutlineTeam,
    devices: HiOutlineTv,
    playlists: RiMediaPlayList2Fill,
    channels: BsCalendarWeek,
    teams: AiOutlineTeam,
    widgets: AiOutlineAppstore,
    layouts: BsGrid,
    feeds: TbRss,
    automations: TbBolt,
    automation_rules: TbListCheck,
    tags: AiOutlineTags,
    tag_groups: AiOutlineFolder,
    agents: TbRobot,
  };

  const Icon = icons[props.type] || IoImagesOutline;

  return <Icon size="1.75em" />;
};

/**
 * UsagePage component - Modern dashboard showing resource quota usage.
 */
const UsagePage: Component = () => {
  const { t } = useI18n();
  const toast = useToast();

  const loadUsageData = async () => {
    const organizationId = store.organizations.selectedId;
    if (organizationId) {
      try {
        setLoading(true);
        const usageData = await UsageService.getUsage(organizationId);
        setUsage(usageData);
      } catch (error) {
        toast.error(t('usage.errors.fetchUsageData', { error: String(error) }));
      } finally {
        setLoading(false);
      }
    }
  };

  onMount(() => {
    loadUsageData();
  });

  // Reload data when organization changes
  createEffect(() => {
    const orgId = store.organizations.selectedId;
    if (orgId) {
      loadUsageData();
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

  const formatValue = (resource: string, value: number) => {
    return resource === 'storage' ? formatBytes(value) : formatNumber(value);
  };

  return (
    <div class={styles.usagePage}>
      <div class={styles.container}>
        <header class={styles.header}>
          <h1 class={styles.title}>{t('usage.title')}</h1>
          <p class={styles.subtitle}>{t('usage.description')}</p>
        </header>

        <Show when={loading()}>
          <div class={styles.loadingState}>
            <div class={styles.spinner}></div>
            <p>{t('usage.loadingUsageData')}</p>
          </div>
        </Show>

        <Show when={!loading() && usage()}>
          <div class={styles.grid}>
            <For
              each={(
                Object.entries(usage() || {}) as [
                  ResourceType,
                  { used: number; total: number },
                ][]
              ).sort(([a], [b]) => orderOf(a) - orderOf(b))}
            >
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
                        <h3>
                          {resourceTranslationKeys[resource]
                            ? t(resourceTranslationKeys[resource])
                            : resource}
                        </h3>
                        <span class={styles.percentage}>{percentage}%</span>
                      </div>
                    </div>

                    <div class={styles.cardBody}>
                      <div class={styles.stats}>
                        <div class={styles.stat}>
                          <span class={styles.statLabel}>
                            {t('usage.used')}
                          </span>
                          <span class={styles.statValue}>
                            {formatValue(resource, used)}
                          </span>
                        </div>
                        <div class={styles.statDivider}>/</div>
                        <div class={styles.stat}>
                          <span class={styles.statLabel}>
                            {t('usage.total')}
                          </span>
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
                          <span>{t('usage.quotaLimitReached')}</span>
                        </div>
                      </Show>

                      <Show when={state === 'warning'}>
                        <div class={styles.alert}>
                          <span class={styles.alertIcon}>⚡</span>
                          <span>{t('usage.approachingLimit')}</span>
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
            <h3>{t('usage.noUsageData')}</h3>
            <p>{t('usage.unableToLoad')}</p>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default UsagePage;
