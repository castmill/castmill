import { Component, onMount, onCleanup } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { useKeyboardShortcuts } from '../../hooks';
import { useI18n } from '../../i18n';

interface GlobalShortcutsProps {
  onShowShortcuts: () => void;
}

/**
 * GlobalShortcuts Component
 *
 * Registers global keyboard shortcuts for navigation to CORE pages only.
 * This component only registers shortcuts that are truly global and not tied
 * to specific addons.
 *
 * Navigation shortcuts for addon pages (playlists, medias, devices, etc.)
 * should be registered by the addons themselves to ensure proper decoupling
 * and allow instances to work correctly even when certain addons are not loaded.
 *
 * For context-specific shortcuts (like creating resources, deleting items, etc.),
 * those should be registered by the components/addons that own those actions.
 */
export const GlobalShortcuts: Component<GlobalShortcutsProps> = (props) => {
  const navigate = useNavigate();
  const params = useParams();
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();
  const { t } = useI18n();

  const getOrgId = () => {
    return params.orgId;
  };

  onMount(() => {
    // Show shortcuts legend - using Ctrl+/
    registerShortcut('show-shortcuts', {
      key: '/',
      ctrl: true,
      description: () => t('shortcuts.showShortcutsLegend'),
      category: 'global',
      action: () => props.onShowShortcuts(),
    });

    // Core page navigation shortcuts (not addons)
    // Addons like playlists, medias, devices should register their own shortcuts

    registerShortcut('goto-channels', {
      key: 'C',
      ctrl: true,
      shift: true,
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
      shift: true,
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
      key: 'T',
      ctrl: true,
      shift: true,
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
  });

  onCleanup(() => {
    unregisterShortcut('show-shortcuts');
    unregisterShortcut('goto-channels');
    unregisterShortcut('goto-organization');
    unregisterShortcut('goto-teams');
  });

  return null;
};
