// Pagination.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { Pagination } from './pagination';

describe('Pagination Component', () => {
  // Utility function to render the component with initial values
  const setup = (totalItems = 100, itemsPerPage = 10, currentPage = 1) => {
    const onPageChange = vi.fn(); // Mock the onPageChange callback
    const rendered = render(() => (
      <Pagination
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        currentPage={currentPage}
        onPageChange={onPageChange}
      />
    ));
    return { ...rendered, onPageChange };
  };

  // Test: Renders the correct page range and ellipses
  it('should render correct page range with ellipses', () => {
    const { getByText } = setup(100, 10, 5); // 100 items, 10 per page, starting on page 5

    // Check visible page numbers
    expect(getByText('1')).toBeInTheDocument();
    expect(getByText('4')).toBeInTheDocument();
    expect(getByText('5')).toBeInTheDocument();
    expect(getByText('6')).toBeInTheDocument();
    expect(getByText('10')).toBeInTheDocument();

    // Check presence of ellipses
    expect(getByText('...')).toBeInTheDocument();
  });

  // Test: Clicking "Previous" and "Next" calls the onPageChange function
  it("should call onPageChange on clicking 'Previous' and 'Next'", () => {
    const { getByLabelText, onPageChange } = setup(100, 10, 5); // Start on page 5

    // Click "Previous" and expect the callback to be called with the previous page
    fireEvent.click(getByLabelText('Previous page'));
    expect(onPageChange).toHaveBeenCalledWith(4);

    // Click "Next" and expect the callback to be called with the next page
    fireEvent.click(getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(6);
  });

  // Test: Clicking specific page numbers changes to the correct page
  it('should call onPageChange on clicking specific page numbers', () => {
    const { getByText, onPageChange } = setup(100, 10, 2); // Start on page 2

    // Click page 5 and expect the callback to be called with page 5
    fireEvent.click(getByText('5'));
    expect(onPageChange).toHaveBeenCalledWith(5);
  });

  // Test: "Previous" and "Next" buttons should be disabled at boundaries
  it("should disable 'Previous' and 'Next' buttons at boundaries", () => {
    const { getByLabelText } = setup(50, 10, 1); // 50 items, 10 per page, starting on page 1

    // "Previous" button should be disabled on the first page
    expect(getByLabelText('Previous page')).toBeDisabled();

    // "Next" button should be enabled
    expect(getByLabelText('Next page')).not.toBeDisabled();
  });
});
