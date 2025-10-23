import { Component, onMount, onCleanup } from 'solid-js';
import { useNavigate, useParams, useLocation } from '@solidjs/router';
import { useKeyboardShortcuts } from '../../hooks';
import { useI18n } from '../../i18n';

interface GlobalShortcutsProps {
  onShowShortcuts: () => void;
  onCreateResource?: () => void;
}

export const GlobalShortcuts: Component<GlobalShortcutsProps> = (props) => {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();
  const { t } = useI18n();

  const getOrgId = () => {
    return params.orgId;
  };

  // Detect current context for Create shortcut
  const getCurrentContext = () => {
    const path = location.pathname;
    if (path.includes('/content/playlists')) return 'playlists';
    if (path.includes('/content/medias')) return 'medias';
    if (path.includes('/channels')) return 'channels';
    if (path.includes('/devices')) return 'devices';
    if (path.includes('/teams')) return 'teams';
    return null;
  };

  const handleCreate = () => {
    const context = getCurrentContext();
    if (!context) return;

    // Trigger click on the create/add/upload button in the current page
    // Strategy: Find buttons by common patterns in text content (works across languages)
    const buttons = Array.from(document.querySelectorAll('button'));

    const actionButton = buttons.find((btn) => {
      const text = btn.textContent?.toLowerCase() || '';
      const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';

      // Check for common action words from actual translations
      const actionWords = [
        // English
        'add',
        'create',
        'new',
        'upload',
        'register',
        // Spanish
        'añadir',
        'agregar',
        'crear',
        'nuevo',
        'subir',
        'registrar',
        // Swedish
        'lägg till',
        'skapa',
        'ny',
        'ladda upp',
        'registrera',
        // German
        'hinzufügen',
        'erstellen',
        'neu',
        'hochladen',
        'registrieren',
        // French
        'ajouter',
        'créer',
        'nouveau',
        'télécharger',
        'enregistrer',
        // Chinese
        '添加',
        '创建',
        '新',
        '上传',
        '注册',
        // Arabic
        'إضافة',
        'إنشاء',
        'جديد',
        'رفع',
        'تسجيل',
        // Korean
        '추가',
        '만들기',
        '새',
        '업로드',
        '등록',
        // Japanese
        '追加',
        '作成',
        '新しい',
        'アップロード',
        '登録',
      ];

      return actionWords.some(
        (word) => text.includes(word) || ariaLabel.includes(word)
      );
    });

    if (actionButton) {
      (actionButton as HTMLButtonElement).click();
    } else if (props.onCreateResource) {
      props.onCreateResource();
    }
  };

  onMount(() => {
    // Show shortcuts legend - using ? which is shift+/ on most keyboards
    registerShortcut('show-shortcuts', {
      key: '?',
      shift: true,
      description: () => t('shortcuts.showShortcutsLegend'),
      category: 'global',
      action: () => props.onShowShortcuts(),
    });

    // Global Search - moved to global category
    registerShortcut('global-search', {
      key: 'F',
      ctrl: true,
      description: () => t('shortcuts.search'),
      category: 'global',
      action: () => {
        const searchInput = document.querySelector(
          'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]'
        ) as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
    });

    // ESC to close dialogs and exit input fields
    registerShortcut('close-dialog', {
      key: 'Escape',
      description: () => t('shortcuts.closeDialog'),
      category: 'global',
      action: () => {
        // If focus is in an input field, blur it
        const activeElement = document.activeElement as HTMLElement;
        if (
          activeElement &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.isContentEditable)
        ) {
          activeElement.blur();
        }
        // Otherwise, let Modal component handle closing
      },
    });

    // Page Search - focus search field in current page (like GitHub's /)
    registerShortcut('page-search', {
      key: 'S',
      description: () => t('shortcuts.pageSearch'),
      category: 'global',
      action: () => {
        // Look for search input in the main content area (not topbar)
        const mainContent = document.querySelector(
          'main, [role="main"], .content'
        );
        const searchInput = mainContent?.querySelector(
          'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"], input[placeholder*="Buscar"], input[placeholder*="Sök"], input[placeholder*="Suche"], input[placeholder*="Recherche"], input[placeholder*="搜索"], input[placeholder*="بحث"], input[placeholder*="검색"], input[placeholder*="検索"]'
        ) as HTMLInputElement;

        if (searchInput) {
          searchInput.focus();
          searchInput.select(); // Select existing text for quick replacement
        }
      },
    });

    // Context-aware Create shortcut - simple C key (like GitHub)
    registerShortcut('create-resource', {
      key: 'C',
      description: () => t('shortcuts.createResource'),
      category: 'actions',
      action: handleCreate,
      condition: () => !!getCurrentContext(),
    });

    // Navigation shortcuts - use G + letter pattern (like GitHub's G N, G I, etc.)
    // Note: These work by pressing G, then the letter (not simultaneously)
    registerShortcut('goto-playlists', {
      key: 'P',
      ctrl: true,
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
      key: 'H',
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

    registerShortcut('goto-devices', {
      key: 'D',
      ctrl: true,
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
    unregisterShortcut('global-search');
    unregisterShortcut('page-search');
    unregisterShortcut('close-dialog');
    unregisterShortcut('create-resource');
    unregisterShortcut('goto-playlists');
    unregisterShortcut('goto-medias');
    unregisterShortcut('goto-channels');
    unregisterShortcut('goto-organization');
    unregisterShortcut('goto-teams');
    unregisterShortcut('goto-devices');
  });

  return null;
};
