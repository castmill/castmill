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

const Search: Component = () => {
  const navigate = useNavigate();
  const [searchString, setSearchString] = createSignal('');

  let inputRef: HTMLInputElement | null = null;

  const handleKeyDown = (event: KeyboardEvent) => {
    // Check if Command+F (⌘F) was pressed
    if (event.metaKey && event.key === 'f') {
      event.preventDefault(); // Prevent the default action of ⌘F
      inputRef!.focus();
    }

    // Check if Escape was pressed
    if (event.key === 'Escape') {
      inputRef!.blur();
    }
  };

  const handleEnterKeyDown = (event: KeyboardEvent) => {
    // Navigate to /search?s=searchString when Enter is pressed
    if (event.key === 'Enter' && searchString() !== '') {
      navigate(`/search?s=${encodeURIComponent(searchString())}`);
      inputRef!.blur();
    }
  };

  const resetSearch = () => {
    setSearchString('');
    // If we are on the search page, navigate to /search
    if (window.location.pathname === '/search') {
      navigate(`/search`);
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div class="castmill-search">
      <FaSolidMagnifyingGlass />
      <input
        type="text"
        placeholder="Search..."
        value={searchString()}
        onInput={(e) => setSearchString(e.currentTarget.value)}
        onKeyDown={handleEnterKeyDown}
        ref={inputRef!} // Use ref to access the input element
      />
      <span class="keyboard-shortcut">&#8984;F</span>
      <ImCancelCircle class="reset-icon" onClick={resetSearch} />
    </div>
  );
};

export default Search;
