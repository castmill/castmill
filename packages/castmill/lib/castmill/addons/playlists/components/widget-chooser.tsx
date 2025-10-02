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
              const fallback = document.createTextNode('📦');
              e.target.parentNode?.appendChild(fallback);
            }}
          />
        ) : (
          <span>{props.widget.icon || '📦'}</span>
        )}
      </div>
      <div class="info">
        <div class="name">{props.widget.name}</div>
        <div class="description">{props.widget.description}</div>
      </div>
    </div>
  );
};

export const WidgetChooser: Component<{
  widgets: JsonWidget[];
}> = (props) => {
  return (
    <For each={props.widgets}>{(widget) => <WidgetItem widget={widget} />}</For>
  );
};
