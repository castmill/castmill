/**
 * Search Component.
 *
 * This component provides a search bar that allows the user to search for
 * anything in the application. The component itself does not provide any
 * search functionality, but updates the search query in the URL and triggers
 * a search in the application.
 *
 */

import { Component, createSignal, onCleanup, onMount } from 'solid-js';
import './search.scss';

import { FaSolidMagnifyingGlass } from 'solid-icons/fa';
import { ImCancelCircle } from 'solid-icons/im';

import { useNavigate } from '@solidjs/router';
import { useI18n } from '../../i18n';
import { useKeyboardShortcuts } from '../../hooks';

const Search: Component = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { registerShortcut, unregisterShortcut, formatShortcut, isMac } =
    useKeyboardShortcuts();
  const [searchString, setSearchString] = createSignal('');

  let inputRef: HTMLInputElement | undefined;

  const globalSearchShortcut = {
    key: 'F',
    ctrl: true,
    description: t('shortcuts.globalSearch'),
    category: 'global' as const,
    action: () => {
      inputRef?.focus();
    },
  };

  onMount(() => {
    registerShortcut('global-search', globalSearchShortcut);
  });

  onCleanup(() => {
    unregisterShortcut('global-search');
  });

  const handleEnterKeyDown = (event: KeyboardEvent) => {
    // Navigate to /org/:orgId/search?s=searchString when Enter is pressed
    if (event.key === 'Enter' && searchString() !== '') {
      const orgId = window.location.pathname.match(/\/org\/([^/]+)/)?.[1];
      if (orgId) {
        navigate(
          `/org/${orgId}/search?s=${encodeURIComponent(searchString())}`
        );
      } else {
        navigate(`/search?s=${encodeURIComponent(searchString())}`);
      }
      inputRef?.blur();
    }
    // Blur the search input when ESC is pressed
    if (event.key === 'Escape') {
      inputRef?.blur();
    }
  };

  const resetSearch = () => {
    setSearchString('');
    // If we are on the search page, navigate to current org search page
    if (window.location.pathname.includes('/search')) {
      const orgId = window.location.pathname.match(/\/org\/([^/]+)/)?.[1];
      if (orgId) {
        navigate(`/org/${orgId}/search`);
      } else {
        navigate(`/search`);
      }
    }
  };

  return (
    <div class="castmill-search">
      <FaSolidMagnifyingGlass />
      <input
        type="text"
        placeholder={t('common.search')}
        value={searchString()}
        onInput={(e) => setSearchString(e.currentTarget.value)}
        onKeyDown={handleEnterKeyDown}
        ref={inputRef} // Use ref to access the input element
      />
      <span class="keyboard-shortcut">
        {formatShortcut(globalSearchShortcut)}
      </span>
      <ImCancelCircle class="reset-icon" onClick={resetSearch} />
    </div>
  );
};

export default Search;
