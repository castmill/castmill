// Tabs.tsx
import { createSignal, For, JSX, Show } from 'solid-js';
import styles from './tabs.module.scss';

export interface TabItem {
  title: string;
  content: () => JSX.Element;
}

export interface TabsProps {
  tabs: TabItem[];
  initialIndex?: number;
}

export const Tabs = (props: TabsProps) => {
  const [activeTab, setActiveTab] = createSignal(props.initialIndex || 0);

  return (
    <div class={styles.tabs}>
      <div class={styles.tabsHeader}>
        <For each={props.tabs}>
          {(tab, index) => (
            <button
              class={`${styles.tabButton} ${activeTab() === index() ? styles.active : ''}`}
              onClick={() => setActiveTab(index())}
            >
              {tab.title}
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
