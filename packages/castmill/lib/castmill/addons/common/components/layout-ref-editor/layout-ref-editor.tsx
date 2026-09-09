import { Component, createSignal, createEffect, For, Show } from 'solid-js';
import type { LayoutRefValue, LayoutZone } from '@castmill/player';
import { ComboBox, Button } from '@castmill/ui-common';
import { BsLayoutWtf, BsPlayCircle, BsBoxArrowUpRight } from 'solid-icons/bs';
import { ResourcesService } from '../../../playlists/services/resources.service';
import { PlaylistsService } from '../../../playlists/services/playlists.service';
import './layout-ref-editor.scss';

// Layout interface matching backend response
interface JsonLayout {
  id: number;
  name: string;
  description?: string;
  aspect_ratio: string;
  zones: {
    zones: Array<{
      id: string;
      name: string;
      rect: { x: number; y: number; width: number; height: number };
      zIndex: number;
    }>;
  };
}

interface JsonPlaylist {
  id: number;
  name: string;
  description?: string;
  items?: any[];
}

interface LayoutRefEditorProps {
  value: LayoutRefValue | null;
  onChange: (value: LayoutRefValue | null) => void;
  organizationId: string;
  baseUrl: string;
  /** Function to translate i18n keys */
  t?: (key: string, params?: Record<string, unknown>) => string;
  /** Playlist IDs to exclude (for circular reference prevention) */
  excludedPlaylistIds?: number[];
}

/**
 * A component for selecting an existing layout and assigning playlists to its zones.
 * Used in widget configuration when using the 'layout-ref' schema type.
 */
export const LayoutRefEditor: Component<LayoutRefEditorProps> = (props) => {
  const [selectedLayout, setSelectedLayout] = createSignal<JsonLayout | null>(
    null
  );
  const [zonePlaylistMap, setZonePlaylistMap] = createSignal<
    Record<string, { playlistId: number; playlist?: JsonPlaylist }>
  >({});
  const [isLoading, setIsLoading] = createSignal(false);
  // Track if we've initialized to avoid re-fetching when user clears
  const [hasInitialized, setHasInitialized] = createSignal(false);
  // Track which zone is being hovered in the assignments list
  const [hoveredZoneId, setHoveredZoneId] = createSignal<string | null>(null);

  const t = (key: string, params?: Record<string, unknown>) =>
    props.t?.(key, params) || key;

  // Initialize from props value only once on mount
  createEffect(async () => {
    const value = props.value;
    // Only initialize if we haven't already and there's a value to restore
    if (value?.layoutId && !hasInitialized()) {
      setHasInitialized(true);
      setIsLoading(true);
      try {
        // Fetch the layout details
        const response = await ResourcesService.fetch<JsonLayout>(
          props.baseUrl,
          props.organizationId,
          'layouts',
          { page: 1, page_size: 1, filters: { id: String(value.layoutId) } }
        );
        if (response.data.length > 0) {
          setSelectedLayout(response.data[0]);
        }
        // Restore zone-playlist assignments
        if (value.zonePlaylistMap) {
          setZonePlaylistMap(value.zonePlaylistMap);
        }
      } catch (error) {
        console.error('Failed to fetch layout:', error);
      } finally {
        setIsLoading(false);
      }
    } else if (!value && !hasInitialized()) {
      // No initial value, mark as initialized
      setHasInitialized(true);
    }
  });

  // Get zones from the selected layout
  const layoutZones = () => {
    const layout = selectedLayout();
    if (!layout?.zones?.zones) return [];
    return layout.zones.zones;
  };

  // Build the full LayoutRefValue with layout data
  const buildLayoutRefValue = (
    layout: JsonLayout,
    playlistMap: Record<string, { playlistId: number; playlist?: JsonPlaylist }>
  ) => ({
    layoutId: layout.id,
    aspectRatio: layout.aspect_ratio,
    zones: layout.zones,
    zonePlaylistMap: playlistMap,
  });

  // Handle layout selection
  const handleLayoutSelect = async (layout: JsonLayout) => {
    setSelectedLayout(layout);
    // Reset zone assignments when layout changes
    setZonePlaylistMap({});

    // Emit the change with full layout data
    props.onChange(buildLayoutRefValue(layout, {}));
  };

  // Handle playlist assignment to a zone
  const handleZonePlaylistSelect = async (
    zoneId: string,
    playlist: JsonPlaylist
  ) => {
    const layout = selectedLayout();
    if (!layout) return;

    try {
      // Fetch full playlist with items for proper rendering
      const fullPlaylist = await PlaylistsService.getPlaylist(
        props.baseUrl,
        props.organizationId,
        playlist.id
      );

      const newMap = {
        ...zonePlaylistMap(),
        [zoneId]: { playlistId: playlist.id, playlist: fullPlaylist },
      };
      setZonePlaylistMap(newMap);

      // Emit the change with full layout data
      props.onChange(buildLayoutRefValue(layout, newMap));
    } catch (error) {
      console.warn('Failed to fetch full playlist:', error);
      // Fallback to basic playlist
      const newMap = {
        ...zonePlaylistMap(),
        [zoneId]: { playlistId: playlist.id, playlist },
      };
      setZonePlaylistMap(newMap);

      props.onChange(buildLayoutRefValue(layout, newMap));
    }
  };

  // Remove playlist from zone
  const handleRemovePlaylist = (zoneId: string) => {
    const layout = selectedLayout();
    if (!layout) return;

    const newMap = { ...zonePlaylistMap() };
    delete newMap[zoneId];
    setZonePlaylistMap(newMap);

    props.onChange(buildLayoutRefValue(layout, newMap));
  };

  // Clear selected layout
  const handleClearLayout = () => {
    setSelectedLayout(null);
    setZonePlaylistMap({});
    props.onChange(null);
  };

  // Calculate zone position for preview
  const getZoneStyle = (zone: JsonLayout['zones']['zones'][0]) => ({
    left: `${zone.rect.x}%`,
    top: `${zone.rect.y}%`,
    width: `${zone.rect.width}%`,
    height: `${zone.rect.height}%`,
    'z-index': zone.zIndex,
  });

  // Build navigation URL for a layout
  const getLayoutUrl = (layoutId: number) =>
    `/org/${props.organizationId}/content/layouts?itemId=${layoutId}`;

  // Build navigation URL for a playlist
  const getPlaylistUrl = (playlistId: number) =>
    `/org/${props.organizationId}/content/playlists?itemId=${playlistId}`;

  return (
    <div class="layout-ref-editor">
      {/* Layout Selection */}
      <div class="layout-ref-editor__layout-selector">
        <Show
          when={selectedLayout()}
          fallback={
            <ComboBox<JsonLayout>
              id="layout-selector"
              label={t('layouts.selectLayout') || 'Select Layout'}
              placeholder={t('layouts.searchLayouts') || 'Search layouts...'}
              value={undefined}
              renderItem={(item) => (
                <div class="layout-item">
                  <BsLayoutWtf />
                  <div class="layout-item__info">
                    <span class="layout-item__name">{item.name}</span>
                    <span class="layout-item__meta">
                      {item.aspect_ratio} · {item.zones?.zones?.length || 0}{' '}
                      zones
                    </span>
                  </div>
                </div>
              )}
              fetchItems={async (page, pageSize, search) => {
                return ResourcesService.fetch<JsonLayout>(
                  props.baseUrl,
                  props.organizationId,
                  'layouts',
                  { page, page_size: pageSize, search }
                );
              }}
              onSelect={handleLayoutSelect}
            />
          }
        >
          {(layout) => (
            <div class="layout-ref-editor__selected-layout">
              <div class="layout-ref-editor__layout-header">
                <div class="layout-ref-editor__layout-info">
                  <BsLayoutWtf />
                  <a
                    href={getLayoutUrl(layout().id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="layout-name layout-name--link"
                    title={t('common.openInNewTab') || 'Open in new tab'}
                  >
                    {layout().name}
                    <BsBoxArrowUpRight class="link-icon" />
                  </a>
                  <span class="layout-meta">
                    {layout().aspect_ratio} · {layoutZones().length} zones
                  </span>
                </div>
                <Button
                  onClick={handleClearLayout}
                  color="primary"
                  label={t('common.change') || 'Change'}
                />
              </div>

              {/* Layout Preview */}
              <div class="layout-ref-editor__preview">
                <div
                  class="layout-ref-editor__preview-canvas"
                  style={{
                    'aspect-ratio': layout().aspect_ratio.replace(':', '/'),
                  }}
                >
                  <For each={layoutZones()}>
                    {(zone) => {
                      const zoneAssignment = () => zonePlaylistMap()[zone.id];
                      const isHighlighted = () => hoveredZoneId() === zone.id;
                      return (
                        <div
                          class={`layout-ref-editor__zone ${
                            zoneAssignment() ? 'has-playlist' : ''
                          } ${isHighlighted() ? 'is-highlighted' : ''}`}
                          style={getZoneStyle(zone)}
                        >
                          <span class="zone-name">{zone.name}</span>
                          <Show when={zoneAssignment()}>
                            {(assignment) => (
                              <span class="zone-playlist">
                                <BsPlayCircle />
                                {assignment().playlist?.name}
                              </span>
                            )}
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>

              {/* Zone Playlist Assignments */}
              <div class="layout-ref-editor__zones">
                <h4>
                  {t('layouts.assignPlaylists') || 'Assign Playlists to Zones'}
                </h4>
                <For each={layoutZones()}>
                  {(zone) => {
                    const zoneAssignment = () => zonePlaylistMap()[zone.id];
                    return (
                      <div
                        class="layout-ref-editor__zone-assignment"
                        onMouseEnter={() => setHoveredZoneId(zone.id)}
                        onMouseLeave={() => setHoveredZoneId(null)}
                      >
                        <div class="zone-label">
                          <span class="zone-name">{zone.name}</span>
                        </div>
                        <div class="zone-playlist-selector">
                          <Show
                            when={zoneAssignment()}
                            fallback={
                              <ComboBox<JsonPlaylist>
                                id={`zone-${zone.id}-playlist`}
                                label=""
                                placeholder={
                                  t('common.selectPlaylist') ||
                                  'Select playlist...'
                                }
                                value={undefined}
                                renderItem={(item) => (
                                  <div class="playlist-item">
                                    <BsPlayCircle />
                                    <span>{item.name}</span>
                                  </div>
                                )}
                                fetchItems={async (page, pageSize, search) => {
                                  const excluded =
                                    props.excludedPlaylistIds || [];
                                  const filterParams: Record<string, string> =
                                    {};
                                  if (excluded.length > 0) {
                                    filterParams.exclude_ids =
                                      excluded.join(',');
                                  }
                                  return ResourcesService.fetch<JsonPlaylist>(
                                    props.baseUrl,
                                    props.organizationId,
                                    'playlists',
                                    {
                                      page,
                                      page_size: pageSize,
                                      search,
                                      filters:
                                        Object.keys(filterParams).length > 0
                                          ? filterParams
                                          : undefined,
                                    }
                                  );
                                }}
                                onSelect={(playlist) =>
                                  handleZonePlaylistSelect(zone.id, playlist)
                                }
                              />
                            }
                          >
                            {(assignment) => (
                              <div class="zone-playlist-selected">
                                <BsPlayCircle />
                                <a
                                  href={getPlaylistUrl(assignment().playlistId)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  class="playlist-name-link"
                                  title={
                                    t('common.openInNewTab') ||
                                    'Open in new tab'
                                  }
                                >
                                  {assignment().playlist?.name}
                                  <BsBoxArrowUpRight class="link-icon" />
                                </a>
                                <Button
                                  onClick={() => handleRemovePlaylist(zone.id)}
                                  color="secondary"
                                  label={t('common.remove') || 'Remove'}
                                />
                              </div>
                            )}
                          </Show>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
};
