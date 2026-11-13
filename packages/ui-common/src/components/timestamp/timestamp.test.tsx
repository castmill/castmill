import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { Timestamp } from './timestamp';
import { formatTimestamp } from '../formatters/time';

describe('Timestamp', () => {
  afterEach(cleanup);

  const value = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  it('toggles the absolute time on tap so touch users can read it', () => {
    render(() => <Timestamp value={value} locale="en" />);
    const button = screen.getByRole('button');
    const relative = button.textContent;
    expect(relative).not.toBe(formatTimestamp(value));
    expect(button).toHaveAttribute('title', formatTimestamp(value));
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    expect(button).toHaveTextContent(formatTimestamp(value));
    expect(button).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(button);
    expect(button.textContent).toBe(relative);
  });

  it('renders plain text without a tooltip', () => {
    render(() => <Timestamp value={value} showTooltip={false} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders absolute mode as plain text', () => {
    render(() => <Timestamp value={value} mode="absolute" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(formatTimestamp(value))).toBeInTheDocument();
  });
});
