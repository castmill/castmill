/** @jsxImportSource solid-js */

import {
  Component,
  createSignal,
  Show,
  For,
  onCleanup,
  createEffect,
} from 'solid-js';
import { Button } from '../button/button';
import { Modal, ModalRef } from '../modal/modal';
import { StyledInput } from '../styled-input/styled-input';
import { JsonMedia } from '@castmill/player';

import styles from './media-picker.module.scss';

export interface MediaPickerProps {
  /**
   * Whether the picker is currently visible
   */
  show: boolean;

  /**
   * Callback when the picker is closed
   */
  onClose: () => void;

  /**
   * Callback when a media is selected
   */
  onSelect: (mediaId: number) => void;

  /**
   * Function to fetch media items
   * @param page - The page number to fetch
   * @param pageSize - Number of items per page
   * @param search - Optional search query
   * @returns Promise with data and total count
   */
  fetchMedia: (
    page: number,
    pageSize: number,
    search?: string
  ) => Promise<{ data: JsonMedia[]; count: number }>;

  /**
   * Currently selected media ID (optional)
   */
  selectedMediaId?: number;

  /**
   * Title for the modal
   */
  title?: string;

  /**
   * Description for the modal
   */
  description?: string;

  /**
   * Filter function to only show certain media types
   * Default: only images
   */
  filterFn?: (media: JsonMedia) => boolean;

  /**
   * Number of items to fetch per page
   * Default: 30
   */
  pageSize?: number;

  /**
   * Placeholder text for search input
   */
  searchPlaceholder?: string;

  /**
   * Text to show when loading
   */
  loadingText?: string;

  /**
   * Text to show when no media is available
   */
  noMediaText?: string;

  /**
   * Label for cancel button
   */
  cancelLabel?: string;

  /**
   * Label for select button
   */
  selectLabel?: string;
}

export const MediaPicker: Component<MediaPickerProps> = (props) => {
  let modalRef: ModalRef | undefined;
  let gridRef: HTMLDivElement | undefined;

  const [medias, setMedias] = createSignal<JsonMedia[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [isSearching, setIsSearching] = createSignal(false);
  const [selectedMediaId, setSelectedMediaId] = createSignal<number | null>(
    props.selectedMediaId || null
  );
  const [currentPage, setCurrentPage] = createSignal(1);
  const [hasMore, setHasMore] = createSignal(true);
  const [totalCount, setTotalCount] = createSignal(0);

  const pageSize = props.pageSize || 30;
  const filterFn =
    props.filterFn ||
    ((media: JsonMedia) => media.mimetype?.startsWith('image/'));

  // Update selected media when prop changes
  createEffect(() => {
    if (props.selectedMediaId !== undefined) {
      setSelectedMediaId(props.selectedMediaId);
    }
  });

  const loadMedias = async (page: number, search?: string, append = false) => {
    if (!append) {
      setLoading(true);
    }

    try {
      const result = await props.fetchMedia(page, pageSize, search);

      // Filter media based on filterFn
      const filteredMedias = (result.data || []).filter(filterFn);

      if (append) {
        setMedias((prev) => [...prev, ...filteredMedias]);
      } else {
        setMedias(filteredMedias);
      }

      setTotalCount(result.count || 0);
      setHasMore(filteredMedias.length === pageSize);
    } catch (error) {
      console.error('Error loading medias:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reset and load initial data when modal opens
  createEffect(() => {
    if (props.show) {
      setSearchQuery('');
      setCurrentPage(1);
      setMedias([]);
      loadMedias(1);
    }
  });

  // Debounced search handler
  let searchTimeoutId: number | undefined;

  const handleSearchInput = (value: string | number | boolean) => {
    const searchValue = String(value);
    setSearchQuery(searchValue);

    // Clear existing timeout
    if (searchTimeoutId !== undefined) {
      clearTimeout(searchTimeoutId);
    }

    // Set searching state immediately for UX feedback
    setIsSearching(true);

    // Set new timeout
    searchTimeoutId = window.setTimeout(() => {
      setIsSearching(false);
      setCurrentPage(1);
      setMedias([]);
      loadMedias(1, searchValue || undefined);
    }, 500); // 500ms debounce
  };

  // Infinite scroll handler
  const handleScroll = () => {
    if (!gridRef || loading() || !hasMore()) return;

    const { scrollTop, scrollHeight, clientHeight } = gridRef;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    // Load more when scrolled 80% down
    if (scrollPercentage > 0.8) {
      const nextPage = currentPage() + 1;
      setCurrentPage(nextPage);
      loadMedias(nextPage, searchQuery() || undefined, true);
    }
  };

  // Cleanup timeout on unmount
  onCleanup(() => {
    if (searchTimeoutId !== undefined) {
      clearTimeout(searchTimeoutId);
    }
  });

  const handleSelect = () => {
    const mediaId = selectedMediaId();
    if (mediaId !== null) {
      props.onSelect(mediaId);
    }
  };

  return (
    <Show when={props.show}>
      <Modal
        ref={(ref) => (modalRef = ref)}
        title={props.title || 'Select Media'}
        description={props.description || 'Choose a media file'}
        onClose={props.onClose}
      >
        <div class={styles.mediaPicker}>
          <div class={styles.searchContainer}>
            <StyledInput
              id="media-picker-search"
              type="text"
              placeholder={props.searchPlaceholder || 'Search...'}
              value={searchQuery()}
              onInput={handleSearchInput}
            />
            <Show when={isSearching()}>
              <span class={styles.searchIndicator}>
                {props.loadingText || 'Loading...'}
              </span>
            </Show>
          </div>

          <Show when={loading() && medias().length === 0}>
            <div class={styles.loading}>
              {props.loadingText || 'Loading...'}
            </div>
          </Show>

          <div class={styles.mediaGridContainer}>
            <Show when={!loading() && medias().length === 0}>
              <div class={styles.noMedias}>
                {props.noMediaText || 'No media available'}
              </div>
            </Show>

            <div class={styles.mediaGrid} ref={gridRef} onScroll={handleScroll}>
              <For each={medias()}>
                {(media) => (
                  <div
                    class={styles.mediaItem}
                    classList={{
                      [styles.selected]: selectedMediaId() === media.id,
                    }}
                    onClick={() => setSelectedMediaId(media.id)}
                  >
                    <div class={styles.mediaThumbnail}>
                      <Show
                        when={
                          media.files?.thumbnail?.uri || media.files?.main?.uri
                        }
                        fallback={
                          <div class={styles.noPreview}>No preview</div>
                        }
                      >
                        <img
                          src={
                            media.files?.thumbnail?.uri ||
                            media.files?.main?.uri
                          }
                          alt={media.name}
                        />
                      </Show>
                    </div>
                    <div class={styles.mediaName}>{media.name}</div>
                  </div>
                )}
              </For>

              <Show when={loading() && medias().length > 0}>
                <div class={styles.loadingMore}>
                  {props.loadingText || 'Loading more...'}
                </div>
              </Show>
            </div>
          </div>

          <div class={styles.footer}>
            <div class={styles.info}>
              <Show when={totalCount() > 0}>
                <span>
                  Showing {medias().length} of {totalCount()}
                </span>
              </Show>
            </div>
            <div class={styles.actions}>
              <Button
                label={props.cancelLabel || 'Cancel'}
                onClick={props.onClose}
                color="secondary"
              />
              <Button
                label={props.selectLabel || 'Select'}
                onClick={handleSelect}
                color="primary"
                disabled={selectedMediaId() === null}
              />
            </div>
          </div>
        </div>
      </Modal>
    </Show>
  );
};
