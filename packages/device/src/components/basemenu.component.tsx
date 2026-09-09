import {
  createSignal,
  createMemo,
  createResource,
  onMount,
  onCleanup,
  Show,
  For,
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

interface RadioButtonMenuEntry {
  name: string;
  description?: string;
  groupId: string;
  id: string;
  type: 'radiobutton';
  state: boolean;
  action: (selectedId: string) => void;
}

interface SubmenuMenuEntry {
  name: string;
  id: string;
  type: 'submenu';
  badge?: string;
  action?: (state: boolean) => void;
  children: MenuEntry[];
}

interface InfoMenuEntry {
  id: string;
  type: 'info';
  content: JSX.Element;
}

export type MenuEntry =
  | ActionMenuEntry
  | CheckboxMenuEntry
  | RadioButtonMenuEntry
  | SubmenuMenuEntry
  | InfoMenuEntry;

// internal item interface
interface MenuRowItem {
  offset: number;
  id: string;
  content: JSX.Element;
  action: () => void;
  nonInteractive?: boolean;
}

// type guards
const isActionMenuEntry = (entry: MenuEntry): entry is ActionMenuEntry =>
  entry.type === 'action';
const isCheckboxMenuEntry = (entry: MenuEntry): entry is CheckboxMenuEntry =>
  entry.type === 'checkbox';
const isRadioButtonMenuEntry = (
  entry: MenuEntry
): entry is RadioButtonMenuEntry => entry.type === 'radiobutton';
const isSubmenuMenuEntry = (entry: MenuEntry): entry is SubmenuMenuEntry =>
  entry.type === 'submenu';
const isInfoMenuEntry = (entry: MenuEntry): entry is InfoMenuEntry =>
  entry.type === 'info';

// BaseMenu component props
interface BaseMenuProps {
  header: JSX.Element;
  footer: JSX.Element;
  entries: MenuEntry[];
  onShow?: () => void;
}

export const BaseMenu: Component<BaseMenuProps> = (props) => {
  // get initial checkbox states from menu entries
  const getCheckboxState = (menuEntries: MenuEntry[]) => {
    return menuEntries.reduce((acc: Record<string, boolean>, entry) => {
      if (isCheckboxMenuEntry(entry)) {
        acc[entry.id] = entry.state;
      } else if (isSubmenuMenuEntry(entry)) {
        acc = { ...acc, ...getCheckboxState(entry.children) };
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
    getCheckboxState(props.entries)
  );

  // submenu states (expanded or not)
  const [submenuState, setSubmenuState] = createSignal<Record<string, boolean>>(
    {}
  );

  // Show menu when triggering action. Hide it after MENU_TIMEOUT ms of inactivity
  const showMenu = () => {
    const wasVisible = visible();

    // show menu
    setVisible(true);

    // notify parent only when first showing
    if (!wasVisible) {
      props.onShow?.();
    }

    // clear previous timer
    clearTimeout(timer());

    // set new timer
    const t = window.setTimeout(() => {
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
            <span class={styles.submenuHeader}>
              {expanded ? '▼' : '▶'} {entry.name}
              <Show when={entry.badge}>
                <span
                  class={styles.badge}
                  style={{ 'background-color': entry.badge }}
                ></span>
              </Show>
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
      } else if (isRadioButtonMenuEntry(entry)) {
        // add radio buttons item
        items.push({
          action: () => {
            onEnter(entry);
          },
          content: (
            <div class={styles.radiobutton}>
              {entry.name}
              {entry.description && (
                <span class={styles.radiobuttonDescription}>
                  {entry.description}
                </span>
              )}
              <input type="radio" checked={entry.state} />
            </div>
          ),
          offset,
          id: entry.id,
        });
      } else if (isActionMenuEntry(entry)) {
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
      } else if (isInfoMenuEntry(entry)) {
        // add info item (non-interactive)
        items.push({
          action: () => {},
          content: <div class={styles.infoItem}>{entry.content}</div>,
          offset,
          id: entry.id,
          nonInteractive: true,
        });
      }
    });

    return items;
  };

  const items = createMemo(() => getItems(props.entries));

  // handle enter keypress or click
  const onEnter = (entry: MenuEntry) => {
    if (isActionMenuEntry(entry)) {
      entry.action();
    } else if (isCheckboxMenuEntry(entry)) {
      const newValue = !checked()[entry.id];
      entry.action(newValue);
      setChecked((c) => ({ ...c, [entry.id]: newValue }));
    } else if (isRadioButtonMenuEntry(entry)) {
      entry.action(entry.id);
    } else if (isSubmenuMenuEntry(entry)) {
      const newValue = !submenuState()[entry.id];
      entry.action?.(newValue);
      setSubmenuState((c) => ({ ...c, [entry.id]: newValue }));
    }
  };

  enum Key {
    Down = 40,
    Up = 38,
    Enter = 13,
    Escape = 27,
  }

  // register event listeners. We may need more generic key events in the future to
  // support other devices. TV remote for example.
  onMount(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      showMenu();

      const currentItems = items();

      switch (e.keyCode) {
        case Key.Up:
          setSelected(
            (s) => (s - 1 + currentItems.length) % currentItems.length
          );
          break;
        case Key.Down:
          setSelected((s) => (s + 1) % currentItems.length);
          break;
        case Key.Enter:
          const item = currentItems[selected()];
          if (!item.nonInteractive) {
            item.action();
          }
          break;
        case Key.Escape:
          hideMenu();
          break;
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
    <Show when={visible()}>
      <div class={styles.menu}>
        <div role="menu">
          <div class={styles.menuHead}>{props.header}</div>
          <ul>
            <For each={items()}>
              {(item, i) => (
                <li
                  onClick={() => {
                    item.action();
                  }}
                  onMouseOver={() => {
                    showMenu();
                    setSelected(i());
                  }}
                  classList={{
                    [styles.menuItem]: true,
                    [styles.selected]: selected() === i(),
                    [styles.active]: active() === item.id,
                  }}
                >
                  <div style={{ 'margin-left': `${item.offset * 20}px` }}>
                    {item.content ? item.content : ''}
                  </div>
                </li>
              )}
            </For>
          </ul>
          <div class={styles.menuFooter}>{props.footer}</div>
        </div>
      </div>
    </Show>
  );
};
