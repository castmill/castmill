import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

import {
  Component,
  For,
  Show,
  createEffect,
  createSignal,
  onCleanup,
} from 'solid-js';
import { JsonWidget } from '@castmill/player';
import { IconWrapper } from '@castmill/ui-common';
import { RiEditorDraggable } from 'solid-icons/ri';
import { FaSolidMagnifyingGlass } from 'solid-icons/fa';
import { BsArrowLeft, BsPlusLg } from 'solid-icons/bs';

import { DEFAULT_WIDGET_ICON } from '../../common/constants';
import { isImageIcon, getIconUrl } from '../utils/icon-utils';
import {
  getTranslatedWidgetName,
  getTranslatedWidgetDescription,
} from '../../common/utils/widget-catalog-utils';
import './widget-chooser.scss';

type Translate = (key: string, params?: Record<string, any>) => string;

const WidgetItem: Component<{
  widget: JsonWidget;
  baseUrl: string;
  locale?: string;
  t: Translate;
  tapToAdd?: boolean;
  onAdd?: (widget: JsonWidget) => void;
}> = (props) => {
  const [dragging, setDragging] = createSignal(false);

  let draggableRef: HTMLDivElement | undefined = undefined;

  createEffect(() => {
    if (draggableRef && !props.tapToAdd) {
      const cleanup = draggable({
        element: draggableRef,
        getInitialData: () => ({
          widget: props.widget,
        }),
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      });

      onCleanup(() => {
        cleanup();
      });
    }
  });

  const iconUrl = () => getIconUrl(props.widget.icon, props.baseUrl);
  const showAsImage = () => isImageIcon(iconUrl());
  const widgetName = () => getTranslatedWidgetName(props.widget, props.locale);
  const widgetDescription = () =>
    getTranslatedWidgetDescription(props.widget, props.locale);

  return (
    <div
      ref={(el) => (draggableRef = el)}
      class="widget-item"
      classList={{ dragging: dragging(), 'tap-to-add': props.tapToAdd }}
      title={widgetDescription() || undefined}
      onClick={() => {
        if (props.tapToAdd) props.onAdd?.(props.widget);
      }}
    >
      <Show when={!props.tapToAdd}>
        <span class="widget-item-grip" aria-hidden="true">
          <IconWrapper icon={RiEditorDraggable} />
        </span>
      </Show>
      <div class="widget-icon">
        {showAsImage() ? (
          <img
            draggable={false}
            src={iconUrl()}
            alt={widgetName()}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              const fallback = document.createTextNode(DEFAULT_WIDGET_ICON);
              e.target.parentNode?.appendChild(fallback);
            }}
          />
        ) : (
          <span>{props.widget.icon || DEFAULT_WIDGET_ICON}</span>
        )}
      </div>
      <div class="info">
        <div class="name">{widgetName()}</div>
        <div class="description">{widgetDescription()}</div>
      </div>
      <Show when={props.onAdd}>
        <button
          type="button"
          class="widget-item-add"
          title={props.t('playlists.editor.addWidgetNamed', {
            name: widgetName(),
          })}
          aria-label={props.t('playlists.editor.addWidgetNamed', {
            name: widgetName(),
          })}
          onClick={(e) => {
            e.stopPropagation();
            props.onAdd?.(props.widget);
          }}
        >
          <BsPlusLg aria-hidden="true" />
        </button>
      </Show>
    </div>
  );
};

const SEARCH_DEBOUNCE_PERIOD = 300;

export const WidgetChooser: Component<{
  widgets: JsonWidget[];
  baseUrl: string;
  locale?: string;
  t?: Translate;
  onSearch?: (searchText: string) => void;
  /** Adds the widget at the end of the playlist (click/tap alternative to drag). */
  onAdd?: (widget: JsonWidget) => void;
  /** Touch picker mode: tapping a row adds it and dragging is disabled. */
  tapToAdd?: boolean;
  title?: string;
  hint?: string;
  onClose?: () => void;
}> = (props) => {
  const t: Translate = (key, params) => props.t?.(key, params) || key;
  const [searchText, setSearchText] = createSignal('');
  const [debounceTimeout, setDebounceTimeout] = createSignal<any | undefined>(
    undefined
  );

  const handleSearchChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    setSearchText(target.value);

    clearTimeout(debounceTimeout());

    setDebounceTimeout(
      setTimeout(() => {
        props.onSearch?.(target.value);
      }, SEARCH_DEBOUNCE_PERIOD)
    );
  };

  onCleanup(() => {
    clearTimeout(debounceTimeout());
  });

  const searchPlaceholder = () =>
    props.t?.('playlists.searchWidgets') || 'Search widgets...';

  return (
    <div class="widget-chooser">
      <div class="widget-chooser-header">
        <Show when={props.title || props.onClose}>
          <div class="widget-chooser-title">
            <Show when={props.onClose}>
              <button
                type="button"
                class="widget-chooser-back"
                onClick={() => props.onClose?.()}
                title={t('common.back')}
                aria-label={t('common.back')}
              >
                <BsArrowLeft aria-hidden="true" />
              </button>
            </Show>
            <div class="widget-chooser-heading">
              <h3>{props.title}</h3>
              <Show when={props.hint}>
                <p>{props.hint}</p>
              </Show>
            </div>
          </div>
        </Show>
        <div class="search-container">
          <IconWrapper icon={FaSolidMagnifyingGlass} />
          <input
            type="text"
            value={searchText()}
            onInput={handleSearchChange}
            placeholder={searchPlaceholder()}
            aria-label={searchPlaceholder()}
            class="search-input"
          />
        </div>
      </div>
      <div class="items-container">
        <For each={props.widgets}>
          {(widget) => (
            <WidgetItem
              widget={widget}
              baseUrl={props.baseUrl}
              locale={props.locale}
              t={t}
              tapToAdd={props.tapToAdd}
              onAdd={props.onAdd}
            />
          )}
        </For>
      </div>
    </div>
  );
};
