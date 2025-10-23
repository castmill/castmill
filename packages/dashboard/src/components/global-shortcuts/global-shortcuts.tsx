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
 * Registers global keyboard shortcuts for navigation and common actions.
 * This component only registers shortcuts that are truly global and not tied
 * to specific UI components or addons.
 *
 * For context-specific shortcuts (like creating resources, deleting items, etc.),
 * those should be registered by the components/addons that own those actions.
 * This ensures proper decoupling and allows addons to define their own shortcuts.
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

    // Navigation shortcuts
    registerShortcut('goto-playlists', {
      key: 'P',
      ctrl: true,
      shift: true,
      description: () => t('shortcuts.gotoPlaylists'),
      category: 'navigation',
      action: () => {
        const orgId = getOrgId();
        if (orgId) {
          navigate(`/org/${orgId}/content/playlists`);
        }
      },
      condition: () => !!getOrgId(),
    });

    registerShortcut('goto-medias', {
      key: 'M',
      ctrl: true,
      shift: true,
      description: () => t('shortcuts.gotoMedias'),
      category: 'navigation',
      action: () => {
        const orgId = getOrgId();
        if (orgId) {
          navigate(`/org/${orgId}/content/medias`);
        }
      },
      condition: () => !!getOrgId(),
    });

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

    registerShortcut('goto-devices', {
      key: 'D',
      ctrl: true,
      shift: true,
      description: () => t('shortcuts.gotoDevices'),
      category: 'navigation',
      action: () => {
        const orgId = getOrgId();
        if (orgId) {
          navigate(`/org/${orgId}/devices`);
        }
      },
      condition: () => !!getOrgId(),
    });
  });

  onCleanup(() => {
    unregisterShortcut('show-shortcuts');
    unregisterShortcut('goto-playlists');
    unregisterShortcut('goto-medias');
    unregisterShortcut('goto-channels');
    unregisterShortcut('goto-organization');
    unregisterShortcut('goto-teams');
    unregisterShortcut('goto-devices');
  });

  return null;
};
