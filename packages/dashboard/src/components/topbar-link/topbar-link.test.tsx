import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import TopbarLink from './topbar-link';
import { TbHelpCircle } from 'solid-icons/tb';

// Mock router
vi.mock('@solidjs/router', () => ({
  A: ({ href, children }: { href: string; children: any }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('TopbarLink Component', () => {
  it('renders internal link without external prop', () => {
    render(() => (
      <TopbarLink to="/dashboard" icon={TbHelpCircle} text="Dashboard" />
    ));

    const link = screen.getByText('Dashboard').closest('a');

    // Verify the link exists
    expect(link).toBeTruthy();

    // Verify it points to the internal route
    expect(link?.getAttribute('href')).toBe('/dashboard');

    // Verify it does NOT have target="_blank" for internal links
    expect(link?.getAttribute('target')).toBeNull();
  });

  it('renders external link with external prop', () => {
    render(() => (
      <TopbarLink
        to="https://docs.castmill.io"
        icon={TbHelpCircle}
        text="Help"
        external={true}
      />
    ));

    const link = screen.getByText('Help').closest('a');

    // Verify the link exists
    expect(link).toBeTruthy();

    // Verify it points to the external URL
    expect(link?.getAttribute('href')).toBe('https://docs.castmill.io');

    // Verify it opens in a new tab
    expect(link?.getAttribute('target')).toBe('_blank');

    // Verify it has security attributes
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders with icon when provided', () => {
    render(() => <TopbarLink to="/test" icon={TbHelpCircle} text="Test" />);

    const link = screen.getByText('Test').closest('a');
    expect(link).toBeTruthy();

    // Verify the icon is rendered (SVG element should be present)
    const svg = link?.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders without icon when not provided', () => {
    render(() => <TopbarLink to="/test" text="Test" />);

    const link = screen.getByText('Test').closest('a');
    expect(link).toBeTruthy();

    // Verify no icon is rendered
    const svg = link?.querySelector('svg');
    expect(svg).toBeNull();
  });
});
