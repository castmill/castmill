import { Component, For, Show } from 'solid-js';
import {
  BsFileImage,
  BsFileEarmarkFont,
  BsFileCode,
  BsFileEarmark,
  BsImage,
} from 'solid-icons/bs';

interface AssetDefinition {
  path: string;
  type?: string;
  name?: string;
  description?: string;
}

interface WidgetAssets {
  icons?: Record<string, AssetDefinition>;
  images?: Record<string, AssetDefinition>;
  fonts?: Record<string, AssetDefinition>;
  styles?: Record<string, AssetDefinition>;
}

interface AssetsListProps {
  assets?: WidgetAssets;
  widgetSlug: string;
  baseUrl: string;
  t: (key: string, params?: Record<string, any>) => string;
}

// Helper to get icon based on asset category
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'icons':
      return <BsImage size={16} />;
    case 'images':
      return <BsFileImage size={16} />;
    case 'fonts':
      return <BsFileEarmarkFont size={16} />;
    case 'styles':
      return <BsFileCode size={16} />;
    default:
      return <BsFileEarmark size={16} />;
  }
};

// Helper to format file size
const formatType = (type?: string): string => {
  if (!type) return 'Unknown';
  return type;
};

// Asset category component
const AssetCategory: Component<{
  title: string;
  category: string;
  assets: Record<string, AssetDefinition>;
  widgetSlug: string;
  baseUrl: string;
}> = (props) => {
  const entries = Object.entries(props.assets);

  if (entries.length === 0) return null;

  return (
    <div class="asset-category">
      <h4 class="asset-category-title">
        {getCategoryIcon(props.category)}
        <span>{props.title}</span>
        <span class="asset-count">({entries.length})</span>
      </h4>
      <div class="asset-grid">
        <For each={entries}>
          {([key, asset]) => (
            <div class="asset-item">
              <div class="asset-info">
                <div class="asset-name" title={key}>
                  {asset.name || key}
                </div>
                <div class="asset-path" title={asset.path}>
                  {asset.path}
                </div>
                <Show when={asset.description}>
                  <div class="asset-description">{asset.description}</div>
                </Show>
                <div class="asset-type">{formatType(asset.type)}</div>
              </div>
              <Show
                when={props.category === 'icons' || props.category === 'images'}
              >
                <div class="asset-preview">
                  <img
                    src={`${props.baseUrl}/widget_assets/${props.widgetSlug}/${asset.path}`}
                    alt={asset.name || key}
                    loading="lazy"
                  />
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export const AssetsList: Component<AssetsListProps> = (props) => {
  const hasAnyAssets = () => {
    if (!props.assets) return false;
    return (
      Object.keys(props.assets.icons || {}).length > 0 ||
      Object.keys(props.assets.images || {}).length > 0 ||
      Object.keys(props.assets.fonts || {}).length > 0 ||
      Object.keys(props.assets.styles || {}).length > 0
    );
  };

  return (
    <div class="assets-list">
      <Show
        when={hasAnyAssets()}
        fallback={
          <div class="no-assets">
            <p>{props.t('widgets.noAssets')}</p>
          </div>
        }
      >
        <Show
          when={
            props.assets?.icons && Object.keys(props.assets.icons).length > 0
          }
        >
          <AssetCategory
            title={props.t('widgets.assets.icons')}
            category="icons"
            assets={props.assets!.icons!}
            widgetSlug={props.widgetSlug}
            baseUrl={props.baseUrl}
          />
        </Show>

        <Show
          when={
            props.assets?.images && Object.keys(props.assets.images).length > 0
          }
        >
          <AssetCategory
            title={props.t('widgets.assets.images')}
            category="images"
            assets={props.assets!.images!}
            widgetSlug={props.widgetSlug}
            baseUrl={props.baseUrl}
          />
        </Show>

        <Show
          when={
            props.assets?.fonts && Object.keys(props.assets.fonts).length > 0
          }
        >
          <AssetCategory
            title={props.t('widgets.assets.fonts')}
            category="fonts"
            assets={props.assets!.fonts!}
            widgetSlug={props.widgetSlug}
            baseUrl={props.baseUrl}
          />
        </Show>

        <Show
          when={
            props.assets?.styles && Object.keys(props.assets.styles).length > 0
          }
        >
          <AssetCategory
            title={props.t('widgets.assets.styles')}
            category="styles"
            assets={props.assets!.styles!}
            widgetSlug={props.widgetSlug}
            baseUrl={props.baseUrl}
          />
        </Show>
      </Show>
    </div>
  );
};
