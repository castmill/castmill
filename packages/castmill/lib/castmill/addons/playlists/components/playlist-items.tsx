import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

import {
  Component,
  For,
  createEffect,
  createSignal,
  onCleanup,
  Show,
} from 'solid-js';
import {
  JsonPlaylistItem,
  JsonWidget,
  JsonWidgetConfig,
  OptionsDict,
} from '@castmill/player';
import { Modal } from '@castmill/ui-common';

import { PlaylistItem } from './playlist-item';
import { WidgetConfig } from './widget-config';
import { AddonStore } from '../../common/interfaces/addon-store';
import { PlaylistsService } from '../services/playlists.service';

export interface CredentialsError {
  widget: JsonWidget;
  missingIntegrations: string[];
}

export const PlaylistItems: Component<{
  store: AddonStore;
  baseUrl: string;
  organizationId: string;
  playlistId: number;
  items: JsonPlaylistItem[];
  dynamicDurations?: Record<number, number>;
  onEditItem: (
    item: JsonPlaylistItem,
    opts: {
      config: Partial<JsonWidgetConfig>;
      expandedOptions: OptionsDict;
    }
  ) => Promise<void>;
  onInsertItem: (
    widget: JsonWidget,
    index: number,
    opts: {
      config: Partial<JsonWidgetConfig>;
      expandedOptions: OptionsDict;
    }
  ) => Promise<void>;
  onMoveItem: (
    item: JsonPlaylistItem,
    currentIndex: number,
    newIndex: number | undefined
  ) => Promise<void>;
  onRemoveItem: (item: JsonPlaylistItem) => Promise<void>;
  onChangeDuration: (item: JsonPlaylistItem, duration: number) => Promise<void>;
  onCredentialsError?: (error: CredentialsError) => void;
  onSeekToItem?: (index: number) => void;
}> = (props) => {
  const [showModal, setShowModal] = createSignal<JsonPlaylistItem>();
  const [promiseResolve, setPromiseResolve] = createSignal<{
    resolve: (
      value:
        | {
            config: Partial<JsonWidgetConfig>;
            expandedOptions: OptionsDict;
          }
        | undefined
    ) => void;
    reject: () => void;
  }>();

  const closeDialog = (value?: {
    config: Partial<JsonWidgetConfig>;
    expandedOptions: OptionsDict;
  }) => {
    setShowModal();
    promiseResolve()?.resolve(value);
  };

  const openDialog = (item: JsonPlaylistItem) => {
    // Create a promise that resolves when the dialog is closed
    return new Promise<
      | {
          config: Partial<JsonWidgetConfig>;
          expandedOptions: OptionsDict;
        }
      | undefined
    >((resolve, reject) => {
      setPromiseResolve({ resolve, reject });
      setShowModal(item);
    });
  };

  const editItem = async (item: JsonPlaylistItem) => {
    const result = await openDialog(item);

    if (!result) {
      return;
    }

    const { config, expandedOptions } = result;

    await props.onEditItem(item, { config, expandedOptions });
  };

  const moveItem = async (
    item: JsonPlaylistItem,
    currentIndex: number,
    newIndex: number | undefined
  ) => {
    await props.onMoveItem(item, currentIndex, newIndex);
  };

  const insertItem = async (widget: JsonWidget, index: number) => {
    // Start prefetching integration data in the background immediately
    // This warms up the cache while the user configures the widget or while
    // credentials are being checked, improving perceived performance
    let prefetchPromise: Promise<any> | null = null;
    if (widget.id) {
      prefetchPromise = PlaylistsService.prefetchWidgetData(
        props.baseUrl,
        props.organizationId,
        widget.id
      ).catch((err) => {
        // Don't block on prefetch errors - it's just a performance optimization
        console.warn('Widget data prefetch failed:', err);
        return null;
      });
    }

    // Check if widget requires credentials that aren't configured
    if (widget.id) {
      try {
        const credentialsStatus = await PlaylistsService.checkWidgetCredentials(
          props.baseUrl,
          props.organizationId,
          widget.id
        );

        if (!credentialsStatus.configured) {
          // Notify parent about the credentials error
          props.onCredentialsError?.({
            widget,
            missingIntegrations: credentialsStatus.missing_integrations,
          });
          return;
        }
      } catch (err) {
        // If the check fails, continue anyway - the server will validate
        console.warn('Failed to check widget credentials:', err);
      }
    }

    const item = {
      duration: 10_000,
      widget,
      config: {},
    } as JsonPlaylistItem;

    // Check if widget has any configurable options
    const hasOptionsSchema =
      widget.options_schema &&
      (Array.isArray(widget.options_schema)
        ? widget.options_schema.length > 0
        : Object.keys(widget.options_schema).length > 0);

    if (hasOptionsSchema) {
      const result = await openDialog(item);
      if (!result) {
        return;
      }

      // Wait for prefetch to complete before inserting (it's likely done by now)
      if (prefetchPromise) {
        await prefetchPromise;
      }

      await props.onInsertItem(widget, index, result);
    } else {
      // Wait for prefetch to complete before inserting
      if (prefetchPromise) {
        await prefetchPromise;
      }

      // No configuration needed - insert directly with empty options
      await props.onInsertItem(widget, index, {
        config: { options: {} },
        expandedOptions: {},
      });
    }
  };

  const removeItem = async (itemToRemove: JsonPlaylistItem) => {
    await props.onRemoveItem(itemToRemove);
  };

  const changeDuration = async (item: JsonPlaylistItem, duration: number) => {
    await props.onChangeDuration(item, duration);
  };

  const [isDraggedOver, setIsDraggedOver] = createSignal(false);
  const [animationEnabled, setAnimationEnabled] = createSignal(true);
  const [endZoneHovered, setEndZoneHovered] = createSignal(false);

  let droppableRef: HTMLDivElement | undefined = undefined;
  let endZoneRef: HTMLDivElement | undefined = undefined;

  createEffect(() => {
    if (droppableRef) {
      const cleanup = dropTargetForElements({
        element: droppableRef,
        onDragEnter: () => setIsDraggedOver(true),
        onDragLeave: () => setIsDraggedOver(false),
        onDrop: ({ location, self, source }) => {
          const { widget, item, index } = source.data as {
            widget?: JsonWidget;
            item?: JsonPlaylistItem;
            index?: number;
          };
          setIsDraggedOver(false);

          const dropTarget = location.current.dropTargets[0];

          // If the widget is not null, we have a new widget to add
          if (widget) {
            // If self matches the drop target, then it was dropped on the parent element
            if (dropTarget?.element === self.element) {
              // Was dropped on the outer drop target, so lets add it to the end of the list
              const lastIndex = props.items.length ? props.items.length : 0;

              insertItem(widget, lastIndex);
              return;
            } else {
              const { index } = dropTarget.data;
              insertItem(widget, index as number);
            }
          } else if (item) {
            const { index: targetIndex } = dropTarget.data;
            moveItem(item, index!, targetIndex as number);
          }
        },
      });

      onCleanup(() => {
        cleanup();
      });
    }
  });

  // Setup drop zone for the end of the list
  createEffect(() => {
    if (endZoneRef) {
      const cleanup = dropTargetForElements({
        element: endZoneRef,
        getData: () => ({ index: props.items.length }),
        onDragEnter: () => setEndZoneHovered(true),
        onDragLeave: () => setEndZoneHovered(false),
        onDrop: () => setEndZoneHovered(false),
      });

      onCleanup(() => {
        cleanup();
      });
    }
  });

  return (
    <>
      <div
        ref={droppableRef}
        style={{ 'background-color': isDraggedOver() ? 'lightblue' : '#555' }}
        class="playlist-items"
      >
        {/* Animates an empty space when dragging over an item 
        <TransitionGroup name="item-fade">
        */}
        <For each={props.items}>
          {(item, index) => (
            <PlaylistItem
              item={item}
              baseUrl={props.baseUrl}
              dynamicDuration={
                typeof item.id === 'number'
                  ? props.dynamicDurations?.[item.id]
                  : undefined
              }
              onRemove={removeItem}
              onChangeDuration={changeDuration}
              onEdit={() => editItem(item)}
              onClick={() => props.onSeekToItem?.(index())}
              index={index()}
              onDragStart={() => {
                setAnimationEnabled(false);
                // We use this to disable animations when starting to drag
                setTimeout(() => setAnimationEnabled(true), 100);
              }}
              animate={animationEnabled()}
            />
          )}
        </For>
        {/*</TransitionGroup>*/}

        {/* Expandable drop zone at the end of the list */}
        <div
          ref={endZoneRef}
          class="playlist-end-drop-zone"
          classList={{ hovered: endZoneHovered() }}
        />
      </div>
      <Show when={showModal()}>
        <Modal
          title={`Widget "${showModal()?.widget.name}"`}
          description="Configure your widget"
          onClose={() => closeDialog()}
        >
          <WidgetConfig
            store={props.store}
            baseUrl={props.baseUrl}
            item={showModal()!}
            onSubmit={async ({ config, expandedOptions }) => {
              closeDialog({ config, expandedOptions });
            }}
            organizationId={props.organizationId}
            playlistId={props.playlistId}
          />
        </Modal>
      </Show>
    </>
  );
};
