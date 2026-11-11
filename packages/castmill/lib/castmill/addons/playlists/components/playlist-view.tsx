import {
  JsonPlaylist,
  JsonPlaylistItem,
  JsonWidget,
  JsonWidgetConfig,
  OptionsDict,
} from '@castmill/player';
import {
  Component,
  For,
  createEffect,
  createMemo,
  createSignal,
  Show,
  on,
  onCleanup,
  untrack,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { IconTypes } from 'solid-icons';
import { BsCollectionPlay, BsEye, BsGear, BsPlusLg } from 'solid-icons/bs';
import {
  useToast,
  Modal,
  Button,
  Dropdown,
  FormItem,
  formatDuration,
  formatRelativeTimeLocalized,
} from '@castmill/ui-common';

import './playlist-view.scss';
import { PlaylistsService } from '../services/playlists.service';
import { WidgetChooser } from './widget-chooser';
import { PlaylistItems, CredentialsError } from './playlist-items';
import {
  PlaylistPreview,
  PlaylistPreviewRef,
  LayerOffset,
} from './playlist-preview';
import { AddonStore } from '../../common/interfaces/addon-store';
import { getDefaultDataFromSchema } from '../utils/schema-utils';
import { containsDynamicDurationComponent } from '../utils/duration-utils';
import { resolveVideoWidgetDuration } from '../utils/video-duration';
import { ASPECT_RATIO_OPTIONS } from '../constants';
import {
  validateCustomRatioField,
  validateAspectRatioExtreme as validateAspectRatioExtremeUtil,
  isValidAspectRatio,
} from '../utils/aspect-ratio-validation';
import { getTranslatedWidgetName } from '../../common/utils/widget-catalog-utils';
import { createMediaQuery } from '../utils/media-query';
import { PlaylistNameField } from './playlist-details';

type SectionId = 'content' | 'preview' | 'settings';

interface PlaylistSection {
  id: SectionId;
  title: () => string;
  icon: IconTypes;
}

// Below this viewport width the widgets, items and preview no longer fit
// side by side in the drawer, so they move into tabs.
export const WIDE_LAYOUT_QUERY = '(min-width: 64em)';
// The three columns need ~56em plus gaps; below this measured editor width
// (e.g. tablets, zoomed pages) fall back to tabs even if the viewport is wide.
export const WIDE_LAYOUT_MIN_EM = 57;
const RELATIVE_TIME_REFRESH_MS = 30_000;

export const PlaylistView: Component<{
  store: AddonStore;
  playlistId: number;
  organizationId: string;
  baseUrl: string;
  onChange?: (playlist: JsonPlaylist) => void;
  onNavigateAway?: () => void;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const toast = useToast();
  const t = props.t || ((key: string) => key);
  const locale = () => props.store?.i18n?.locale() || 'en';
  const [widgets, setWidgets] = createSignal<JsonWidget[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [items, setItems] = createSignal<JsonPlaylistItem[]>([]);
  const [playlist, setPlaylist] = createSignal<JsonPlaylist>();
  const [credentialsError, setCredentialsError] =
    createSignal<CredentialsError | null>(null);
  const [dynamicDurations, setDynamicDurations] = createSignal<
    Record<number, number>
  >({});
  const [aspectRatioPreset, setAspectRatioPreset] =
    createSignal<string>('16:9');
  const [customWidth, setCustomWidth] = createSignal<string>('16');
  const [customHeight, setCustomHeight] = createSignal<string>('9');
  const [aspectRatioErrors, setAspectRatioErrors] = createSignal(
    new Map<string, string>()
  );
  const [isAspectRatioModified, setIsAspectRatioModified] = createSignal(false);
  let playlistSaveQueue: Promise<void> = Promise.resolve();

  const serializePlaylistSave = <T,>(save: () => Promise<T>) => {
    const result = playlistSaveQueue.then(save, save);
    playlistSaveQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };

  // Track whether to constrain by width or height based on container size
  const [constrainByWidth, setConstrainByWidth] = createSignal(false);
  const [refReady, setRefReady] = createSignal(false);
  let previewWrapperRef: HTMLDivElement | undefined;

  // Store reference to playlist preview for seeking
  let previewRef: PlaylistPreviewRef | null = null;
  let seekDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  const updatePlaylistItems = (nextItems: JsonPlaylistItem[]) => {
    setItems(nextItems);
    setPlaylist((prev) => (prev ? { ...prev, items: nextItems } : prev));
  };

  // Handle credentials error from widget insertion
  const handleCredentialsError = (error: CredentialsError) => {
    setCredentialsError(error);
  };

  // Navigate to widget integrations page
  const goToWidgetIntegrations = () => {
    const error = credentialsError();
    if (error?.widget?.id) {
      // Close the credentials error modal first
      setCredentialsError(null);

      // Close the parent playlist modal before navigating
      props.onNavigateAway?.();

      // Navigate to the widgets addon with widget ID in path (RESTful)
      // URL pattern: /org/:orgId/content/widgets/:widgetId?tab=integrations
      const url = `/org/${props.organizationId}/content/widgets/${error.widget.id}?tab=integrations`;

      // Use soft navigation if available, otherwise fall back to hard redirect
      if (props.store?.router?.navigate) {
        props.store.router.navigate(url);
      } else {
        window.location.href = url;
      }
    }
  };

  // Setup resize observer to dynamically adjust aspect ratio constraints
  // based on container size (needed for portrait aspect ratios in narrow containers)
  createEffect(() => {
    const pl = playlist();
    const isRefReady = refReady();

    if (!pl || !isRefReady || !previewWrapperRef) return;
    if (typeof ResizeObserver === 'undefined') return;

    const targetAspectRatio = getCurrentAspectRatio();
    const targetRatio = targetAspectRatio.width / targetAspectRatio.height;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const containerRatio = width / height;

        // If container aspect ratio is narrower than target aspect ratio,
        // constrain by width instead of height to maintain aspect ratio
        setConstrainByWidth(containerRatio < targetRatio);
      }
    });

    resizeObserver.observe(previewWrapperRef);

    onCleanup(() => {
      resizeObserver.disconnect();
    });
  });

  // Parents may pass a fresh playlist object (e.g. after a rename); only
  // reload when the id actually changes.
  const playlistId = createMemo(() => props.playlistId);
  createEffect(
    on(playlistId, (id) => {
      (async () => {
        const playlist: JsonPlaylist = await PlaylistsService.getPlaylist(
          props.baseUrl,
          props.organizationId,
          id
        );
        setPlaylist(playlist);
        setItems(playlist.items);

        const result = await PlaylistsService.getWidgets(
          props.baseUrl,
          props.organizationId
        );
        setWidgets(result.data);

        setLoading(false);
      })();
    })
  );

  const handleWidgetSearch = async (searchText: string) => {
    const result = await PlaylistsService.getWidgets(
      props.baseUrl,
      props.organizationId,
      searchText
    );
    setWidgets(result.data);
  };

  const handleLayerOffsets = (offsets: LayerOffset[]) => {
    if (!offsets || offsets.length === 0) {
      setDynamicDurations({});
      return;
    }

    const durationMap: Record<number, number> = {};
    const currentItems = items();

    currentItems.forEach((item, index) => {
      if (!item?.id) {
        return;
      }

      if (typeof item.duration === 'number' && item.duration > 0) {
        return;
      }

      const runtime = offsets[index]?.duration;
      if (typeof runtime === 'number' && runtime > 0) {
        durationMap[item.id] = runtime;
      }
    });

    setDynamicDurations(durationMap);
  };

  const onEditItem = async (
    item: JsonPlaylistItem,
    {
      config,
      expandedOptions,
    }: {
      config: Partial<JsonWidgetConfig>;
      expandedOptions: OptionsDict;
    }
  ) => {
    try {
      // Recalculate duration based on updated options
      const newDuration = await resolveWidgetDuration(
        item.widget,
        expandedOptions
      );

      await PlaylistsService.updateWidgetConfig(
        props.baseUrl,
        props.organizationId,
        props.playlistId,
        item.id,
        {
          options: config.options!,
          data: config.data!,
        }
      );

      // If duration changed, update it on the server
      if (newDuration !== item.duration) {
        await PlaylistsService.updateItemInPlaylist(
          props.baseUrl,
          props.organizationId,
          props.playlistId,
          item.id,
          { duration: newDuration }
        );
      }

      // Fetch integration data for the updated widget config
      // This triggers on-demand fetch with the new options and returns fresh data
      const widgetConfigId = item.config.id;
      const integrationData = widgetConfigId
        ? await PlaylistsService.fetchWidgetConfigData(
            props.baseUrl,
            widgetConfigId
          )
        : null;

      const newItems = items().map((i) =>
        i.id === item.id
          ? {
              ...i,
              duration: newDuration,
              config: {
                ...config,
                options: expandedOptions,
                data: integrationData || config.data || {},
              },
            }
          : i
      );

      updatePlaylistItems(newItems as JsonPlaylistItem[]);
    } catch (err) {
      toast.error(`Error updating widget in playlist: ${err}`);
    }
  };

  const resolveWidgetDuration = async (
    widget: JsonWidget,
    config: OptionsDict
  ): Promise<number> => {
    // Check for explicit duration settings in config options
    // Common duration option names: duration, display_duration
    const durationFromConfig =
      config.duration ?? config.display_duration ?? null;

    if (durationFromConfig !== null && typeof durationFromConfig === 'number') {
      return durationFromConfig * 1000; // Convert seconds to ms
    }

    if (widget.template.type === 'image') {
      return 10000;
    }

    // Store the video length so players can schedule the item before the
    // video's metadata has loaded.
    const videoDuration = await resolveVideoWidgetDuration(
      widget.template,
      config
    );
    if (videoDuration) {
      return videoDuration;
    }

    // For widgets containing video or scroller components, use duration 0
    // to indicate the player should use the actual dynamic duration.
    // The Layer class will fall back to widget.duration() when _duration is 0.
    if (containsDynamicDurationComponent(widget.template)) {
      return 0;
    }

    return 10000;
  };

  const onInsertItem = async (
    widget: JsonWidget,
    index: number,
    {
      config,
      expandedOptions,
    }: {
      config: Partial<JsonWidgetConfig>;
      expandedOptions: OptionsDict;
    }
  ) => {
    const prevItem = items()[index - 1];
    // Use expandedOptions which includes default values from the schema
    const duration = await resolveWidgetDuration(widget, expandedOptions);

    try {
      const newItem = await PlaylistsService.insertWidgetIntoPlaylist(
        props.baseUrl,
        props.organizationId,
        props.playlistId,
        {
          widget_id: widget.id!,
          offset: 0,
          duration,
          options: config.options!,
          prev_item_id: prevItem?.id,
        }
      );

      // Fetch integration data for the new widget config
      // This triggers on-demand fetch if needed and returns cached/fresh data
      const integrationData = await PlaylistsService.fetchWidgetConfigData(
        props.baseUrl,
        newItem.widget_config_id
      );

      // Use integration data if available, otherwise fall back to default data from schema
      // This ensures widgets like scrollers have data to render before integration fetches complete
      const defaultData = getDefaultDataFromSchema(widget.data_schema);
      const widgetData = integrationData || config.data || defaultData;

      const newItems = [...items()];
      newItems.splice(index ?? 0, 0, {
        id: newItem.id,
        widget,
        duration,
        offset: 0,
        slack: 0,
        name: widget.name,
        config: {
          id: newItem.widget_config_id, // Use the widget_config_id from the server
          widget_id: widget.id!,
          options: expandedOptions,
          data: widgetData,
        },
      });

      updatePlaylistItems(newItems);
    } catch (err) {
      toast.error(`Error inserting widget into playlist: ${err}`);
    }
  };

  const onMoveItem = async (
    item: JsonPlaylistItem,
    currentIndex: number,
    newIndex: number | undefined
  ) => {
    // Check first if the item has really been moved.
    if (
      typeof newIndex === 'undefined' &&
      currentIndex === items().length - 1
    ) {
      return;
    }

    if (newIndex == currentIndex + 1) {
      return;
    }

    const newItems = [...items()];
    let targetItemId: number | null = null;

    // If new index is undefined then move to the end of the list
    for (;;) {
      if (typeof newIndex === 'undefined') {
        targetItemId = items()[items().length - 1].id ?? null;

        newItems.splice(currentIndex, 1);
        newItems.push(item);
        break;
      }

      if (newIndex === 0) {
        targetItemId = null;
      } else {
        targetItemId = newItems[newIndex - 1].id;
      }

      if (currentIndex > newIndex) {
        newItems.splice(newIndex, 0, item);
        newItems.splice(currentIndex + 1, 1);
        break;
      }

      if (currentIndex < newIndex) {
        newItems.splice(newIndex, 0, item);
        newItems.splice(currentIndex, 1);
        break;
      }
    }

    try {
      await PlaylistsService.moveItemInPlaylist(
        props.baseUrl,
        props.organizationId,
        props.playlistId,
        item.id,
        targetItemId
      );

      updatePlaylistItems(newItems);
    } catch (err) {
      toast.error(`Error moving widget in playlist: ${err}`);
    }
  };

  const onRemoveItem = async (itemToRemove: JsonPlaylistItem) => {
    try {
      await PlaylistsService.removeItemFromPlaylist(
        props.baseUrl,
        props.organizationId,
        props.playlistId,
        itemToRemove.id
      );

      const filteredItems = items().filter((item) => item !== itemToRemove);
      updatePlaylistItems(filteredItems);
    } catch (err) {
      toast.error(`Error removing widget from playlist: ${err}`);
    }
  };

  const onChangeDuration = async (item: JsonPlaylistItem, duration: number) => {
    const newItems = items().map((i) =>
      i.id === item.id ? { ...i, duration } : i
    );
    updatePlaylistItems(newItems);
    await PlaylistsService.updateItemInPlaylist(
      props.baseUrl,
      props.organizationId,
      props.playlistId,
      item.id,
      {
        duration,
      }
    );
  };

  const getCurrentAspectRatio = () => {
    const aspectRatio = playlist()?.settings?.aspect_ratio;
    return {
      width: aspectRatio?.width || 16,
      height: aspectRatio?.height || 9,
    };
  };

  const syncAspectRatioEditor = (nextPlaylist: JsonPlaylist) => {
    const aspectRatio = nextPlaylist.settings?.aspect_ratio;
    const width = aspectRatio?.width || 16;
    const height = aspectRatio?.height || 9;
    const ratio = `${width}:${height}`;
    const hasPreset = ASPECT_RATIO_OPTIONS.some((opt) => opt.value === ratio);

    setAspectRatioPreset(hasPreset ? ratio : 'custom');
    setCustomWidth(String(width));
    setCustomHeight(String(height));
    setAspectRatioErrors(new Map());
    setIsAspectRatioModified(false);
  };

  // Derived memo so the effect below only re-runs when the aspect ratio
  // actually changes, not on every item edit/reorder that updates playlist().
  const playlistAspectRatio = createMemo(
    () => playlist()?.settings?.aspect_ratio
  );

  createEffect(() => {
    // Track only the aspect ratio, not the whole playlist object.
    playlistAspectRatio();
    const currentPlaylist = untrack(() => playlist());
    if (!currentPlaylist) {
      return;
    }
    syncAspectRatioEditor(currentPlaylist);
  });

  const validateCustomRatio = (field: 'width' | 'height', value: string) => {
    const errors = validateCustomRatioField(
      field,
      value,
      t,
      aspectRatioErrors()
    );
    setAspectRatioErrors(errors);
    return !errors.has(field);
  };

  const validateCustomAspectRatioExtreme = () => {
    if (aspectRatioPreset() !== 'custom') {
      const errors = new Map(aspectRatioErrors());
      errors.delete('ratio');
      setAspectRatioErrors(errors);
      return true;
    }

    const result = validateAspectRatioExtremeUtil(
      customWidth(),
      customHeight(),
      t,
      aspectRatioErrors()
    );
    setAspectRatioErrors(result.errors);
    return result.isValid;
  };

  const isAspectRatioFormValid = () => {
    const hasNoErrors = ![...aspectRatioErrors().values()].some((e) => e);
    return (
      hasNoErrors &&
      isValidAspectRatio(customWidth(), customHeight()) &&
      isAspectRatioModified()
    );
  };

  const saveAspectRatio = async (nextAspectRatio: {
    width: number;
    height: number;
  }) => {
    const originatingPlaylist = playlist();
    if (!originatingPlaylist) {
      return false;
    }

    return serializePlaylistSave(async () => {
      if (
        props.playlistId !== originatingPlaylist.id ||
        playlist()?.id !== originatingPlaylist.id
      ) {
        return false;
      }

      const currentPlaylist = playlist();
      if (!currentPlaylist) {
        return false;
      }

      const currentAspectRatio = getCurrentAspectRatio();
      if (
        currentAspectRatio.width === nextAspectRatio.width &&
        currentAspectRatio.height === nextAspectRatio.height
      ) {
        setIsAspectRatioModified(false);
        return true;
      }

      try {
        await PlaylistsService.updatePlaylist(
          props.baseUrl,
          props.organizationId,
          `${currentPlaylist.id}`,
          {
            name: currentPlaylist.name,
            description: '',
            settings: {
              ...currentPlaylist.settings,
              aspect_ratio: nextAspectRatio,
            },
          }
        );
        if (
          props.playlistId !== originatingPlaylist.id ||
          playlist()?.id !== originatingPlaylist.id
        ) {
          return false;
        }

        const updatedPlaylist = {
          ...currentPlaylist,
          settings: {
            ...currentPlaylist.settings,
            aspect_ratio: nextAspectRatio,
          },
        };

        setPlaylist(updatedPlaylist);
        props.onChange?.(updatedPlaylist);
        setIsAspectRatioModified(false);
        toast.success(t('playlists.aspectRatioUpdated'));
        return true;
      } catch (error) {
        toast.error(
          t('playlists.errors.updateAspectRatio', { error: String(error) })
        );
        return false;
      }
    });
  };

  const submitCustomAspectRatio = async () => {
    if (
      !validateCustomRatio('width', customWidth()) ||
      !validateCustomRatio('height', customHeight()) ||
      !validateCustomAspectRatioExtreme()
    ) {
      return;
    }

    await saveAspectRatio({
      width: parseInt(customWidth(), 10),
      height: parseInt(customHeight(), 10),
    });
  };

  // Calculate offset for a given item index and seek to it (debounced)
  const seekToItem = (index: number) => {
    // Clear any pending seek
    if (seekDebounceTimer) {
      clearTimeout(seekDebounceTimer);
    }

    // Debounce seeks to avoid queuing
    seekDebounceTimer = setTimeout(() => {
      if (!previewRef) {
        return;
      }

      const currentItems = items();
      if (index < 0 || index >= currentItems.length) {
        return;
      }

      // Get the real offsets from the player (calculated from actual layer durations)
      const layerOffsets = previewRef.getLayerOffsets();

      if (index < layerOffsets.length) {
        const offset = layerOffsets[index].start;
        previewRef.seek(offset);
      }
    }, 100); // 100ms debounce
  };

  const wideViewport = createMediaQuery(WIDE_LAYOUT_QUERY, true);
  const [viewRef, setViewRef] = createSignal<HTMLDivElement>();
  const [viewFits, setViewFits] = createSignal(true);
  createEffect(() => {
    const el = viewRef();
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const width = el.getBoundingClientRect().width;
      if (!width) return;
      const fontSize = parseFloat(getComputedStyle(el).fontSize) || 16;
      setViewFits(width >= WIDE_LAYOUT_MIN_EM * fontSize);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    onCleanup(() => observer.disconnect());
  });
  const wide = () => wideViewport() && viewFits();
  const coarsePointer = createMediaQuery('(pointer: coarse)', false);
  const [activeSection, setActiveSection] = createSignal<SectionId>('content');
  const [pickerOpen, setPickerOpen] = createSignal(false);
  const [addingWidget, setAddingWidget] = createSignal(false);
  const [now, setNow] = createSignal(Date.now());
  const relativeTimeTimer = setInterval(
    () => setNow(Date.now()),
    RELATIVE_TIME_REFRESH_MS
  );
  let addWidget:
    | ((widget: JsonWidget, index?: number) => Promise<void>)
    | undefined;
  let itemsCardRef: HTMLElement | undefined;
  const tabRefs: Partial<Record<SectionId, HTMLButtonElement>> = {};

  onCleanup(() => {
    clearInterval(relativeTimeTimer);
  });

  const allSections: PlaylistSection[] = [
    {
      id: 'content',
      title: () => t('playlists.editor.content'),
      icon: BsCollectionPlay,
    },
    { id: 'preview', title: () => t('common.preview'), icon: BsEye },
    { id: 'settings', title: () => t('common.settings'), icon: BsGear },
  ];

  // On wide screens the preview sits next to the items, so it has no tab.
  const sections = createMemo(() =>
    allSections.filter((section) => !wide() || section.id !== 'preview')
  );

  createEffect(() => {
    if (wide()) setPickerOpen(false);
    if (!sections().some((section) => section.id === activeSection())) {
      setActiveSection('content');
    }
  });

  const tabId = (id: SectionId) => `playlist-${props.playlistId}-tab-${id}`;
  const panelId = (id: 'editor' | 'settings') =>
    `playlist-${props.playlistId}-panel-${id}`;

  const selectSection = (id: SectionId, focus = false) => {
    setActiveSection(id);
    if (id !== 'content') setPickerOpen(false);
    const tab = tabRefs[id];
    if (focus) tab?.focus();
    tab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  const onTabKeyDown = (event: KeyboardEvent) => {
    const list = sections();
    const index = list.findIndex((section) => section.id === activeSection());
    const rtl =
      (event.currentTarget as HTMLElement).closest('[dir="rtl"]') !== null;
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[
      event.key as 'ArrowRight' | 'ArrowLeft'
    ];
    let next: number | undefined;
    if (step) next = (index + step + list.length) % list.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = list.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectSection(list[next].id, true);
  };

  const showWidgets = () => wide() || pickerOpen();
  const showItems = () =>
    wide() || (activeSection() === 'content' && !pickerOpen());
  const showPreview = () => wide() || activeSection() === 'preview';

  const totalDuration = () =>
    items().reduce((total, item) => {
      if (typeof item.duration === 'number' && item.duration > 0) {
        return total + item.duration;
      }
      const dynamic =
        typeof item.id === 'number' ? dynamicDurations()[item.id] : undefined;
      return total + (dynamic && dynamic > 0 ? dynamic : 0);
    }, 0);

  const itemCount = () => {
    const count = items().length;
    return props.store?.i18n?.tp
      ? props.store!.i18n.tp('plurals.items', count)
      : String(count);
  };

  const lastUpdated = () => {
    const updatedAt = playlist()?.updated_at;
    if (!updatedAt) return '';
    now();
    return t('playlists.editor.updated', {
      time: formatRelativeTimeLocalized(updatedAt, locale()),
    });
  };

  const addWidgetToEnd = async (widget: JsonWidget) => {
    if (!addWidget || addingWidget()) return;
    setAddingWidget(true);
    const countBefore = items().length;
    try {
      await addWidget(widget);
      // Cancelling the config keeps the picker open so another widget can be
      // chosen; a successful add returns to the list.
      if (items().length > countBefore) {
        setPickerOpen(false);
        itemsCardRef
          ?.querySelector('.playlist-end-drop-zone')
          ?.scrollIntoView?.({ block: 'nearest' });
      }
    } finally {
      setAddingWidget(false);
    }
  };

  const settingsTimestamps = () => {
    now();
    const current = playlist();
    if (!current) return '';
    return [
      current.inserted_at &&
        t('playlists.editor.created', {
          time: formatRelativeTimeLocalized(current.inserted_at, locale()),
        }),
      current.updated_at &&
        t('playlists.editor.updated', {
          time: formatRelativeTimeLocalized(current.updated_at, locale()),
        }),
    ]
      .filter(Boolean)
      .join(' · ');
  };

  const renamePlaylist = async ({ name }: { name: string }) => {
    const originatingPlaylist = playlist();
    if (!originatingPlaylist) return false;

    return serializePlaylistSave(async () => {
      if (
        props.playlistId !== originatingPlaylist.id ||
        playlist()?.id !== originatingPlaylist.id
      ) {
        return false;
      }

      const currentPlaylist = playlist();
      if (!currentPlaylist) return false;

      try {
        await PlaylistsService.updatePlaylist(
          props.baseUrl,
          props.organizationId,
          `${currentPlaylist.id}`,
          {
            name,
            description: '',
            ...(currentPlaylist.settings
              ? { settings: currentPlaylist.settings }
              : {}),
          }
        );
        if (
          props.playlistId !== originatingPlaylist.id ||
          playlist()?.id !== originatingPlaylist.id
        ) {
          return false;
        }

        const latestPlaylist = playlist();
        if (!latestPlaylist) return false;

        const updatedPlaylist = {
          ...latestPlaylist,
          name,
          updated_at: new Date().toISOString(),
        };
        setPlaylist(updatedPlaylist);
        props.onChange?.(updatedPlaylist);
        toast.success(t('playlists.playlistUpdated', { name }));
        return true;
      } catch (error) {
        toast.error(
          t('playlists.errorUpdating', { name, error: String(error) })
        );
        return false;
      }
    });
  };

  onCleanup(() => {
    if (seekDebounceTimer) {
      clearTimeout(seekDebounceTimer);
      seekDebounceTimer = null;
    }
  });

  return (
    <Show
      when={!loading()}
      fallback={
        <div class="playlist-view-loading" role="status" aria-live="polite">
          <div class="playlist-view-loading__spinner" aria-hidden="true" />
          <div class="playlist-view-loading__text">{t('common.loading')}</div>
        </div>
      }
    >
      <div
        ref={setViewRef}
        class="playlist-view"
        classList={{
          wide: wide(),
          narrow: !wide(),
          picking: !wide() && pickerOpen(),
        }}
      >
        <section class="playlist-summary" aria-label={t('common.status')}>
          <div class="playlist-summary-stats">
            <span class="playlist-summary-stat">
              <strong>{itemCount()}</strong>
            </span>
            <span class="playlist-summary-stat">
              {t('playlists.editor.totalDuration', {
                duration: formatDuration(totalDuration()),
              })}
            </span>
            <Show when={lastUpdated()}>
              <span class="playlist-summary-seen">{lastUpdated()}</span>
            </Show>
          </div>
          <div class="playlist-summary-meta">
            <span
              class="playlist-summary-chip"
              title={t('playlists.aspectRatio')}
            >
              {getCurrentAspectRatio().width}:{getCurrentAspectRatio().height}
            </span>
          </div>
        </section>

        <nav class="playlist-sections">
          <div
            class="playlist-sections-list"
            role="tablist"
            aria-label={t('playlists.editor.sections')}
          >
            <For each={sections()}>
              {(section) => (
                <button
                  ref={(el) => (tabRefs[section.id] = el)}
                  type="button"
                  role="tab"
                  id={tabId(section.id)}
                  class="playlist-section-tab"
                  classList={{ active: activeSection() === section.id }}
                  aria-selected={activeSection() === section.id}
                  aria-controls={panelId(
                    section.id === 'settings' ? 'settings' : 'editor'
                  )}
                  tabIndex={activeSection() === section.id ? 0 : -1}
                  title={section.title()}
                  onClick={() => selectSection(section.id)}
                  onKeyDown={onTabKeyDown}
                >
                  <Dynamic component={section.icon} aria-hidden="true" />
                  <span class="playlist-section-label">{section.title()}</span>
                </button>
              )}
            </For>
          </div>
        </nav>

        <div
          class="playlist-editor"
          classList={{ 'is-hidden': activeSection() === 'settings' }}
          role="tabpanel"
          id={panelId('editor')}
          aria-labelledby={tabId(
            activeSection() === 'settings' ? 'content' : activeSection()
          )}
        >
          <section
            class="playlist-card playlist-widgets-card"
            classList={{ 'is-hidden': !showWidgets() }}
            aria-label={t('playlists.editor.widgets')}
          >
            <WidgetChooser
              widgets={widgets()}
              baseUrl={props.baseUrl}
              locale={locale()}
              t={t}
              onSearch={handleWidgetSearch}
              onAdd={addWidgetToEnd}
              addDisabled={addingWidget()}
              tapToAdd={!wide()}
              title={
                wide()
                  ? t('playlists.editor.widgets')
                  : t('playlists.editor.chooseWidget')
              }
              hint={
                wide()
                  ? t('playlists.editor.dragOrClickHint')
                  : t('playlists.editor.tapToAddHint')
              }
              onClose={wide() ? undefined : () => setPickerOpen(false)}
            />
          </section>

          <section
            ref={itemsCardRef}
            class="playlist-card playlist-items-card"
            classList={{ 'is-hidden': !showItems() }}
            aria-labelledby={`playlist-${props.playlistId}-items-title`}
          >
            <header class="playlist-card-header">
              <div class="playlist-card-heading">
                <h3 id={`playlist-${props.playlistId}-items-title`}>
                  {t('playlists.editor.items')}
                  <span class="playlist-card-count">{items().length}</span>
                </h3>
              </div>
              <Show when={!wide()}>
                <button
                  type="button"
                  class="playlist-add-button"
                  onClick={() => setPickerOpen(true)}
                >
                  <BsPlusLg aria-hidden="true" />
                  {t('playlists.editor.addWidget')}
                </button>
              </Show>
            </header>
            <PlaylistItems
              store={props.store}
              baseUrl={props.baseUrl}
              organizationId={props.organizationId}
              playlistId={props.playlistId}
              items={items()}
              dynamicDurations={dynamicDurations()}
              onEditItem={onEditItem}
              onInsertItem={onInsertItem}
              onMoveItem={onMoveItem}
              onRemoveItem={onRemoveItem}
              onChangeDuration={onChangeDuration}
              onCredentialsError={handleCredentialsError}
              onSeekToItem={seekToItem}
              onAddWidgetReady={(add) => (addWidget = add)}
              reorderButtons={!wide() || coarsePointer()}
              dragEnabled={!coarsePointer()}
              tapToEdit={!wide()}
              emptyContent={
                <>
                  <p class="playlist-empty-title">
                    {t('playlists.editor.emptyTitle')}
                  </p>
                  <p class="playlist-empty-description">
                    {wide()
                      ? t('playlists.editor.dragOrClickHint')
                      : t('playlists.editor.emptyDescription')}
                  </p>
                  <Show when={!wide()}>
                    <button
                      type="button"
                      class="playlist-add-button primary"
                      onClick={() => setPickerOpen(true)}
                    >
                      <BsPlusLg aria-hidden="true" />
                      {t('playlists.editor.addWidget')}
                    </button>
                  </Show>
                </>
              }
            />
          </section>

          <section
            class="playlist-card playlist-preview-card"
            classList={{ 'is-hidden': !showPreview() }}
            aria-label={t('common.preview')}
          >
            <div
              ref={(el) => {
                previewWrapperRef = el;
                setRefReady(true);
              }}
              class="playlist-preview-wrapper"
              classList={{
                'constrain-by-width': constrainByWidth(),
              }}
            >
              <div
                class="playlist-preview"
                style={{
                  'aspect-ratio': `${getCurrentAspectRatio().width} / ${
                    getCurrentAspectRatio().height
                  }`,
                }}
              >
                <PlaylistPreview
                  playlist={playlist()!}
                  dynamicDurations={dynamicDurations()}
                  onReady={async (ref) => {
                    previewRef = ref;
                    // Prime all layers to calculate their actual durations
                    const offsets = await ref.primeAllLayers();
                    handleLayerOffsets(offsets);
                  }}
                />
              </div>
            </div>
          </section>
        </div>

        <div
          class="playlist-settings"
          classList={{ 'is-hidden': activeSection() !== 'settings' }}
          role="tabpanel"
          id={panelId('settings')}
          aria-labelledby={tabId('settings')}
        >
          <section
            class="playlist-card playlist-settings-card"
            aria-label={t('common.settings')}
          >
            <PlaylistNameField
              playlist={playlist()!}
              t={t}
              onSubmit={renamePlaylist}
            />

            <div class="playlist-aspect-ratio-form">
              <Dropdown
                label={t('playlists.aspectRatio')}
                items={ASPECT_RATIO_OPTIONS.map((preset) => ({
                  value: preset.value,
                  name: t(preset.label),
                }))}
                value={aspectRatioPreset()}
                onSelectChange={async (value) => {
                  if (!value) {
                    return;
                  }

                  if (value === 'custom') {
                    const currentAspectRatio = getCurrentAspectRatio();
                    setAspectRatioPreset('custom');
                    setCustomWidth(String(currentAspectRatio.width));
                    setCustomHeight(String(currentAspectRatio.height));
                    setAspectRatioErrors(new Map());
                    setIsAspectRatioModified(false);
                    return;
                  }

                  const currentPlaylist = playlist();
                  if (!currentPlaylist) {
                    return;
                  }

                  setAspectRatioPreset(value);
                  setAspectRatioErrors(new Map());

                  const [width, height] = value.split(':').map(Number);
                  const didSave = await saveAspectRatio({ width, height });
                  if (!didSave) {
                    syncAspectRatioEditor(currentPlaylist);
                  }
                }}
              />
              <p class="playlist-settings-hint">
                {t('playlists.editor.displayDescription')}
              </p>

              <Show when={aspectRatioPreset() === 'custom'}>
                <div
                  class="custom-aspect-ratio"
                  onFocusOut={(event) => {
                    // Save once focus leaves the width/height pair.
                    const next = event.relatedTarget as Node | null;
                    if (next && event.currentTarget.contains(next)) return;
                    if (isAspectRatioFormValid())
                      void submitCustomAspectRatio();
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    if (isAspectRatioFormValid())
                      void submitCustomAspectRatio();
                  }}
                >
                  <FormItem
                    label={t('playlists.aspectRatioWidth')}
                    id="detailsCustomWidth"
                    value={customWidth()}
                    placeholder="16"
                    type="number"
                    onInput={(value: string | number | boolean) => {
                      const strValue = String(value);
                      setCustomWidth(strValue);
                      setIsAspectRatioModified(true);
                      validateCustomRatio('width', strValue);
                      validateCustomAspectRatioExtreme();
                    }}
                  >
                    <div class="error">{aspectRatioErrors().get('width')}</div>
                  </FormItem>

                  <span class="separator">:</span>

                  <FormItem
                    label={t('playlists.aspectRatioHeight')}
                    id="detailsCustomHeight"
                    value={customHeight()}
                    placeholder="9"
                    type="number"
                    onInput={(value: string | number | boolean) => {
                      const strValue = String(value);
                      setCustomHeight(strValue);
                      setIsAspectRatioModified(true);
                      validateCustomRatio('height', strValue);
                      validateCustomAspectRatioExtreme();
                    }}
                  >
                    <div class="error">{aspectRatioErrors().get('height')}</div>
                  </FormItem>
                </div>

                <Show when={aspectRatioErrors().get('ratio')}>
                  <div class="error aspect-ratio-error">
                    {aspectRatioErrors().get('ratio')}
                  </div>
                </Show>
              </Show>
            </div>

            <Show when={settingsTimestamps()}>
              <footer class="playlist-settings-meta">
                {settingsTimestamps()}
              </footer>
            </Show>
          </section>
        </div>
      </div>

      {/* Credentials Error Modal */}
      <Show when={credentialsError()}>
        <Modal
          title={t('playlists.credentialsRequired')}
          description={t('playlists.credentialsRequiredDescription', {
            widget: credentialsError()?.widget
              ? getTranslatedWidgetName(credentialsError()!.widget, locale())
              : t('common.widget'),
          })}
          onClose={() => setCredentialsError(null)}
        >
          <div
            style={{ display: 'flex', 'flex-direction': 'column', gap: '1em' }}
          >
            <p style={{ margin: 0 }}>
              {t('playlists.missingIntegrations')}:{' '}
              <strong>
                {credentialsError()?.missingIntegrations?.join(', ')}
              </strong>
            </p>
            <div
              style={{
                display: 'flex',
                gap: '0.5em',
                'justify-content': 'flex-end',
              }}
            >
              <Button
                label={t('common.cancel')}
                color="secondary"
                onClick={() => setCredentialsError(null)}
              />
              <Button
                label={t('playlists.goToIntegrations')}
                onClick={goToWidgetIntegrations}
              />
            </div>
          </div>
        </Modal>
      </Show>
    </Show>
  );
};
