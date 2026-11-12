import gsap from 'gsap';
import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
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

interface MountedPage {
  /** Index in play order, i.e. after the resume rotation. */
  page: number;
  /** Index in the list of pages. */
  source: number;
  items: unknown[];
  timeline: Timeline;
  ready: boolean;
  /** Mounted ahead of time, waiting to slide in. */
  hidden: boolean;
  el?: HTMLDivElement;
}

interface Slide {
  from?: MountedPage;
  to: MountedPage;
  tween?: GSAPTimeline;
}

const FALLBACK_PAGE_MS = 10000;
const DEFAULT_TRANSITION_SECONDS = 1;
// A sliding page is mounted this long before it enters, so it is ready.
const PRELOAD_MS = 3000;
const MAX_RESUME_POSITIONS = 200;
// A play that goes back to within this of the start, from at least this far,
// is a new play of the list. Timelines report positions on their first tick,
// a few ms after the start.
const START_MS = 250;

// The page each resumable list starts from on its next play. Lists with the
// same name and widget options share it.
const resumePositions = new Map<string, number>();

const rememberPosition = (key: string, page: number) => {
  resumePositions.delete(key);
  resumePositions.set(key, page);
  if (resumePositions.size > MAX_RESUME_POSITIONS) {
    resumePositions.delete(resumePositions.keys().next().value!);
  }
};

const resumeKeyFor = (name: string | undefined, options: unknown) => {
  try {
    return `${name || ''}:${JSON.stringify(options ?? null)}`;
  } catch {
    return `${name || ''}`;
  }
};

/**
 * Unlike the animated list, only the current page owns media resources (and
 * the next one, briefly, while it slides in). Page-local timelines keep hidden
 * videos from playing or occupying hardware decoders.
 *
 * With `pageDuration: "auto"` every page lasts as long as its content timeline
 * (e.g. an image carousel), measured once the page is ready. Pages not shown
 * yet are estimated from the measured ones. With `resume`, a new play starts
 * at the page where the previous play stopped, so a list longer than its
 * playlist item still gets shown in full over several plays.
 */
export const ActivePages: Component<ActivePagesProps> = (props) => {
  // Unchanged items keep the same pages, so a list re-resolved to the same
  // items (e.g. a clock-dependent filter) doesn't remount them.
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
  const count = () => pages().length;
  const auto = () => props.opts.pageDuration === 'auto';
  const fixedMs = () => {
    const seconds = props.opts.pageDuration;
    return typeof seconds === 'number' && seconds > 0
      ? Math.max(100, seconds * 1000)
      : FALLBACK_PAGE_MS;
  };
  const sliding = () => props.opts.transition === 'slide-left' && count() > 1;
  const transitionSeconds = () => {
    const seconds = props.opts.transitionDuration;
    return typeof seconds === 'number' && seconds >= 0
      ? seconds
      : DEFAULT_TRANSITION_SECONDS;
  };
  const resumeKey = untrack(() =>
    props.opts.resume ? resumeKeyFor(props.name, props.config.options) : ''
  );

  // Measured page durations by source index (auto mode).
  const measured = new Map<number, number>();
  let measuredPages = pages();
  let positionShift = 0;
  let rotation = (resumeKey && resumePositions.get(resumeKey)) || 0;
  let shownInRun = 0;
  let noted = -1;

  const source = (page: number) => {
    const n = count();
    return n ? (((rotation + page) % n) + n) % n : 0;
  };
  const estimate = () => {
    if (!measured.size) return fixedMs();
    let total = 0;
    measured.forEach((value) => (total += value));
    return total / measured.size;
  };
  const durationAt = (page: number) =>
    auto() ? (measured.get(source(page)) ?? estimate()) : fixedMs();
  const startOf = (page: number) => {
    let start = 0;
    for (let i = 0; i < page; i++) start += durationAt(i);
    return start;
  };
  const duration = () => startOf(count());
  const locate = (value: number) => {
    const n = count();
    const cycle = duration();
    if (!n || !cycle) return { page: 0, local: 0 };
    let position = ((value % cycle) + cycle) % cycle;
    for (let page = 0; page < n; page++) {
      const length = durationAt(page);
      if (position < length) return { page, local: position };
      position -= length;
    }
    return { page: n - 1, local: durationAt(n - 1) };
  };

  const [mounted, setMounted] = createSignal<MountedPage[]>([]);
  let current = -1;
  let slide: Slide | undefined;
  let item: TimelineItem | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let base = 0;
  let started = 0;
  let running = false;
  let reached = 0;
  let reportedReady = false;

  const offset = () => base + (running ? Date.now() - started : 0);

  const ready = () => {
    if (reportedReady) props.onLayoutUpdate?.();
    else {
      reportedReady = true;
      props.onReady();
    }
  };

  const startPage = (page: MountedPage) => {
    const at = locate(offset());
    const local = at.page === page.page ? at.local : 0;
    const cycle = page.timeline.duration();
    // Only looping timelines wrap; repeating children keep their own time.
    const value = cycle && page.timeline.wrapsTime() ? local % cycle : local;
    page.timeline.pause();
    page.timeline.seek(value);
    if (running) page.timeline.play(value);
  };

  const createPage = (page: number, hidden: boolean): MountedPage => ({
    page,
    source: source(page),
    items: pages()[source(page)] || [],
    timeline: new Timeline('active-page', { loop: true }),
    ready: false,
    hidden,
  });

  const reveal = (page: MountedPage) => {
    page.hidden = false;
    if (!page.el) return;
    gsap.set(page.el, { clearProps: 'transform' });
    page.el.style.visibility = '';
  };

  const finishSlide = () => {
    const done = slide;
    if (!done) return;
    slide = undefined;
    done.tween?.kill();
    reveal(done.to);
    if (done.from) {
      setMounted(mounted().filter((page) => page !== done.from));
    }
  };

  const runSlide = (active: Slide) => {
    const seconds = transitionSeconds();
    if (!active.to.el || !seconds) {
      finishSlide();
      return;
    }
    active.to.hidden = false;
    active.to.el.style.visibility = '';
    const tween = gsap.timeline({
      onComplete: () => {
        if (slide === active) finishSlide();
      },
    });
    const vars = { duration: seconds, ease: 'power2.inOut' };
    tween.fromTo(active.to.el, { xPercent: 100 }, { ...vars, xPercent: 0 }, 0);
    if (active.from?.el) {
      tween.fromTo(
        active.from.el,
        { xPercent: 0 },
        { ...vars, xPercent: -100 },
        0
      );
    }
    active.tween = tween;
    if (!running) tween.pause();
  };

  const show = (index: number) => {
    finishSlide();
    current = index;
    const page =
      mounted().find((candidate) => candidate.page === index) ||
      createPage(index, false);
    setMounted([page]);
    reveal(page);
    if (page.ready) startPage(page);
  };

  const slideTo = (index: number) => {
    finishSlide();
    const from = mounted().find((page) => page.page === current);
    from?.timeline.pause();
    current = index;
    let to = mounted().find((page) => page.page === index);
    if (!to) {
      to = createPage(index, true);
      setMounted([...mounted(), to]);
    }
    slide = { from, to };
    if (to.ready) {
      runSlide(slide);
      startPage(to);
    }
  };

  const preload = (index: number) => {
    if (mounted().some((page) => page.page === index)) return;
    setMounted([...mounted(), createPage(index, true)]);
  };

  const note = (page: number) => {
    if (!running || page === noted) return;
    noted = page;
    if (resumeKey) {
      // Continue with an interrupted page, unless it was the first one of the
      // play: a page longer than the playlist item would never be left.
      const next = shownInRun === 0 ? source(page) + 1 : source(page);
      rememberPosition(resumeKey, next % count());
    }
    shownInRun++;
  };

  const sync = (force = false) => {
    const n = count();
    if (!n) return;
    reached = Math.max(reached, offset());
    const at = locate(offset());
    if (at.page !== current) {
      if (
        !force &&
        running &&
        sliding() &&
        current >= 0 &&
        at.page === (current + 1) % n
      ) {
        slideTo(at.page);
      } else {
        show(at.page);
      }
    } else if (force) {
      const page = mounted().find((candidate) => candidate.page === current);
      if (page?.ready) startPage(page);
    }
    note(at.page);
    if (running && sliding() && !slide) {
      if (durationAt(at.page) - at.local <= PRELOAD_MS) {
        preload((at.page + 1) % n);
      }
    }
  };

  const reset = () => {
    finishSlide();
    current = -1;
    setMounted([]);
  };

  const measure = (page: MountedPage) => {
    if (!auto()) return;
    const length = page.timeline.duration() || fixedMs();
    if (measured.get(page.source) === length) return;
    // Keep the current position within its page: only later pages move.
    const previousPosition = offset();
    const at = locate(previousPosition);
    measured.set(page.source, length);
    base = startOf(at.page) + at.local;
    positionShift += base - previousPosition;
    started = Date.now();
    if (item) item.duration = duration();
  };

  const pageReady = (page: MountedPage) => {
    page.ready = true;
    measure(page);
    if (page.page !== current) return;
    if (slide && slide.to === page && !slide.tween) runSlide(slide);
    startPage(page);
    ready();
  };

  const stopTimer = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    mounted().forEach((page) => page.timeline.pause());
  };

  const driver: TimelineBasic = {
    duration,
    play(value = 0) {
      stopTimer();
      let position = value + positionShift;
      if (resumeKey && position < START_MS && reached - position >= START_MS) {
        const next = resumePositions.get(resumeKey) || 0;
        shownInRun = 0;
        noted = -1;
        reached = value;
        if (count() && next % count() !== source(0)) {
          rotation = next;
          reset();
        }
        positionShift = 0;
        position = value;
      }
      base = position;
      started = Date.now();
      running = true;
      if (slide?.tween && locate(position).page === current)
        slide.tween.resume();
      else finishSlide();
      sync(true);
      timer = setInterval(() => sync(), 50);
    },
    seek(value) {
      finishSlide();
      base = value + positionShift;
      started = Date.now();
      sync(true);
    },
    pause() {
      base = offset();
      running = false;
      stopTimer();
      slide?.tween?.pause();
    },
  };

  createEffect(() => {
    const n = count();
    const currentPages = pages();
    untrack(() => {
      if (currentPages !== measuredPages) {
        base = offset() - positionShift;
        started = Date.now();
        measured.clear();
        measuredPages = currentPages;
        positionShift = 0;
        if (item) item.duration = duration();
      }
      measured.forEach((_value, key) => {
        if (key >= n) measured.delete(key);
      });
      reset();
      sync(true);
    });
    const timelineItem: TimelineItem = {
      start: 0,
      repeat: true,
      duration: untrack(duration),
      child: driver,
    };
    item = timelineItem;
    if (n) props.timeline.add(timelineItem);
    else ready();
    onCleanup(() => {
      props.timeline.remove(timelineItem);
      driver.pause();
      if (item === timelineItem) item = undefined;
    });
  });

  onCleanup(() => {
    finishSlide();
    stopTimer();
  });

  return (
    <div
      data-component="paginated-list"
      data-name={props.name}
      style={props.style}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <For each={mounted()}>
          {(page) => {
            const readyItems = new Set<number>();
            const onReady = (index: number) => {
              if (page.ready) return;
              readyItems.add(index);
              if (readyItems.size === page.items.length) pageReady(page);
            };
            onCleanup(() => {
              page.timeline.pause();
              if (page.el) gsap.killTweensOf(page.el);
            });
            return (
              <div
                ref={(el) => {
                  page.el = el;
                  // A preloaded page stays hidden until it slides in.
                  if (page.hidden) el.style.visibility = 'hidden';
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                }}
              >
                <For each={page.items}>
                  {(entry, i) => (
                    <Item
                      config={props.config}
                      context={entry}
                      component={props.component}
                      timeline={page.timeline}
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
        </For>
      </div>
    </div>
  );
};
