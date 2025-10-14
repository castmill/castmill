import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

import {
  Component,
  For,
  createEffect,
  createSignal,
  onCleanup,
} from 'solid-js';
import { JsonWidget } from '@castmill/player';
import { IconWrapper } from '@castmill/ui-common';
import { RiEditorDraggable } from 'solid-icons/ri';
import { FaSolidMagnifyingGlass } from 'solid-icons/fa';

import { DEFAULT_WIDGET_ICON } from '../../common/constants';
import './widget-chooser.scss';

const WidgetItem: Component<{ widget: JsonWidget }> = (props) => {
  const [dragging, setDragging] = createSignal(false);

  let draggableRef: HTMLDivElement | undefined = undefined;

  createEffect(() => {
    if (draggableRef) {
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

  const isImageIcon =
    props.widget.icon &&
    (props.widget.icon.startsWith('data:image/') ||
      props.widget.icon.startsWith('http://') ||
      props.widget.icon.startsWith('https://') ||
      props.widget.icon.startsWith('/'));

  return (
    <div
      ref={draggableRef}
      class="widget-item"
      style={{ opacity: dragging() ? 0.5 : 1.0 }}
    >
      <IconWrapper icon={RiEditorDraggable} />
      <div class="widget-icon">
        {isImageIcon ? (
          <img
            src={props.widget.icon}
            alt={props.widget.name}
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
        <div class="name">{props.widget.name}</div>
        <div class="description">{props.widget.description}</div>
      </div>
    </div>
  );
};

const SEARCH_DEBOUNCE_PERIOD = 300;

export const WidgetChooser: Component<{
  widgets: JsonWidget[];
  onSearch?: (searchText: string) => void;
}> = (props) => {
  const [searchText, setSearchText] = createSignal('');
  const [debounceTimeout, setDebounceTimeout] = createSignal<any | undefined>(
    undefined
  );

  const handleSearchChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    setSearchText(target.value);

    // Clear the previous timeout
    clearTimeout(debounceTimeout());

    // Set up a new timeout
    setDebounceTimeout(
      setTimeout(() => {
        props.onSearch?.(target.value);
      }, SEARCH_DEBOUNCE_PERIOD)
    );
  };

  // Cleanup to clear the timeout when the component unmounts
  onCleanup(() => {
    clearTimeout(debounceTimeout());
  });

  return (
    <div class="widget-chooser">
      <div class="widget-chooser-header">
        <div class="search-container">
          <IconWrapper icon={FaSolidMagnifyingGlass} />
          <input
            type="text"
            value={searchText()}
            onInput={handleSearchChange}
            placeholder="Search widgets..."
            class="search-input"
          />
        </div>
      </div>
      <div class="items-container">
        <For each={props.widgets}>
          {(widget) => <WidgetItem widget={widget} />}
        </For>
      </div>
    </div>
  );
};
