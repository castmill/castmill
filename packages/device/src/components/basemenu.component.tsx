import {
  createSignal,
  createResource,
  onMount,
  onCleanup,
  Show,
  type JSX,
  type Component,
} from 'solid-js';
import styles from './basemenu.module.css';

const MENU_TIMEOUT = 10 * 1000;

// Menu entry interfaces
interface ActionMenuEntry {
  name: string;
  id: string;
  type: 'action';
  action: () => void;
}

interface CheckboxMenuEntry {
  name: string;
  id: string;
  type: 'checkbox';
  state: boolean;
  action: (state: boolean) => void;
}

interface SubmenuMenuEntry {
  name: string;
  id: string;
  type: 'submenu';
  action: (state: boolean) => void;
  children: MenuEntry[];
}

export type MenuEntry = ActionMenuEntry | CheckboxMenuEntry | SubmenuMenuEntry;

// internal item interface
interface MenuRowItem {
  offset: number;
  id: string;
  content: JSX.Element;
  action: () => void;
}

// type guards
const isActionMenuEntry = (entry: MenuEntry): entry is ActionMenuEntry =>
  entry.type === 'action';
const isCheckboxMenuEntry = (entry: MenuEntry): entry is CheckboxMenuEntry =>
  entry.type === 'checkbox';
const isSubmenuMenuEntry = (entry: MenuEntry): entry is SubmenuMenuEntry =>
  entry.type === 'submenu';

// BaseMenu component props
interface BaseMenuProps {
  header: JSX.Element;
  entries: MenuEntry[];
}

export const BaseMenu: Component<BaseMenuProps> = ({ header, entries }) => {
  // get initial checkbox states from menu entries
  const getCheckbosState = (menuEntries: MenuEntry[]) => {
    return menuEntries.reduce((acc: Record<string, boolean>, entry) => {
      if (isCheckboxMenuEntry(entry)) {
        acc[entry.id] = entry.state;
      } else if (isSubmenuMenuEntry(entry)) {
        acc = { ...acc, ...getCheckbosState(entry.children) };
      }
      return acc;
    }, {});
  };

  // signal for keeping track of timer for hiding menu
  const [timer, setTimer] = createSignal(0);
  // menu visibility signal
  const [visible, setVisible] = createSignal(false);
  // the currently selected item index
  const [selected, setSelected] = createSignal(0);
  // the currently active item id. Used to highlight the item when triggering action
  const [active, setActive] = createSignal();
  // checkbox states
  const [checked, setChecked] = createSignal<Record<string, boolean>>(
    getCheckbosState(entries)
  );
  // submenu states (expanded or not)
  const [submenuState, setSubmenuState] = createSignal<Record<string, boolean>>(
    {}
  );

  // Show menu when triggering action. Hide it after MENU_TIMEOUT ms of inactivity
  const showMenu = () => {
    // show menu
    setVisible(true);

    // clear previous timer
    clearTimeout(timer());

    // set new timer
    const t = setTimeout(() => {
      setVisible(false);
    }, MENU_TIMEOUT);

    setTimer(t);
  };

  const hideMenu = () => {
    setVisible(false);
  };

  // highlight selected item when triggering action
  const highlightItem = (id: string) => {
    setActive(id);
    setTimeout(() => {
      setActive(undefined);
    }, 500);
  };

  // create items from menu entries
  const getItems = (menuEntries: MenuEntry[], offset = 0) => {
    const items: MenuRowItem[] = [];

    menuEntries.forEach((entry, i) => {
      if (isSubmenuMenuEntry(entry)) {
        const expanded = submenuState()[entry.id];

        // add submenu item
        items.push({
          action: () => {
            onEnter(entry);
          },
          content: (
            <span>
              {expanded ? '▼' : '▶'} {entry.name}
            </span>
          ),
          offset,
          id: entry.id,
        });

        // if submenu is expanded, add its children
        if (expanded) items.push(...getItems(entry.children, offset + 1));
      } else if (isCheckboxMenuEntry(entry)) {
        const isChecked = checked()[entry.id];

        // add checkbox item
        items.push({
          action: () => {
            onEnter(entry);
          },
          content: (
            <div class={styles.checkbox}>
              {entry.name}
              <input type="checkbox" checked={isChecked} />
            </div>
          ),
          offset,
          id: entry.id,
        });
      } else {
        // add action item
        items.push({
          action: () => {
            highlightItem(entry.id);
            onEnter(entry);
          },
          content: <span>{entry.name}</span>,
          offset,
          id: entry.id,
        });
      }
    });

    return items;
  };

  const items = () => getItems(entries);

  // handle enter keypress or click
  const onEnter = (entry: MenuEntry) => {
    if (isActionMenuEntry(entry)) {
      entry.action();
    } else if (isCheckboxMenuEntry(entry)) {
      const newValue = !checked()[entry.id];
      entry.action(newValue);
      setChecked((c) => ({ ...c, [entry.id]: newValue }));
    } else if (isSubmenuMenuEntry(entry)) {
      const newValue = !submenuState()[entry.id];
      entry.action(newValue);
      setSubmenuState((c) => ({ ...c, [entry.id]: newValue }));
    }
  };

  // register event listeners. We may need more generic key events in the future to
  // support other devices. TV remote for example.
  onMount(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      showMenu();

      const currentItems = items();
      if (e.key === 'ArrowUp') {
        setSelected((s) => (s - 1 + currentItems.length) % currentItems.length);
      } else if (e.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % currentItems.length);
      } else if (e.key === 'Enter') {
        const item = currentItems[selected()];
        item.action();
      } else if (e.key === 'Escape') {
        hideMenu();
      }
    };

    //register keypresses
    window.addEventListener('keydown', onKeyDown);

    //register mouse and touch events
    window.addEventListener('touchstart', showMenu);
    window.addEventListener('click', showMenu);

    //cleanup
    onCleanup(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('touchstart', showMenu);
      window.removeEventListener('click', showMenu);
    });
  });

  return (
    <div class={styles.menu}>
      <Show when={visible()}>
        <div role="menu">
          <div class={styles.menuHead}>{header}</div>
          <ul>
            {items().map((item, i) => {
              const isSelected = selected() === i;
              const isActive = active() === item.id;

              const className = `${styles.menuItem} ${isSelected ? styles.selected : ''} ${isActive ? styles.active : ''}`;
              return (
                <li
                  onClick={() => {
                    item.action();
                  }}
                  onMouseOver={() => {
                    showMenu();
                    setSelected(i);
                  }}
                  class={className}
                >
                  <div style={{ 'margin-left': `${item.offset * 20}px` }}>
                    {item.content ? item.content : ''}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Show>
    </div>
  );
};
