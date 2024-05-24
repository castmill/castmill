// Pagination.tsx
import { createMemo, For, JSX, Show } from 'solid-js';
import { TbPlayerTrackPrev, TbPlayerTrackNext } from 'solid-icons/tb';

import './pagination.scss';
import { IconWrapper } from '../icon-wrapper';

export interface PaginationProps {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  onPageChange: (newPage: number) => void;
}

export const Pagination = (props: PaginationProps): JSX.Element => {
  // Calculate the total number of pages
  const totalPages = createMemo(() =>
    Math.ceil(props.totalItems / props.itemsPerPage)
  );

  // Number of pages to show before and after the current page
  const maxVisiblePages = 7;

  // Calculate pages to display
  const getPagesToDisplay = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const halfWindow = Math.floor((maxVisiblePages - 1) / 2);

    // Determine the starting and ending pages
    let startPage = Math.max(1, props.currentPage - halfWindow);
    let endPage = Math.min(totalPages(), props.currentPage + halfWindow);

    // Adjust start and end pages if we're near the beginning or end
    if (startPage === 1) {
      endPage = Math.min(totalPages(), startPage + maxVisiblePages - 1);
    } else if (endPage === totalPages()) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Add the first page and ellipsis if required
    if (startPage > 1) {
      pages.push(1);
      if (startPage > 2) {
        pages.push('...');
      }
    }

    // Add the range of pages around the current page
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // Add ellipsis and the last page if required
    if (endPage < totalPages()) {
      if (endPage < totalPages() - 1) {
        pages.push('...');
      }
      pages.push(totalPages());
    }

    return pages;
  };

  // Handle page clicks
  const handlePageClick = (page: number | string) => {
    if (typeof page === 'number' && page !== props.currentPage) {
      props.onPageChange(page);
    }
  };

  return (
    <div class="pagination">
      {/* Previous Button */}
      <button
        aria-label="Previous page"
        class="pagination-button"
        disabled={props.currentPage === 1}
        onClick={() => handlePageClick(Math.max(1, props.currentPage - 1))}
      >
        <IconWrapper icon={TbPlayerTrackPrev} />
      </button>

      {/* Render the page numbers or ellipses */}
      <For each={getPagesToDisplay()}>
        {(page) => (
          <Show
            when={typeof page === 'number'}
            fallback={<span class="pagination-ellipsis">...</span>}
          >
            <button
              class={`pagination-button ${page === props.currentPage ? 'active' : ''}`}
              onClick={() => handlePageClick(page as number)}
            >
              {page}
            </button>
          </Show>
        )}
      </For>

      {/* Next Button */}
      <button
        aria-label="Next page"
        class="pagination-button"
        disabled={props.currentPage === totalPages()}
        onClick={() =>
          handlePageClick(Math.min(totalPages(), props.currentPage + 1))
        }
      >
        <IconWrapper icon={TbPlayerTrackNext} />
      </button>
    </div>
  );
};
