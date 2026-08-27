import { Component, createSignal, For, onMount, Show } from 'solid-js';
import { AddonStore } from '../../common/interfaces/addon-store';
import {
  QuotasService,
  QuotaUsage,
} from '../../common/services/quotas.service';
import { formatBytes } from '@castmill/ui-common';
import { IoImagesOutline } from 'solid-icons/io';
import { RiMediaPlayList2Fill } from 'solid-icons/ri';
import { AiOutlineDatabase } from 'solid-icons/ai';
import { BsGrid3x3Gap } from 'solid-icons/bs';
import './content.css';

// Icon component using the same icons as other pages
const ResourceIcon = (props: { type: string }) => {
  const icons: Record<string, any> = {
    medias: IoImagesOutline,
    storage: AiOutlineDatabase,
    playlists: RiMediaPlayList2Fill,
    widgets: BsGrid3x3Gap,
  };

  const Icon = icons[props.type] || IoImagesOutline;

  return <Icon size={28} />;
};

const ContentPage: Component<{
  store: AddonStore;
  params: any;
}> = (props) => {
  const [quotaUsage, setQuotaUsage] = createSignal<QuotaUsage>();
  const [loading, setLoading] = createSignal(true);

  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;

  onMount(async () => {
    const organizationId = props.store.organizations.selectedId;
    if (organizationId) {
      try {
        setLoading(true);
        const quotasService = new QuotasService(props.store.env.baseUrl);
        const usage = await quotasService.getQuotaUsage(organizationId);
        setQuotaUsage(usage);
      } catch (error) {
        console.error('Failed to fetch quota usage:', error);
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

  const formatValue = (resource: string, value: number) => {
    return resource === 'storage' ? formatBytes(value) : formatNumber(value);
  };

  // Filter to show only the four resources mentioned in the issue
  const filteredResources = () => {
    const usage = quotaUsage();
    if (!usage) return [];

    const resourceOrder = ['playlists', 'medias', 'storage', 'widgets'];
    return resourceOrder
      .map((key) => ({ key, value: usage[key] }))
      .filter(({ value }) => value !== undefined);
  };

  // Display names for resources
  const resourceNames: Record<string, string> = {
    medias: t('content.medias'),
    storage: t('content.storage'),
    playlists: t('content.playlists'),
    widgets: t('content.widgets'),
  };

  return (
    <div class="content-page">
      <div class="content-container">
        <header class="content-header">
          <h1 class="content-title">{t('content.title')}</h1>
          <p class="content-subtitle">{t('content.description')}</p>
        </header>

        <Show when={loading()}>
          <div class="content-loading-state">
            <div class="content-spinner"></div>
            <p>{t('content.loadingUsageData')}</p>
          </div>
        </Show>

        <Show when={!loading() && filteredResources().length > 0}>
          <div class="content-grid">
            <For each={filteredResources()}>
              {({ key, value }) => {
                const { used, total } = value!;
                const percentage =
                  total > 0 ? Math.round((used / total) * 100) : 0;
                const state = getUsageState(used, total);

                return (
                  <div class={`content-card content-card--${state}`}>
                    <div class="content-card-header">
                      <div class="content-icon-wrapper">
                        <ResourceIcon type={key} />
                      </div>
                      <div class="content-card-title">
                        <h3>{resourceNames[key] || key}</h3>
                        <span class="content-percentage">{percentage}%</span>
                      </div>
                    </div>

                    <div class="content-card-body">
                      <div class="content-stats">
                        <div class="content-stat">
                          <span class="content-stat-label">
                            {t('content.used')}
                          </span>
                          <span class="content-stat-value">
                            {formatValue(key, used)}
                          </span>
                        </div>
                        <div class="content-stat-divider">/</div>
                        <div class="content-stat">
                          <span class="content-stat-label">
                            {t('content.total')}
                          </span>
                          <span class="content-stat-value">
                            {formatValue(key, total)}
                          </span>
                        </div>
                      </div>

                      <div class="content-progress-bar">
                        <div
                          class="content-progress-fill"
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        >
                          <div class="content-progress-glow"></div>
                        </div>
                      </div>

                      <Show when={state === 'full'}>
                        <div class="content-alert content-alert--error">
                          <span class="content-alert-icon">⚠️</span>
                          <span>{t('content.quotaLimitReached')}</span>
                        </div>
                      </Show>

                      <Show when={state === 'warning'}>
                        <div class="content-alert content-alert--warning">
                          <span class="content-alert-icon">⚡</span>
                          <span>{t('content.approachingLimit')}</span>
                        </div>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        <Show when={!loading() && filteredResources().length === 0}>
          <div class="content-empty-state">
            <span class="content-empty-icon">📊</span>
            <h3>{t('content.noUsageData')}</h3>
            <p>{t('content.unableToLoad')}</p>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default ContentPage;
