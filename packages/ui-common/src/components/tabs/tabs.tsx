// Tabs.tsx
import {
  Component,
  createSignal,
  createUniqueId,
  For,
  JSX,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';
import styles from './tabs.module.scss';

export interface TabItem {
  title: string | (() => string); // Can be string or function for reactive translations
  content: () => JSX.Element;
  /**
   * Optional icon. On small screens (≤36em) inactive tabs with an icon
   * collapse to icon-only; the full title stays available to screen readers
   * and as a tooltip.
   */
  icon?: Component<{
    class?: string;
    'aria-hidden'?: boolean | 'true' | 'false';
  }>;
}

export interface TabsProps {
  tabs: TabItem[];
  initialIndex?: number;
  /** Accessible (localized) name for the tab list. */
  ariaLabel?: string;
}

export const Tabs = (props: TabsProps) => {
  const [activeTab, setActiveTab] = createSignal(props.initialIndex || 0);
  const [overflowStart, setOverflowStart] = createSignal(false);
  const [overflowEnd, setOverflowEnd] = createSignal(false);

  const baseId = `cm-tabs-${createUniqueId()}`;
  const tabId = (index: number) => `${baseId}-tab-${index}`;
  const panelId = `${baseId}-panel`;
  let listRef: HTMLDivElement | undefined;

  // Clamp in case the tabs array shrinks while mounted
  const activeIndex = () =>
    Math.max(0, Math.min(activeTab(), props.tabs.length - 1));

  // Helper to resolve title - supports both string and function
  const getTitle = (tab: TabItem) =>
    typeof tab.title === 'function' ? tab.title() : tab.title;

  const updateOverflow = () => {
    if (!listRef) return;
    // scrollLeft is negative (or reversed) in RTL, so use its magnitude
    const scrolled = Math.abs(listRef.scrollLeft);
    setOverflowStart(scrolled > 1);
    setOverflowEnd(scrolled + listRef.clientWidth < listRef.scrollWidth - 1);
  };

  const scrollTabIntoView = (index: number) => {
    listRef?.children.item(index)?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
    });
  };

  const selectTab = (index: number, focus = false) => {
    setActiveTab(index);
    if (focus)
      (listRef?.children.item(index) as HTMLButtonElement | null)?.focus();
    scrollTabIntoView(index);
  };

  const onTabKeyDown = (event: KeyboardEvent) => {
    const count = props.tabs.length;
    if (!count) return;
    const rtl =
      (event.currentTarget as HTMLElement).closest('[dir="rtl"]') !== null;
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[
      event.key as 'ArrowRight' | 'ArrowLeft'
    ];
    let next: number | undefined;
    if (step) next = (activeIndex() + step + count) % count;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectTab(next, true);
  };

  // Tabs (and their titles) can change without the list resizing, so watch
  // the buttons as well as the list itself.
  let observer: ResizeObserver | undefined;
  const setTabRef = (el: HTMLButtonElement) => {
    observer?.observe(el);
    onCleanup(() => observer?.unobserve(el));
  };

  onMount(() => {
    if (activeIndex() > 0) scrollTabIntoView(activeIndex());
    updateOverflow();
    if (typeof ResizeObserver !== 'undefined' && listRef) {
      observer = new ResizeObserver(updateOverflow);
      observer.observe(listRef);
      Array.from(listRef.children).forEach((tab) => observer!.observe(tab));
    }
  });

  onCleanup(() => observer?.disconnect());

  return (
    <div class={styles.tabs}>
      <div class={styles.tabHeader}>
        <div
          ref={listRef}
          class={styles.tabList}
          role="tablist"
          aria-label={props.ariaLabel}
          data-overflow-start={overflowStart() ? '' : undefined}
          data-overflow-end={overflowEnd() ? '' : undefined}
          onScroll={updateOverflow}
        >
          <For each={props.tabs}>
            {(tab, index) => (
              <button
                ref={setTabRef}
                type="button"
                role="tab"
                id={tabId(index())}
                class={`${styles.tabButton} ${activeIndex() === index() ? styles.active : ''}${tab.icon ? ` ${styles.hasIcon}` : ''}`}
                aria-selected={activeIndex() === index()}
                aria-controls={panelId}
                tabIndex={activeIndex() === index() ? 0 : -1}
                title={getTitle(tab)}
                onClick={() => selectTab(index())}
                onKeyDown={onTabKeyDown}
              >
                <Show when={tab.icon}>
                  {(icon) => (
                    <Dynamic
                      component={icon()}
                      class={styles.tabIcon}
                      aria-hidden="true"
                    />
                  )}
                </Show>
                <span class={styles.tabLabel}>{getTitle(tab)}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      <div
        class={`${styles.tabContent} ${styles.tabContentActive}`}
        role="tabpanel"
        tabIndex={0}
        id={panelId}
        aria-labelledby={tabId(activeIndex())}
      >
        <Show when={props.tabs[activeIndex()]}>
          {props.tabs[activeIndex()].content()}
        </Show>
      </div>
    </div>
  );
};

export default Tabs;
