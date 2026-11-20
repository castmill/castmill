import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@solidjs/testing-library';
import { TableView, TableViewRef } from './table-view';

type Result = { data: { id: string; name: string }[]; count: number };

const deferred = () => {
  let resolve!: (value: Result) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Result>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const result = (name: string): Result => ({
  data: [{ id: name, name }],
  count: 1,
});

const setup = (fetchData: () => Promise<Result>) => {
  let table!: TableViewRef;
  const view = render(() => (
    <TableView
      resource="teams"
      ref={(ref) => (table = ref)}
      fetchData={fetchData}
      table={{ columns: [{ key: 'name', title: 'Name' }] }}
      pagination={{ itemsPerPage: 10 }}
    />
  ));
  return { ...view, reload: () => table.reloadData() };
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TableView overlapping organization requests', () => {
  it('does not replace the new organization rows with a slow old response', async () => {
    const oldRequest = deferred();
    const fetchData = vi
      .fn()
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce(result('New organization team'));
    const { reload } = setup(fetchData);
    await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));

    await reload();
    expect(screen.getByText('New organization team')).toBeInTheDocument();
    oldRequest.resolve(result('Old organization team'));
    await oldRequest.promise;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText('New organization team')).toBeInTheDocument();
    expect(screen.queryByText('Old organization team')).not.toBeInTheDocument();
  });

  it('does not hide current rows when an obsolete request fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const oldRequest = deferred();
    const fetchData = vi
      .fn()
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce(result('New organization team'));
    const { reload } = setup(fetchData);
    await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));

    await reload();
    oldRequest.reject(new Error('Old organization request failed'));
    await oldRequest.promise.catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText('New organization team')).toBeInTheDocument();
    expect(
      screen.queryByText(/Old organization request failed/)
    ).not.toBeInTheDocument();
  });

  it('shows current failures and recovers after a successful reload', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetchData = vi
      .fn()
      .mockRejectedValueOnce(new Error('Current organization request failed'))
      .mockResolvedValueOnce(result('Recovered team'));
    const { reload } = setup(fetchData);
    await waitFor(() =>
      expect(
        screen.getByText(/Current organization request failed/)
      ).toBeInTheDocument()
    );
    await reload();
    expect(screen.getByText('Recovered team')).toBeInTheDocument();
  });

  it('cancels the deferred initial fetch when unmounted immediately', async () => {
    const fetchData = vi.fn().mockResolvedValue(result('Team'));
    const { unmount } = setup(fetchData);
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchData).not.toHaveBeenCalled();
  });

  it('keeps the newest failure even if an older load later succeeds', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const oldRequest = deferred();
    const fetchData = vi
      .fn()
      .mockReturnValueOnce(oldRequest.promise)
      .mockRejectedValueOnce(new Error('Current load failed'));
    const { reload } = setup(fetchData);
    await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));
    await reload();
    oldRequest.resolve(result('Old team'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText(/Current load failed/)).toBeInTheDocument();
    expect(screen.queryByText('Old team')).not.toBeInTheDocument();
  });

  it('does not fetch again through a disposed page ref', async () => {
    const request = deferred();
    const fetchData = vi.fn().mockReturnValue(request.promise);
    const { reload, unmount } = setup(fetchData);
    await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));
    unmount();
    request.resolve(result('Old team'));
    await reload();
    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Old team')).not.toBeInTheDocument();
  });
});
