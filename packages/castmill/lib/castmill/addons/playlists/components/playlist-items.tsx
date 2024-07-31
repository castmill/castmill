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

export const PlaylistItems: Component<{
  organizationId: string;
  items: JsonPlaylistItem[];
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
    const item = {
      duration: 10_000,
      widget,
      config: {},
    } as JsonPlaylistItem;

    if (widget.options_schema) {
      const result = await openDialog(item);
      if (!result) {
        return;
      }

      await props.onInsertItem(widget, index, result);
    }
  };

  const removeItem = async (itemToRemove: JsonPlaylistItem) => {
    await props.onRemoveItem(itemToRemove);
  };

  const [isDraggedOver, setIsDraggedOver] = createSignal(false);
  const [animationEnabled, setAnimationEnabled] = createSignal(true);

  let droppableRef: HTMLDivElement | undefined = undefined;

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
              onRemove={removeItem}
              onEdit={() => editItem(item)}
              index={index()}
              onDragStart={() => {
                console.log('drag start');
                setAnimationEnabled(false);
                // We use this to disable animations when starting to drag
                setTimeout(() => setAnimationEnabled(true), 100);
              }}
              animate={animationEnabled()}
            />
          )}
        </For>
        {/*</TransitionGroup>*/}
      </div>
      <Show when={showModal()}>
        <Modal
          title={`Widget "${showModal()?.widget.name}"`}
          description="Configure your widget"
          onClose={() => closeDialog()}
        >
          <WidgetConfig
            item={showModal()!}
            onSubmit={async ({ config, expandedOptions }) => {
              closeDialog({ config, expandedOptions });
            }}
            organizationId={props.organizationId}
          />
        </Modal>
      </Show>
    </>
  );
};
