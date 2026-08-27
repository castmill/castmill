// Tabs.tsx
import { createSignal, For, JSX, Show } from 'solid-js';
import styles from './tabs.module.scss';

export interface TabItem {
  title: string | (() => string); // Can be string or function for reactive translations
  content: () => JSX.Element;
}

export interface TabsProps {
  tabs: TabItem[];
  initialIndex?: number;
}

export const Tabs = (props: TabsProps) => {
  const [activeTab, setActiveTab] = createSignal(props.initialIndex || 0);

  // Helper to resolve title - supports both string and function
  const getTitle = (tab: TabItem) =>
    typeof tab.title === 'function' ? tab.title() : tab.title;

  return (
    <div class={styles.tabs}>
      <div class={styles.tabsHeader}>
        <For each={props.tabs}>
          {(tab, index) => (
            <button
              class={`${styles.tabButton} ${activeTab() === index() ? styles.active : ''}`}
              onClick={() => setActiveTab(index())}
            >
              {getTitle(tab)}
            </button>
          )}
        </For>
      </div>

      {/* Apply `tab-content-active` class only for active tab */}
      <div
        class={`${styles.tabContent} ${activeTab() !== undefined ? styles.tabContentActive : ''}`}
      >
        <Show when={props.tabs[activeTab()]}>
          {props.tabs[activeTab()].content()}
        </Show>
      </div>
    </div>
  );
};

export default Tabs;
