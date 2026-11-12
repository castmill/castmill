import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  untrack,
} from 'solid-js';
import { ResourceManager } from '@castmill/cache';
import { Item } from './item';
import { TemplateConfig } from './binding';
import { BaseComponentProps } from './interfaces/base-component-props';
import { PaginatedListComponentOptions } from './paginated-list';
import { TemplateComponentTypeUnion } from './template';
import { Timeline, TimelineBasic, TimelineItem } from './timeline';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';

interface ActivePagesProps extends BaseComponentProps {
  config: TemplateConfig;
  opts: PaginatedListComponentOptions;
  component: TemplateComponentTypeUnion;
  resourceManager: ResourceManager;
  globals: PlayerGlobals;
}

/**
 * Unlike the animated list, only one page owns media resources. Page-local
 * timelines keep hidden videos from playing or occupying hardware decoders.
 */
export const ActivePages: Component<ActivePagesProps> = (props) => {
  const [index, setIndex] = createSignal(0);
  const pages = createMemo<unknown[][]>((previous) => {
    const items = props.opts.items || [];
    const size = Math.max(1, Math.floor(props.opts.pageSize || 1));
    const result: unknown[][] = [];
    for (let i = 0; i < items.length; i += size) {
      result.push(items.slice(i, i + size));
    }
    return previous.length === result.length &&
      previous.every(
        (page, index) =>
          page.length === result[index].length &&
          page.every((item, itemIndex) => item === result[index][itemIndex])
      )
      ? previous
      : result;
  }, []);
  const pageDuration = () =>
    Math.max(0.1, props.opts.pageDuration || 10) * 1000;
  const duration = () => pages().length * pageDuration();
  let pageTimeline: Timeline | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let base = 0;
  let started = 0;
  let running = false;
  let reportedReady = false;

  const offset = () => base + (running ? Date.now() - started : 0);
  const position = () => {
    const cycle = duration();
    return cycle ? ((offset() % cycle) + cycle) % cycle : 0;
  };
  const localOffset = () => {
    const local = position() % pageDuration();
    const cycle = pageTimeline?.duration() || 0;
    return cycle && pageTimeline?.wrapsTime() ? local % cycle : local;
  };
  const sync = (force = false) => {
    const next = Math.floor(position() / pageDuration());
    if (next !== index()) {
      setIndex(next);
    } else if (force && pageTimeline) {
      pageTimeline.pause();
      pageTimeline.seek(localOffset());
      if (running) pageTimeline.play(localOffset());
    }
  };
  const stop = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    pageTimeline?.pause();
  };
  const driver: TimelineBasic = {
    duration,
    play(value = 0) {
      stop();
      base = value;
      started = Date.now();
      running = true;
      sync(true);
      timer = setInterval(() => sync(), 50);
    },
    seek(value) {
      base = value;
      started = Date.now();
      sync(true);
    },
    pause() {
      base = offset();
      running = false;
      stop();
    },
  };

  const ready = () => {
    if (reportedReady) props.onLayoutUpdate?.();
    else {
      reportedReady = true;
      props.onReady();
    }
  };

  createEffect(() => {
    const count = pages().length;
    untrack(() => sync());
    const item: TimelineItem = {
      start: 0,
      repeat: true,
      duration: duration(),
      child: driver,
    };
    if (count) props.timeline.add(item);
    else ready();
    onCleanup(() => {
      props.timeline.remove(item);
      driver.pause();
    });
  });

  return (
    <div
      data-component="paginated-list"
      data-name={props.name}
      style={props.style}
    >
      <Show when={pages()[index()]} keyed>
        {(items) => {
          const timeline = new Timeline('active-page', { loop: true });
          pageTimeline = timeline;
          const readyItems = new Set<number>();
          let pageReady = false;
          const onReady = (item: number) => {
            if (pageReady) return;
            readyItems.add(item);
            if (readyItems.size !== items.length) return;
            pageReady = true;
            timeline.seek(localOffset());
            if (running) timeline.play(localOffset());
            ready();
          };
          onCleanup(() => {
            timeline.pause();
            if (pageTimeline === timeline) pageTimeline = undefined;
          });
          return (
            <div
              style={{ position: 'relative', width: '100%', height: '100%' }}
            >
              <For each={items}>
                {(item, i) => (
                  <Item
                    config={props.config}
                    context={item}
                    component={props.component}
                    timeline={timeline}
                    resourceManager={props.resourceManager}
                    globals={props.globals}
                    onReady={() => onReady(i())}
                    onLayoutUpdate={props.onLayoutUpdate}
                  />
                )}
              </For>
            </div>
          );
        }}
      </Show>
    </div>
  );
};
