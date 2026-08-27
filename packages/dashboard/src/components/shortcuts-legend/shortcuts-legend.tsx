import { Component, For, Show, createSignal } from 'solid-js';
import { Modal } from '@castmill/ui-common';
import { useKeyboardShortcuts, ShortcutCategory } from '../../hooks';
import { useI18n } from '../../i18n';
import './shortcuts-legend.scss';

interface ShortcutsLegendProps {
  show: boolean;
  onClose: () => void;
}

export const ShortcutsLegend: Component<ShortcutsLegendProps> = (props) => {
  const { getShortcuts, formatShortcut, isMobile } = useKeyboardShortcuts();
  const { t } = useI18n();

  const groupedShortcuts = () => {
    const shortcuts = getShortcuts();
    const groups: Record<ShortcutCategory, typeof shortcuts> = {
      global: new Map(),
      navigation: new Map(),
      actions: new Map(),
    };

    for (const [id, shortcut] of shortcuts) {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = new Map();
      }
      groups[shortcut.category].set(id, shortcut);
    }

    return groups;
  };

  const categoryTitle = (category: ShortcutCategory) => {
    const titles: Record<ShortcutCategory, string> = {
      global: t('shortcuts.categories.global'),
      navigation: t('shortcuts.categories.navigation'),
      actions: t('shortcuts.categories.actions'),
    };
    return titles[category];
  };

  // Don't show on mobile devices
  if (isMobile()) {
    return null;
  }

  return (
    <Show when={props.show}>
      <Modal
        title={t('shortcuts.legend.title')}
        description={t('shortcuts.legend.description')}
        onClose={props.onClose}
        contentClass="shortcuts-legend-modal"
      >
        <div class="shortcuts-legend">
          <For each={Object.entries(groupedShortcuts())}>
            {([category, shortcuts]) => (
              <Show when={shortcuts.size > 0}>
                <div class="shortcuts-category">
                  <h3>{categoryTitle(category as ShortcutCategory)}</h3>
                  <div class="shortcuts-list">
                    <For each={Array.from(shortcuts.values())}>
                      {(shortcut) => (
                        <div class="shortcut-item">
                          <span class="shortcut-description">
                            {typeof shortcut.description === 'function'
                              ? shortcut.description()
                              : shortcut.description}
                          </span>
                          <span class="shortcut-keys">
                            {formatShortcut(shortcut)}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            )}
          </For>
        </div>
      </Modal>
    </Show>
  );
};
