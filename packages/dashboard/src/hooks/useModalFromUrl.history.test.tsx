import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { Route, Router, useSearchParams } from '@solidjs/router';
import { TableView } from '@castmill/ui-common';
import { closeDetailUrl, detailUrlOptions } from './useModalFromUrl';

const ListPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const fetchData = vi.fn().mockResolvedValue({
    data: [{ id: 'A', name: 'Item A' }],
    count: 30,
  });

  return (
    <>
      <button
        onClick={() => setSearchParams({ itemId: 'A' }, detailUrlOptions())}
      >
        open
      </button>
      <button
        onClick={() =>
          closeDetailUrl(() =>
            setSearchParams({ itemId: undefined }, { replace: true })
          )
        }
      >
        close
      </button>
      <TableView
        title="Items"
        resource="items"
        fetchData={fetchData}
        table={{ columns: [{ key: 'name', title: 'Name' }] }}
        pagination={{ itemsPerPage: 10 }}
        params={[searchParams, setSearchParams]}
      />
    </>
  );
};

const query = () => new URLSearchParams(window.location.search);

describe('detail history with list navigation', () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
  });

  it('does not reopen a detail on Back after paginating and closing it', async () => {
    window.history.replaceState(null, '', '/items');
    render(() => (
      <Router>
        <Route path="/items" component={ListPage} />
      </Router>
    ));

    await screen.findByText('Item A');

    fireEvent.click(screen.getByText('open'));
    await waitFor(() => expect(query().get('itemId')).toBe('A'));
    expect(window.history.state?.castmillDetail).toBe(true);

    fireEvent.click(screen.getByLabelText('Next page'));
    await waitFor(() => expect(query().get('page')).toBe('2'));

    fireEvent.click(screen.getByText('close'));
    await waitFor(() => expect(query().has('itemId')).toBe(false));
    expect(query().get('page')).toBe('2');

    const popped = new Promise((resolve) =>
      window.addEventListener('popstate', resolve, { once: true })
    );
    window.history.back();
    await popped;

    expect(window.location.pathname).toBe('/items');
    expect(query().has('itemId')).toBe(false);
  });
});
