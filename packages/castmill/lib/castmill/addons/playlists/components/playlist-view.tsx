import {
  JsonPlaylist,
  JsonPlaylistItem,
  JsonWidget,
  JsonWidgetConfig,
  OptionsDict,
} from '@castmill/player';
import { Component, createEffect, createSignal, Show } from 'solid-js';
import { useToast } from '@castmill/ui-common';

import './playlist-view.scss';
import { PlaylistsService } from '../services/playlists.service';
import { WidgetChooser } from './widget-chooser';
import { PlaylistItems } from './playlist-items';
import { PlaylistPreview } from './playlist-preview';

export const PlaylistView: Component<{
  playlistId: number;
  organizationId: string;
  baseUrl: string;
  onChange?: (playlist: JsonPlaylist) => void;
}> = (props) => {
  const toast = useToast();
  const [widgets, setWidgets] = createSignal<JsonWidget[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [items, setItems] = createSignal<JsonPlaylistItem[]>([]);
  const [playlist, setPlaylist] = createSignal<JsonPlaylist>();

  createEffect(() => {
    (async () => {
      const playlist: JsonPlaylist = await PlaylistsService.getPlaylist(
        props.baseUrl,
        props.organizationId,
        props.playlistId
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
  });

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

      const newItems = items().map((i) =>
        i.id === item.id
          ? { ...i, config: { ...config, options: expandedOptions } }
          : i
      );

      setItems(newItems as JsonPlaylistItem[]);
      setPlaylist((prevPlaylist) => ({ ...prevPlaylist, items: newItems }));
    } catch (err) {
      toast.error(`Error updating widget in playlist: ${err}`);
    }
  };

  const resolveWidgetDuration = (widget: JsonWidget, config: OptionsDict) => {
    if (widget.template.type === 'image') {
      return config.duration ? (config.duration as number) * 1000 : 10000;
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
    const duration = resolveWidgetDuration(widget, config.options!);

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

      const newItems = [...items()];
      newItems.splice(index ?? 0, 0, {
        id: newItem.id,
        widget,
        duration,
        config: { ...config, options: expandedOptions },
      });

      setItems(newItems);
      setPlaylist((prevPlaylist) => ({ ...prevPlaylist, items: newItems }));
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

      setItems(newItems);
      setPlaylist((prevPlaylist) => ({ ...prevPlaylist, items: newItems }));
    } catch (err) {
      toast.error(`Error moving widget in playlist: ${err}`);
    }
  };

  const onRemoveItem = async (itemToRemove: JsonPlaylistItem) => {
    try {
      const result = await PlaylistsService.removeItemFromPlaylist(
        props.baseUrl,
        props.organizationId,
        props.playlistId,
        itemToRemove.id
      );

      setItems((prevItems) =>
        prevItems.filter((item) => item !== itemToRemove)
      );
      setPlaylist((prevPlaylist) => ({ ...prevPlaylist, items: items() }));
    } catch (err) {
      toast.error(`Error removing widget from playlist: ${err}`);
    }
  };

  const onChangeDuration = async (item: JsonPlaylistItem, duration: number) => {
    const newItems = items().map((i) =>
      i.id === item.id ? { ...i, duration } : i
    );
    setItems(newItems);
    setPlaylist((prevPlaylist) => ({ ...prevPlaylist, items: newItems }));
    await PlaylistsService.updateItemInPlaylist(
      props.baseUrl,
      props.organizationId,
      props.playlistId,
      item.id,
      {
        duration,
      }
    );
  }


  return (
    <Show when={!loading()}>
      <div class="playlist-view">
        <div class="playlist-preview">
          <PlaylistPreview playlist={playlist()!} />
        </div>
        <div class="playlist-items-wrapper">
          <div class="widget-list">
            <WidgetChooser widgets={widgets()} />
          </div>
          <PlaylistItems
            baseUrl={props.baseUrl}
            organizationId={props.organizationId}
            items={items()}
            onEditItem={onEditItem}
            onInsertItem={onInsertItem}
            onMoveItem={onMoveItem}
            onRemoveItem={onRemoveItem}
            onChangeDuration={onChangeDuration}
          />
        </div>
      </div>
    </Show>
  );
};
