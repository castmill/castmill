import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { useKeyboardShortcuts } from '../../hooks';
import { useI18n } from '../../i18n';
import { store } from '../../store/store';

interface GlobalShortcutsProps {
  onShowShortcuts: () => void;
}

/**
 * GlobalShortcuts Component
 *
 * Registers global keyboard shortcuts for core pages and addon navigation.
 *
 * NAVIGATION SHORTCUTS (registered here):
 * - Core pages: channels, organization, teams (always available)
 * - Addon pages: dynamically registered from addon metadata (keyboard_shortcut field)
 *
 * Navigation shortcuts are registered here because they need to be globally available
 * before the user visits the addon page.
 *
 * GENERIC ACTION SHORTCUTS (registered here with no-op, overridden by addons):
 * - C (Create), S (Search), Delete - always visible in legend
 * - Addons override these with actual handlers when mounted
 * - When no addon has registered a handler, they show a toast message
 */
export const GlobalShortcuts: Component<GlobalShortcutsProps> = (props) => {
  const navigate = useNavigate();
  const params = useParams();
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();
  const { t } = useI18n();

  // Keep track of dynamically registered addon shortcuts for cleanup
  let registeredAddonShortcuts: string[] = [];

  const getOrgId = () => {
    return params.orgId;
  };

  onMount(() => {
    // Show shortcuts legend - Shift+?
    registerShortcut('show-shortcuts', {
      key: '?',
      shift: true,
      description: () => t('shortcuts.showShortcutsLegend'),
      category: 'global',
      action: () => props.onShowShortcuts(),
    });

    // Core page navigation shortcuts
    // Note: These are core pages that are always available, not addon pages

    registerShortcut('goto-channels', {
      key: 'C',
      ctrl: true,
      description: () => t('shortcuts.gotoChannels'),
      category: 'navigation',
      action: () => {
        const orgId = getOrgId();
        if (orgId) {
          navigate(`/org/${orgId}/channels`);
        }
      },
      condition: () => !!getOrgId(),
    });

    registerShortcut('goto-organization', {
      key: 'O',
      ctrl: true,
      description: () => t('shortcuts.gotoOrganization'),
      category: 'navigation',
      action: () => {
        const orgId = getOrgId();
        if (orgId) {
          navigate(`/org/${orgId}/organization`);
        }
      },
      condition: () => !!getOrgId(),
    });

    registerShortcut('goto-teams', {
      key: 'G',
      ctrl: true,
      description: () => t('shortcuts.gotoTeams'),
      category: 'navigation',
      action: () => {
        const orgId = getOrgId();
        if (orgId) {
          navigate(`/org/${orgId}/teams`);
        }
      },
      condition: () => !!getOrgId(),
    });

    // Generic action shortcuts
    // These are always visible in the legend
    // Addons register their specific actions via registerShortcutAction

    registerShortcut('generic-create', {
      key: 'C',
      description: () => t('shortcuts.createResource'),
      category: 'actions',
      // No action - addons will register via registerShortcutAction
    });

    registerShortcut('generic-search', {
      key: 'S',
      description: () => t('shortcuts.searchResource'),
      category: 'actions',
      // No action - addons will register via registerShortcutAction
    });

    registerShortcut('generic-delete', {
      key: 'Delete',
      description: () => t('shortcuts.deleteSelected'),
      category: 'actions',
      // No action - addons will register via registerShortcutAction
    });
  });

  // Reactively register addon shortcuts when addons are loaded
  createEffect(() => {
    if (store.loadedAddons && store.addons.length > 0) {
      // Clear any previously registered addon shortcuts
      registeredAddonShortcuts.forEach((shortcutId) => {
        unregisterShortcut(shortcutId);
      });
      registeredAddonShortcuts = [];

      // Register shortcuts for each addon that has keyboard shortcut metadata
      store.addons.forEach((addon) => {
        if (addon.keyboard_shortcut) {
          const shortcutId = `goto-${addon.id}`;
          registeredAddonShortcuts.push(shortcutId);

          registerShortcut(shortcutId, {
            key: addon.keyboard_shortcut.key,
            ctrl: true,
            description: () => t(addon.keyboard_shortcut!.description_key),
            category: 'navigation',
            action: () => {
              const orgId = getOrgId();
              if (orgId) {
                navigate(`/org/${orgId}${addon.mount_path}`);
              }
            },
            condition: () => !!getOrgId(),
          });
        }
      });
    }
  });

  onCleanup(() => {
    unregisterShortcut('show-shortcuts');
    unregisterShortcut('goto-channels');
    unregisterShortcut('goto-organization');
    unregisterShortcut('goto-teams');

    // Dynamically unregister addon shortcuts
    registeredAddonShortcuts.forEach((shortcutId) => {
      unregisterShortcut(shortcutId);
    });

    unregisterShortcut('generic-create');
    unregisterShortcut('generic-search');
    unregisterShortcut('generic-delete');
  });

  return null;
};
