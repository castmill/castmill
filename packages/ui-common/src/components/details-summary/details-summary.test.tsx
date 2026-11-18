/** @jsxImportSource solid-js */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { COPY_FEEDBACK_MS, DetailsSummary } from './details-summary';

describe('DetailsSummary', () => {
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders pills, note and chips in a labelled region', () => {
    render(() => (
      <DetailsSummary
        label="Status"
        class="device-summary"
        pills={[
          { label: 'Online', tone: 'success', dot: true },
          { label: '3 items', title: 'Items' },
        ]}
        note="Last seen just now"
        chips={['webos', { label: '16:9', title: 'Aspect ratio' }]}
      />
    ));

    const region = screen.getByRole('region', { name: 'Status' });
    expect(region).toHaveClass('device-summary');
    expect(screen.getByText('Online')).toHaveAttribute('data-tone', 'success');
    expect(
      screen.getByText('Online').querySelector('[aria-hidden="true"]')
    ).not.toBeNull();
    expect(screen.getByText('3 items')).toHaveAttribute('data-tone', 'info');
    expect(screen.getByText('3 items')).toHaveAttribute('title', 'Items');
    expect(screen.getByText('Last seen just now')).toBeInTheDocument();
    expect(screen.getByText('webos')).toBeInTheDocument();
    expect(screen.getByText('16:9')).toHaveAttribute('title', 'Aspect ratio');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('omits the meta row when there are no chips or copy button', () => {
    render(() => <DetailsSummary label="Status" pills={[{ label: 'x' }]} />);
    const region = screen.getByRole('region', { name: 'Status' });
    expect(region.children).toHaveLength(1);
  });

  it('applies the compact class only when requested', () => {
    const [compact, setCompact] = createSignal(false);
    render(() => <DetailsSummary label="Status" compact={compact()} />);
    const region = screen.getByRole('region', { name: 'Status' });
    const base = region.className;
    setCompact(true);
    expect(region.className).not.toBe(base);
    expect(region.className.startsWith(base)).toBe(true);
  });

  it('copies the value, announces it and resets the feedback', async () => {
    vi.useFakeTimers();
    render(() => (
      <DetailsSummary
        label="Status"
        copy={{
          value: 'device-1',
          label: 'Copy ID',
          prefix: 'ID',
          copiedMessage: 'Copied',
        }}
      />
    ));

    const button = screen.getByRole('button', { name: 'Copy ID' });
    expect(button).toHaveTextContent('IDdevice-1');
    fireEvent.click(button);
    expect(writeText).toHaveBeenCalledWith('device-1');
    await vi.waitFor(() =>
      expect(screen.getByText('Copied')).toHaveAttribute('aria-live', 'polite')
    );

    vi.advanceTimersByTime(COPY_FEEDBACK_MS);
    await vi.waitFor(() => expect(screen.queryByText('Copied')).toBeNull());
  });

  it('reports copy failures', async () => {
    const error = new Error('denied');
    writeText.mockRejectedValue(error);
    const onError = vi.fn();
    render(() => (
      <DetailsSummary
        label="Status"
        copy={{
          value: 'abc',
          label: 'Copy ID',
          copiedMessage: 'Copied',
          onError,
        }}
      />
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Copy ID' }));
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
    expect(screen.queryByText('Copied')).toBeNull();
  });

  it('clears the feedback timer on unmount', async () => {
    vi.useFakeTimers();
    const timers = vi.getTimerCount();
    const { unmount } = render(() => (
      <DetailsSummary
        label="Status"
        copy={{ value: 'abc', label: 'Copy ID', copiedMessage: 'Copied' }}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Copy ID' }));
    await vi.waitFor(() => expect(screen.getByText('Copied')).toBeTruthy());
    unmount();
    expect(vi.getTimerCount()).toBe(timers);
  });
});
